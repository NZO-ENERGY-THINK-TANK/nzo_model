const SHEET_ASSUMPTIONS = '13_assumptions'
// Header row of 13_assumptions = header row of data/costs.csv (sheet row 1). Values per year are computed in code.
var FORECASTED_PARAM_HEADERS = [
  'product',
  'parameter',
  'source',
  'units',
  'comments',
  'increase',
  'base_price',
  'change_2022',
  'change_2025',
  'change_2030',
  'change_2035',
  'change_2040',
  'change_2045',
  'change_2050'
]

var FORECASTED_PARAM_OUTPUT_HEADERS = ['product', 'parameter', 'source', 'units'].concat(interpolate([2022, 2050]));

/**
 * In-memory database for financial assumptions.
 * Optimizes performance by indexing a flat list into a structured lookup table (O(1) access).
 * * @class
 */
class CostsDb {

  /**
   * Initializes the database and builds the index.
   * Structure: db[Product][Parameter] -> FinancialParameter Object
   * * @param {Array<Object>} costs - List of FinancialParameter objects.
   */
  constructor(costs){
    this.list = costs
    this.db = {}

    // Indexing Logic: Convert linear array to nested map for fast retrieval
    costs.forEach(fp => { 
      if (!(this.db.hasOwnProperty(fp.product))) {
        this.db[fp.product] = {};
      }
      this.db[fp.product][fp.parameter] = fp;
    });
  }

  /**
   * Retrieves a specific cost value for a given year.
   * Implements 'Fail Fast' logic: throws an error immediately if the data is missing
   * to prevent silent calculation errors downstream.
   */
  get(product, parameter, year) {
    if (!(product in this.db)) {
      throw "Missing product from CostsDb: " + product;
    }
    if (!(parameter in this.db[product])) {
      throw "Missing parameter from CostsDb: " + parameter;
    }
    return this.db[product][parameter].valuesByYear[year];
  }
  
  // --- SERIALIZATION HELPERS ---
  // Helper methods to format data for writing back to the Google Sheet.
  getHeaders(){
    return this.list[0].headers;
  }
  
  toTable() {
    return this.list.map(fp =>fp.toRow());
  }
  
};


/**
 * Represents a single forecasted parameter (e.g., "Solar Panel Cost").
 * Parses raw row data and expands it into a continuous yearly time-series.
 * * @class
 */
class ForecastedParam {
  
  /**
   * Initializes the parameter and calculates values for all years.
   * * @param {Array} row - Raw data row from the spreadsheet. 
   * Note: The 'row' array is consumed (shifted) during initialization.
   * Row layout = data/costs.csv: 6 descriptor columns, base_price, and 7 change columns (2022..2050).
   */
  constructor(row){
    // Extraction: Remove metadata from the start of the row
    this.product = row.shift().toLowerCase()
    this.parameter = row.shift().toLowerCase()
    this.source = row.shift().toLowerCase()
    this.units = row.shift()
    this.comments = row.shift()
    this.increase = row.shift() // Determines the calculation mode (linear, yoy)
    this.basePrice = row.shift()

    // Percent change vs. base price at each anchor year (2022, 2025, ..., 2050).
    var row0BasePrice = this.basePrice;
    this.percentChange = addYearDimension(row.slice(0, 7))
    // Absolute value at each anchor year = base price * (1 + percent change).
    this.values = this.percentChange.map(function(p) { return [p[0], row0BasePrice * (1 + p[1])]; })
    this.valuesByYear = {}
    this.headers = FORECASTED_PARAM_OUTPUT_HEADERS

    // --- FORECASTING LOGIC ---
    // Apply different expansion algorithms based on the 'increase' flag.

    if (this.increase === 'linear') {
      // Standard Interpolation: Fill gaps between provided data points linearly.
      this.percentChange = interpolate(this.percentChange);
      this.values = interpolate(this.values);
    } else if (this.increase === 'yoy') {
      // Compound Growth (Year-Over-Year):
      // Calculate values iteratively: Price(t) = Price(t-1) * (1 + GrowthRate)
      this.percentChange = interpolate(this.percentChange, "step");
      this.values = [[2022, this.basePrice]];
      for (var i = 1; i <= 28; ++i) {
        this.values.push([2022 + i, this.values[i-1][1] * (1+this.percentChange[i][1])]);
      }
    } else {
      throw "Failed getting costs data. wrong increase mode: " + this.increase;
    }

    // Indexing: Convert array to Hash Map for O(1) lookup performance
    for (var i = 0; i < this.values.length; ++i) {
      this.valuesByYear[this.values[i][0]] = this.values[i][1];
    }
  }

  toRow() {
    return [this.product, this.parameter, this.source, this.units].concat(this.values.map(function(x) { return x[1]; }));
  };
}

/**
 * Helper function: Maps raw column values to specific simulation years.
 * Transforms a flat array [v1, v2...] into time-series tuples [[2022, v1], [2025, v2]...].
 */
function addYearDimension(values) {
  const years = [2022, 2025, 2030, 2035, 2040, 2045, 2050];
  return values.map((x, i)=> [years[i], x]);
}

/**
 * Factory function: Performs the ETL process (Extract, Transform, Load) for cost assumptions.
 * Reads raw sheet data, applies forecasting algorithms, and indexes them for fast retrieval.
 * @return {CostsDb} The initialized database object.
 */
function getCostsDb() {
  // Extract: Read raw rows, skipping the header line
  var rows = readTableFromSheet(SHEET_ASSUMPTIONS, 1, FORECASTED_PARAM_HEADERS);
  // Transform: Convert raw data rows into smart objects containing forecasting logic
  costs = rows.map(row => new ForecastedParam(row));
  return new CostsDb(costs);
}
