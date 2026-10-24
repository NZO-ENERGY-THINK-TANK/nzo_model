const SHEET_TECH_PARAMS = '13_tech-params'
// Header row of 13_tech-params = header row of data/tech-params.csv (sheet row 1). Values per year are computed in code.
// param_set: the parameter set a row belongs to. DEFAULT_PARAM_SET holds every row; any other set holds only the rows
// that differ from it, and a row missing from a set is taken from DEFAULT_PARAM_SET. Every row must have a param_set
// (an empty first column ends the table).
const DEFAULT_PARAM_SET = 'NZO';
var FORECASTED_PARAM_HEADERS = [
  'param_set',
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

var FORECASTED_PARAM_OUTPUT_HEADERS = ['param_set', 'product', 'parameter', 'source', 'units'].concat(interpolate([2022, 2050]));

/**
 * In-memory database of the technology parameters, by parameter set.
 * Structure: sets[paramSet][product][parameter] -> ForecastedParam.
 * A CostsDb object reads one set (this.paramSet, DEFAULT_PARAM_SET unless forSet() was called);
 * a (product, parameter) missing from that set is read from DEFAULT_PARAM_SET.
 * @class
 */
class CostsDb {

  /** @param {Array<ForecastedParam>} costs - all rows of 13_tech-params. */
  constructor(costs){
    this.list = costs
    this.sets = {}
    this.paramSet = DEFAULT_PARAM_SET

    costs.forEach(fp => {
      if (!this.sets.hasOwnProperty(fp.paramSet)) this.sets[fp.paramSet] = {};
      var set = this.sets[fp.paramSet];
      if (!set.hasOwnProperty(fp.product)) set[fp.product] = {};
      if (set[fp.product].hasOwnProperty(fp.parameter)) {
        throw new Error(SHEET_TECH_PARAMS + ': duplicate row ' + fp.paramSet + ' / ' + fp.product + ' / ' + fp.parameter);
      }
      set[fp.product][fp.parameter] = fp;
    });
    if (!this.sets.hasOwnProperty(DEFAULT_PARAM_SET)) {
      throw new Error(SHEET_TECH_PARAMS + ": no rows with param_set '" + DEFAULT_PARAM_SET + "' (the default set, which must hold every row)");
    }
  }

  /** Names of the parameter sets, default first. */
  setNames() {
    return [DEFAULT_PARAM_SET].concat(Object.keys(this.sets).filter(n => n !== DEFAULT_PARAM_SET));
  }

  /** A view of this database that reads the given set (empty = default). Throws on an unknown set. */
  forSet(name) {
    if (name === '' || name === undefined || name === null) name = DEFAULT_PARAM_SET;
    if (!this.sets.hasOwnProperty(name)) {
      throw new Error("Unknown param_set '" + name + "'. Sets in " + SHEET_TECH_PARAMS + ': ' + this.setNames().join(', '));
    }
    var view = Object.create(CostsDb.prototype);
    view.list = this.list;
    view.sets = this.sets;
    view.paramSet = name;
    return view;
  }

  /**
   * Value of a parameter for a given year, from this.paramSet, else from DEFAULT_PARAM_SET.
   * Fail fast: throws if the parameter is missing from both.
   */
  get(product, parameter, year) {
    var own = this.sets[this.paramSet];
    if (own[product] && own[product][parameter]) return own[product][parameter].valuesByYear[year];
    var base = this.sets[DEFAULT_PARAM_SET];
    if (!(product in base)) {
      throw "Missing product from CostsDb: " + product;
    }
    if (!(parameter in base[product])) {
      throw "Missing parameter from CostsDb: " + product + " / " + parameter;
    }
    return base[product][parameter].valuesByYear[year];
  }

  /** True when (product, parameter) exists in this set or in the default set. */
  has(product, parameter) {
    var own = this.sets[this.paramSet], base = this.sets[DEFAULT_PARAM_SET];
    return !!((own[product] && own[product][parameter]) || (base[product] && base[product][parameter]));
  }

  /**
   * Cost of capital used to annualize the CAPEX of a technology (PMT): the product's own 'wacc' row
   * if there is one (e.g. EA values per technology), else the general financial / wacc.
   */
  getWacc(product, year) {
    return this.has(product, 'wacc') ? this.get(product, 'wacc', year) : this.get('financial', 'wacc', year);
  }

  // --- SERIALIZATION HELPERS ---
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
   * Row layout = data/tech-params.csv: param_set, 6 descriptor columns, base_price, and 7 change columns (2022..2050).
   */
  constructor(row){
    // Extraction: Remove metadata from the start of the row
    this.paramSet = String(row.shift()).trim()
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
    return [this.paramSet, this.product, this.parameter, this.source, this.units].concat(this.values.map(function(x) { return x[1]; }));
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
  var rows = readTableFromSheet(SHEET_TECH_PARAMS, 1, FORECASTED_PARAM_HEADERS);
  // Transform: Convert raw data rows into smart objects containing forecasting logic
  costs = rows.map(row => new ForecastedParam(row));
  return new CostsDb(costs);
}


/**
 * Technology parameters that drive the simulation itself (not only the costs), for one year.
 * Read from 13_tech-params (rows storage/efficiency, storage/depth of discharge, hydrogen/efficiency)
 * through a CostsDb view, so they follow the scenario's param_set. Predict Year uses the default set.
 * Until 24.10.2026 these were inputs: keyframe columns and 20_year-input rows (storage), and the scenario
 * settings table and 20_year-input (hydrogen).
 * @param {CostsDb} costsDb - a CostsDb or a forSet() view.
 * @param {number} year
 */
function techParamsForYear(costsDb, year) {
  var out = {
    storageEfficiency: costsDb.get('storage', 'efficiency', year),
    storageDepthOfDischarge: costsDb.get('storage', 'depth of discharge', year),
    hydrogenEfficenty: costsDb.get('hydrogen', 'efficiency', year)
  };
  Object.keys(out).forEach(function(k) {
    if (typeof out[k] !== 'number' || isNaN(out[k])) {
      throw new Error(SHEET_TECH_PARAMS + ' (' + costsDb.paramSet + '): no value for ' + k + ' in ' + year);
    }
  });
  return out;
}
