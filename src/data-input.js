const SHEET_REF_YEAR_HOURLY = '04_raw-data-hourly'
// Demand scenario names (01_parameters 'demand-scenario') -> column header in 02_demand (data/yearly_demand.csv)
const DEMAND_SCENARIO_COLUMNS = {
  'Noga conservative': 'noga23_conservative_twh',
  'Noga BAU': 'noga23_bau_twh'
};

/**
 * Data Aggregator: Fetches and consolidates all necessary simulation inputs.
 * Combines static parameters, hourly profiles, and demand forecasts into a single context object.
 * @return {Object} The complete simulation context (in_data).
 */
function getInputData() {
  var params = getParameters();
  var futureForecast = futureDemandForecast();
  var hoursGen = _getHoursGeneration();
  return {
    hoursGen,
    futureForecast,
    // Merge strategy: Update static parameters with dynamic values derived from the forecast
    parameters: update(params, forecastParameters(params, futureForecast))
  };
};


/**
 * Private Helper: Parses raw hourly data into structured objects.
 * Transforms array indices (e.g., row[6]) into named properties (e.g., solarGen).
 * * @return {Array<Object>} A list of 8760 hourly data objects.
 * @private
 */
function _getHoursGeneration() {
  return _readRefYearHoursData().map(row => {
    return {
      // Date Parsing: JavaScript months are 0-indexed (Jan=0), so we subtract 1.
      'date': new Date(row[2], row[1] - 1, row[0]),
      // Normalize hour to 0-23 format using modulo arithmetic
      'hourOfDay': (row[4] - 1) % 24,
      'hourOfYear': row[4],
      // Mapping hardcoded column indices to semantic names
      'totalGen': row[5],
      'solarGen': row[6],
      'windGeneration': row[8]
    }
  });
}

/**
 * Low-level Data Access: Reads the raw reference year hourly data (8760 rows).
 * Performs a single batch read for performance, minimizing slow API calls.
 * @private
 */
function _readRefYearHoursData() {
  const sheet = getSheet(SHEET_REF_YEAR_HOURLY)
  // Calculate dimensions dynamically to read only existing data
  var lastRow = sheet.getLastRow();
  var lastCol=sheet.getLastColumn();
 
  // PERFORMANCE: Load the entire dataset into memory at once (2D Array).
  var dataRange = sheet.getRange(2, 1, lastRow-1,lastCol);
  var allValues = dataRange.getValues();

  // Column Projection: the sheet is loaded from data/hourly_demand23.csv (14 columns, header row 1):
  // day,month,year,time,hour_of_year,total_generation_mw,must_run_mw,solar_mw,gas_mw,fossil_mw,gas_share,wind_mw,...
  // Output row: [day, month, year, time, hourOfYear, totalGen, solarGen, fossilGen, windGen]
  if (String(sheet.getRange(1, 1).getValue()).trim() !== 'day') {
    throw new Error(SHEET_REF_YEAR_HOURLY + ' is not in the data layout (A1 must be "day"). Load data/hourly_demand23.csv.');
  }
  return allValues.map(val=> [
      val[0],
      val[1],
      val[2],
      String(val[3]),
      val[4],
      val[5],
      val[7],
      val[9],
      val[11]
  ])
}

/**
 * Reads a yearly table (header in row 1, loaded from a CSV in data/) into { year: { column: value } }.
 * Columns are located by header name, so their order does not matter.
 * @private
 */
function _readYearlyTable(sheetName, requiredColumns) {
  var sheet = getSheet(sheetName);
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = values.shift();
  var idx = {};
  ['year'].concat(requiredColumns).forEach(function(name) {
    idx[name] = headers.indexOf(name);
    if (idx[name] < 0) {
      throw new Error(sheetName + ' is missing column "' + name + '". Load the matching CSV from data/.');
    }
  });
  var table = {};
  values.forEach(function(row) {
    var entry = {};
    requiredColumns.forEach(function(name) { entry[name] = row[idx[name]]; });
    table[row[idx['year']]] = entry;
  });
  return table;
}

/**
 * Reads the long-term electricity demand forecast (2023-2050) from 02_demand (data/yearly_demand.csv)
 * and the must-run capacity from 03_must_run_yearly (data/must_run_yearly.csv).
 * The demand scenario is chosen by 01_parameters 'demand-scenario' and mapped by DEMAND_SCENARIO_COLUMNS.
 * * @return {Object} A map structure: { Year: { demand (MWh), mustRun (MW) } }
 */
function futureDemandForecast() {
  var scenarioRow = readParams().filter(function(row) { return row[0] === 'demand-scenario'; })[0];
  var scenario = scenarioRow ? scenarioRow[2] : undefined;
  var demandColumn = DEMAND_SCENARIO_COLUMNS[scenario];
  if (!demandColumn) {
    throw new Error("Unknown demand-scenario '" + scenario + "'. Expected one of: " + Object.keys(DEMAND_SCENARIO_COLUMNS).join(', '));
  }
  var demand = _readYearlyTable(SHEET_DEMAND_INPUT, [demandColumn]);
  var mustRun = _readYearlyTable(SHEET_MUST_RUN_INPUT, ['must_run_mw']);

  var futureForecast = {};
  Object.keys(demand).forEach(function(year) {
    if (!(year in mustRun)) {
      throw new Error(SHEET_MUST_RUN_INPUT + ' has no row for year ' + year);
    }
    futureForecast[year] = { //by year
      // UNIT CONVERSION: Sheet Units (TWh) to Model Units (MWh).
      'demand': demand[year][demandColumn] * 1000000,
      'mustRun': mustRun[year]['must_run_mw']
    }
  });
  return futureForecast
};
