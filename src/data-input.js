const SHEET_REF_YEAR_HOURLY = '04_raw-data-hourly'
const SHEET_FUTURE_YEARLY_DEMAND = '03_future-yearly-demand'

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

  // Column Projection: Map specific source columns to a cleaned array structure.
  // WARNING: Relies on fixed column indices. Changing the source sheet layout will break this.
  return allValues.map(val=> [
      val[1], 
      val[2], 
      val[3],
      String(val[5]).substring(16,25),
      val[6],
      val[7],
      val[11],
      val[13],
      val[15]
  ])
}

/**
 * Reads the long-term electricity demand forecast (e.g., 2023-2050).
 * Parses the data into a Year-indexed lookup object for easy retrieval.
 * * @return {Object} A map structure: { Year: { demand, mustRun } }
 */
function futureDemandForecast() {
  var futureYearlyDemandSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_FUTURE_YEARLY_DEMAND);
  
  // Define the simulation timeframe
  var [firstYear, lastYear] = [2023, 2050]
  
  // OFFSET CALCULATION:
  // We assume the data for the base year (2020) starts exactly at Row 8.
  // WARNING: Adding rows to the sheet header will break this logic.
  var firstRow = 8 + (firstYear-2020)
  var numOfRows = (lastYear -firstYear) + 1
  var rawData = futureYearlyDemandSheet.getRange(firstRow, 1, numOfRows, 8).getValues();

  var futureForecast = {};
  rawData.forEach(function(row) {
    futureForecast[row[0]] = { //by year
      // UNIT CONVERSION:
      // Convert Sheet Units (TWh) to Model Units (MWh).
      'demand': row[1] * 1000000, //according to the selected demand model: NZO/ rashut Hahashmal/ noga bau, etc.
      'mustRun': row[6]
    }
  });
  return futureForecast
};