const SHEET_PARAMETERS = '20_year-input'

var PARAMETER_TO_VARIABLE_NAME = {
  'predicted year': 'currentYear',
  'predicted solar capacity': 'solarCapacity',
  'predicted wind capactiy': 'windCapacity',
  'nuclear Capacity': 'nuclearCapacity',
  'Waste To Energy Capacity': 'wasteToEnergyCapacity',
  'Hydrogen In Storage': 'hydrogenStorage',
  'Hydrogen production capacity':'hydrogenProductionCapacity',
  'Hydrogen Import capacity':'hydrogenImportCapacity',
  'predicted storage energy capacity': 'storageEnergy',
  'dfsHoursPerYear':'dfsHoursPerYear',
  'dfsReductionPerHour':'dfsReductionPerHour',
  'V2GEnergy':'v2gEnergy'
};
var PARAMETERS_UNITS = {};

/**
 * Configuration Loader: Reads and parses simulation parameters from the UI.
 * Acts as a translation layer, mapping human-readable sheet labels to internal variable names.
 * @return {Object} A dictionary of active simulation parameters.
 */
function getParameters() {
  var parameters = {}
  readParams().forEach(function(row) {
    // MAPPING LAYER:
    // We only import parameters that are explicitly defined in our mapping config.
    // This decouples the spreadsheet text (UI) from the variable names (Logic).
    if (row[0] in PARAMETER_TO_VARIABLE_NAME) {
      parameters[PARAMETER_TO_VARIABLE_NAME[row[0]]] = row[2];
      PARAMETERS_UNITS[row[0]] = row[1];
    }
  });
  // Storage and hydrogen efficiency come from 13_tech-params (techParamsForYear); internalParameters() is applied in getInputData().
  return parameters;
};

/**
 * Low-level accessor: Reads the raw parameter table from the sheet.
 * Fetches the first 3 columns (Name, Unit, Value) for the entire dataset.
 * * @return {Array<Array>} A 2D array of the raw configuration data.
 */
function readParams(){
  var spreadsheet = SpreadsheetApp.getActive();
  var sheet = spreadsheet.getSheetByName(SHEET_PARAMETERS);
  // NOTE: Hardcoded to fetch exactly 3 columns. 
  // If the parameter table structure changes (e.g., adding a 4th 'Comments' column),this number needs to be updated.
  return sheet.getRange(1, 1, sheet.getLastRow(), 3).getValues();
}

/**
 * Context Builder: Prepares the specific parameter set for a single simulation iteration.
 * Merges global defaults with yearState-specific overrides (Capacities, Year, etc.).
 * * @param {Object} in_data - Global input data containing base parameters.
 * @param {Object} yearState - The specific yearState configuration to apply.
 * @return {Object} A fully computed parameter object ready for the engine.
 */
function parametersFromYearState(in_data, yearState,i) {
  var params = Object.assign({}, in_data.parameters) //copy

  // Overwrite base defaults with the specific constraints of the current yearState.
  params.currentYear = yearState.year;
  params.solarCapacity = yearState.solarCapacity;
  params.windCapacity = yearState.windCapacity;
  params.storageEnergy = yearState.storageEnergy;
  params.v2gEnergy=yearState.v2gEnergy;
  params.dfsReductionPerHour=yearState.dfsReductionPerHour;
  params.dfsHoursPerYear=yearState.dfsHoursPerYear;
  params.nuclearCapacity=yearState.nuclearCapacity;
  params.wasteToEnergyCapacity=yearState.wasteToEnergyCapacity;
  params.hydrogenProductionCapacity=yearState.hydrogenProductionCapacity;
  params.hydrogenImportCapacity=yearState.hydrogenImportCapacity
  // Technology parameters of this year from 13_tech-params, in the scenario's param_set (in_data.costsDb is a forSet() view)
  update(params, techParamsForYear(in_data.costsDb, yearState.year));
  // Per-scenario settings (30_scenarios-input settings table)
  params.interestRate = in_data.scenarioSettings.interestRate;

  // Constraint: Force Hydrogen storage to 0 in the base year (2025) as infrastructure doesn't exist yet
  if (i==0){
    params.hydrogenStorage=0
  }
  else {
    //hydrogen storage is a global var and is being moved on over ther years
    params.hydrogenStorage=in_data.parameters.hydrogenStorage;
  }
  
  return update(
    update(params, forecastParameters(params, in_data.futureForecast)), 
    internalParameters(params)
  )
};


/**
 * Calculates dynamic simulation variables based on the target year's forecast.
 * Determines the scaling factor needed to project the reference year's hourly shape into the future.
 * * @return {Object} An object containing the absolute demand and the scaling ratio.
 */
function forecastParameters(parameters, futureForecast) {

  // Retrieve the absolute annual demand (in MWh) for the specific simulation year
  var futureForecastDemand=futureForecast[parameters.currentYear].demand;
  return{
    totalEnergyDemandYearly: futureForecastDemand,
    // SCALING LOGIC:
    // We calculate a ratio (Factor) between the future demand and the base reference year.
    // This factor will be used later to multiply every hour of the reference profile,
    // allowing us to simulate future load growth while maintaining the original consumption pattern.
     futureDemandFactor: futureForecastDemand / parameters.totalEnergyDemandYearlyRefYear,
    mustRun: futureForecast[parameters.currentYear].mustRun
  }
}

/**
 * Derived Parameter Calculator: Computes technical constants needed for the physics engine.
 * Converts high-level user inputs into granular operational limits used in the hourly loop.
 */
function internalParameters(parameters) {
  // Guard: depth of discharge must be within 0%-100%
  var dod = Math.min(1, Math.max(0, parameters.storageDepthOfDischarge));
  if (dod !== parameters.storageDepthOfDischarge) {
    console.warn('storageDepthOfDischarge out of range (' +
      parameters.storageDepthOfDischarge + '), clamped to ' + dod);
  }
  return{
    // NOTE: Implicit Assumption! We assume a fixed 4-hour discharge duration for all batteries.
    // Capacity (MW) = Energy (MWh) / 4 hours.
    storageCapacity: parameters.storageEnergy / 4,

    // PHYSICS LOGIC:
    // Input is Round-Trip Efficiency (e.g., 0.81). 
    // We take the square root to get One-Way Efficiency (e.g., 0.9) for separate Charge/Discharge steps.
    storageEfficiencySqrt: Math.sqrt(parameters.storageEfficiency),

    // Operational Limits based on Depth of Discharge (DoD) to protect battery health
    effectiveStorageEnergy: parameters.storageEnergy * dod,
    minStorageEnergy: parameters.storageEnergy * (1 - dod)
  }
}

