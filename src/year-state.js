const SHEET_SCENARIO_KEYFRAMES = '30_scenarios-input'
const SHEET_YEAR_STATES_OUTPUT = '31_scenarios-yearly'

var DEFAULT_YEAR_STATE_PARAMS = {
  'year': 2050,
  'solarCapacity': 0, 
  'windCapacity': 0,  
  'storageEnergy': 0,
  'storageEfficiency': 0.95,
  'storageDepthOfDischarge': 0.9,
  'v2gEnergy':0,
  'name': undefined,
  'wasteToEnergyCapacity':0,
  'hydrogenProductionCapacity':0,
  'hydrogenImportCapacity':0,
  'hydrogenStorage': 0,
  'nuclearCapacity':0,
  'dfsHoursPerYear':0,
  'dfsReductionPerHour':0,
  'pvShareResidential':0.2,
  'pvShareCommercial':0.2,
  'pvShareUtility':0.3,
  'pvShareDualUse':0.3
};

/**
 * Year state Parameters Data Transfer Object (DTO).
 * Acts as the configuration blueprint for a single simulation run.
 * * Responsibilities:
 * 1. Standardization: Ensures every yearState has a complete set of parameters.
 * 2. Robustness: Implements a "Fallback Mechanism" using DEFAULT_YEAR_STATE_PARAMS to handle missing inputs.
 * 3. Identification: Auto-generates descriptive IDs for unnamed yearStates based on their physical attributes.
 * * @param {Object} raw - The raw input object (potentially partial data).
 */
class YearStateParams{
  constructor(raw) {
    // ITERATIVE INITIALIZATION:
    // Loop through the "Master Template" (DEFAULT_YEAR_STATE_PARAMS) to ensure no parameter is left behind.
    for (var k in DEFAULT_YEAR_STATE_PARAMS) {
      // Safety check: ensure we iterate only over direct properties
      if (!(DEFAULT_YEAR_STATE_PARAMS.hasOwnProperty(k))) {
        continue;
      }
      // FALLBACK LOGIC:
      // If the 'raw' input has the value, use it.
      // Otherwise, fall back to the safe default value.
      // This prevents "undefined" errors deep inside the simulation engine.
      // (isNull, not ||: an explicit 0 must be kept, e.g. a PV share of 0)
      this[k] = isNull(raw[k]) ? DEFAULT_YEAR_STATE_PARAMS[k] : raw[k];
    }
    // DYNAMIC NAMING CONVENTION:
    // If the user didn't provide a specific name, generate a technical ID.
    // Format: "R-[Solar]-[Wind]-[Storage]" (Normalized units).
    // This allows easy identification of yearState characteristics just by looking at the name.
    if (isNull(this.name)) {
      // TODO: refactor name to scenarioName. generate it in Scenario class
      this.name = "R-" + (this.solarCapacity/1000) + "-" + (this.windCapacity/100) + "-" + (this.storageEnergy/1000);
    }
  }

  /**
   * Serialization Utility.
   * Flattens the object properties into an ordered array.
   * Useful for exporting results to CSV, Excel, or tabular logs.
   * @returns {Array} - Ordered list of parameter values.
   */
  toList() {
    return [
      this.name,
      this.year,
      this.solarCapacity,
      this.windCapacity,
      this.storageEnergy,
      this.storageEfficiency,
      this.storageDepthOfDischarge,
      this.v2gEnergy,
      this.nuclearCapacity,
      this.dfsHoursPerYear,
      this.dfsReductionPerHour,
      this.wasteToEnergyCapacity,
      this.hydrogenImportCapacity,
      this.hydrogenProductionCapacity,
      this.pvShareResidential,
      this.pvShareCommercial,
      this.pvShareUtility,
      this.pvShareDualUse
    ];
  }
}

var YEAR_STATE_HEADERS = [
  'year',
  'solarCapacity',
  'windCapacity',
  'nuclearCapacity',
  'wasteToEnergyCapacity',
  'hydrogenImportCapacity',
  'hydrogenProductionCapacity',
  'storageEnergy',
  'storageEfficiency',
  'storageDepthOfDischarge',
  'v2gEnergy',
  'renewableShare',
  'lastCalculationTime',
  'gasGeneration',
  'solarGeneration',
  'windGeneration',
  'nuclearGeneration',
  'wasteToEnergyGeneration',
  'hydrogenGeneration',
  'hydrogenImported',
  'gasInToEnergy',
  'solarInToEnergy',
  'windInToEnergy',
  'nuclearInToEnergy',
  'wasteToEnergyInToEnergy',
  'hydrogenStorage',
  'dfsHoursPerYear',
  'dfsReductionPerHour',
  'storageUsage',
  'v2gUsage',
  'renewableConsumption',
  'maxGasCapacity',
  'maxHydrogenUsageCapacity',
  'maxGasPlusHydrogen',
  'maxStorageCapacity',
  'fossilCapacityWithMargin',
  'curtailedEnergy',
  'missingEnergy',
  'gasConsumption',
  

];
var YEAR_STATE_HEADERS_WITH_COSTS = ['name'].concat(YEAR_STATE_HEADERS).concat([
  'gasCummulative',
  'newSolarCapacity',
  'newWindCapacity',
  'newStorageEnergy',
  'newGasCapacity',
  'newHydrogenProductionCapacity',
  'newGasHydrogenCapacity',
  'solarCapex',
  'solarOpex',
  'windCapex',
  'windOpex',
  'storageCapex',
  'storageOpex',
  'gasCapex',
  'gasOpex',
  'gasVarOpex',
  'gasFuel',
  'gasCo2Cost',
  'gasNoxCost',
  'gasSoxCost',
  'gasPmxCost',
  'nuclearCapex',
  'nuclearOpex',
  'nuclearVarOpex',
  'nuclearFuel',
  'wasteToEnergyCapex',
  'wasteToEnergyOpex',
  'hydrogenProductionCapex',
  'hydrogenProductionOpex',
  'hydrogenProductionVarOpex',
  'hydrogenStorageVarOpex',
  'hydrogenReuseCapex',//new
  'hydrogenFuel',//new
  'externalities',
  'solarTotal',
  'windTotal',
  'storageTotal',
  'gasTotal',
  'nuclearTotal',
  'wasteToEnergyTotal',
  'hydrogenTotal',
  'v2gVarOpex',
  'totalCost',
  'gasCo2',
  'gasCo2Cummulative',
  'gasNox',
  'gasNOXCummulative',
  'gasSox',
  'gasSOXCummulative',
  'gasPmx',
  'gasPmxCummulative',
  'externalitiesCummulativeNPV',
  'gasTotalCummulativeNPV',
  'solarTotalCummulativeNPV',
  'windTotalCummulativeNPV',
  'storageTotalCummulativeNPV',
  'v2gTotalCummulativeNPV',
  'nuclearTotalCummulativeNPV',
  'wasteToEnergyTotalCummulativeNPV',
  'hydrogenTotalCummulativeNPV',
  'totalCostCummulativeNPV',
  'maxNetDemand'
  
]);

var KEYFRAME_HEADERS = [
  'name',
  'year',
  'solarCapacity',
  'windCapacity',
  'storageEnergy',
  'storageEfficiency',
  'storageDepthOfDischarge',
  'v2gEnergy',
  'nuclearCapacity',
  'dfsHoursPerYear',
  'dfsReductionPerHour',
  'wasteToEnergyCapacity',
  'hydrogenImportCapacity',
  'hydrogenProductionCapacity',
  'pvShareResidential',
  'pvShareCommercial',
  'pvShareUtility',
  'pvShareDualUse'
];

//--------------------------------------------------------------------------------------------------
// MODULE: Lifecycle & Depreciation Ledger Initialization
// PURPOSE: Prepares data structures to track 'Replacement Costs' (Re-investment).
// WHY: Infrastructure assets have finite lifespans (e.g., Batteries ~15 years, PV ~25 years).
//      This ledger ensures the model accounts for the cost of replacing aged equipment 
//      during the simulation period (2026-2050), preventing under-estimation of total costs.
//--------------------------------------------------------------------------------------------------
// 1. Initialize Registry Objects
var storageReplacements = {};
var pvReplacements = {};
var windReplacements = {};
var gasReplacements = {};
var nuclearReplacements={};
var wasteToEnergyReplacements={};
var hydrogenProductionCapacityReplacements={};
// 2. Zeroing Loop (Time Horizon: 2025-2050)
for (let year = 2025; year <= 2050; year++) {
    storageReplacements[year] = 0;
    pvReplacements[year] = 0;
    windReplacements[year] = 0;
    gasReplacements[year] = 0;
    nuclearReplacements[year]=0;
    wasteToEnergyReplacements[year]=0;
    hydrogenProductionCapacityReplacements[year]=0;
}
//--------------------------------------------------------------------------------------------------

/**
 * The YearState Class: The Atomic Unit of the Simulation.
 * Represents the state of the energy grid for a specific single year.
 * * Responsibilities:
 * 1. Interpolation: Calculates intermediate states between start and end years.
 * 2. Asset Management: Tracks new builds vs. replacements of old infrastructure.
 * 3. Financial Modeling: Calculates CAPEX (Amortized), OPEX, and Externalities.
 */
class YearState{
  constructor(row, headers) {
    this.headers = headers || YEAR_STATE_HEADERS
    // Map array values to named properties
    for (var j = 0; j < this.headers.length; ++j) {
      this[headers[j]] = row[j];
    }
  }
  
  /**
   * Weighted average of a PV cost parameter (capex / opex / lifetime) over the four PV types,
   * weighted by this year's deployment shares (scenario inputs pvShare*).
   * Throws if the shares do not sum to 1.
   */
  pvAverage(costsDb, parameter) {
    var types = [
      ['pv-residential', this.pvShareResidential],
      ['pv-commercial', this.pvShareCommercial],
      ['pv-utility', this.pvShareUtility],
      ['pv-dual-use', this.pvShareDualUse]
    ];
    var total = 0;
    var weighted = 0;
    for (var i = 0; i < types.length; ++i) {
      var share = types[i][1];
      if (typeof share !== 'number' || isNaN(share) || share < 0) {
        throw new Error('Invalid PV share for ' + types[i][0] + ' in scenario ' + this.name + ', year ' + this.year + ': ' + share);
      }
      total += share;
      var value = costsDb.get(types[i][0], parameter, this.year);
      // PV-Dual-Use capex in the cost data is the construction cost only (roads, agro, etc.);
      // the panels themselves are costed like commercial PV.
      if (types[i][0] === 'pv-dual-use' && parameter === 'capex') {
        value += costsDb.get('pv-commercial', 'capex', this.year);
      }
      weighted += share * value;
    }
    if (Math.abs(total - 1) > 1e-6) {
      throw new Error('PV shares must sum to 1 (scenario ' + this.name + ', year ' + this.year + '): sum=' + total);
    }
    return weighted;
  }

  /**
   * Vectorization Utility.
   * Converts the yearState object into a numerical array (Vector).
   * Required for the mathematical interpolation function.
   */
  toVector() {
    var vector = [];
    Object.entries(this).forEach(([key, value]) => {
      // Exclude metadata (Name) from the math vector
      if (key !== 'name') {
        vector.push(value);
      }
    });
    vector.shift();
    return vector;
  }
  


  /**
   * Linear Interpolation Engine.
   * Fills the gap between the current yearState (e.g., 2030) and a target yearState (e.g., 2035).
   * Creates the "missing years" assuming a linear growth trajectory.
   * * @param {YearState} olderYearState - The starting point (Year X).
   * @returns {Array<YearState>} - The list of generated yearStates for Years X+1 to Y-1.
   */
  interpolate(olderYearState) {
    var interpolated = [];
    // Validation: Ensure time moves forward
    if (olderYearState !== null && this.year >= olderYearState.year + 1) {
      if (olderYearState.name !== this.name) {
        throw "failed interpolating yearStates of different name: older=" + olderYearState.name + " current=" + this.name;
      }
      var pointA = olderYearState.toVector();
      var pointB = this.toVector();
      if (pointA.length !== pointB.length) {
        throw "trying to interpolate yearStates of different type. pointA.length=" + pointA.length + " pointB.length=" + pointB.length;
      }
      // Math: Generate intermediate points
      var newPoints = interpolate([pointA, pointB]);
      // Iterate through the generated points (excluding start and end)
      for (var i = 1; i < newPoints.length - 1; ++i) {
        var newYearState = new YearState(
          [this.name].concat(newPoints[i]),
          this.headers
        );
        // SPECIAL CASE: Nuclear is NOT interpolated linearly.
        // Nuclear plants are discrete, massive projects (Step Function), not continuous growth.
        // We keep it constant until the target year.
        newYearState.nuclearCapacity=olderYearState.nuclearCapacity;
        interpolated.push(newYearState);
      }
    }
    return interpolated;
  }
  
  /**
   * The Financial Core.
   * Calculates the full economic profile of the year.
   * * Logic:
   * 1. Net Capacity Addition = (Current - Previous) + Replacements.
   * 2. Future Liability Registration: When we build today, we schedule a replacement cost for Year + Lifetime.
   * 3. Annuity Calculation: Uses PMT to spread CAPEX over the asset's lifetime.
   */
  calculateCosts(costsDb, previousYear, parameters) {
    // 1. Initialization for the first year (Base Case)
    if (previousYear === null || previousYear === undefined) {
      previousYear = ZERO_YEAR_STATE;
      previousYear.maxfossilCapacityWithMargin=0;
      this.numYears = 0; 
    } else {
      this.numYears = previousYear.numYears + 1;
    }
    // 2. Physical Asset Tracking (New + Replacement)
    // We calculate "How much did we actually buy this year?"
    this.newSolarCapacity = this.solarCapacity - previousYear.solarCapacity + pvReplacements[this.year];
    this.newWindCapacity = this.windCapacity - previousYear.windCapacity + windReplacements[this.year];
    this.newStorageEnergy = this.storageEnergy - previousYear.storageEnergy + storageReplacements[this.year];
    if (previousYear.maxfossilCapacityWithMargin<this.gasPlusHydrogenWithMargin){
       this.newGasCapacity = this.gasPlusHydrogenWithMargin - previousYear.maxfossilCapacityWithMargin + gasReplacements[this.year];
       this.maxfossilCapacityWithMargin=this.gasPlusHydrogenWithMargin}
      
     else {
        this.newGasCapacity = gasReplacements[this.year];
        this.maxfossilCapacityWithMargin=previousYear.  maxfossilCapacityWithMargin;
       }
    if(this.maxHydrogenUsageCapacity>previousYear.maxHydrogenUsageCapacity){
      this.newGasHydrogenCapacity=this.maxHydrogenUsageCapacity-previousYear.maxHydrogenUsageCapacity;}
    else {
      this.newGasHydrogenCapacity=0
      this.maxHydrogenUsageCapacity=previousYear.maxHydrogenUsageCapacity;
    }
  
    this.newNuclearCapacity=this.nuclearCapacity-previousYear.nuclearCapacity+nuclearReplacements[this.year];
    this.newWasteToEnergyCapacity=this.wasteToEnergyCapacity-previousYear.wasteToEnergyCapacity +wasteToEnergyReplacements[this.year];
    this.newHydrogenProductionCapacity=this.hydrogenProductionCapacity-previousYear.hydrogenProductionCapacity+hydrogenProductionCapacityReplacements[this.year];
  //-------------------------------------------------------------------------------------
    // 3. Lifecycle Management (The Ledger)
    // We calculate when these new assets will die, and book the cost in the future replacement ledger.
    let storageNextLifeTime=this.year+costsDb.get('storage', 'lifetime', this.year);
    let solarNextLifeTime=this.year+Math.floor(this.pvAverage(costsDb, 'lifetime'));
    let windNextLifeTime=this.year+costsDb.get('wind', 'lifetime', this.year);
    let gasNextLifeTime=this.year+costsDb.get('ccgt', 'lifetime', this.year);
    let nuclearLifeTime=this.year+costsDb.get('nuclear','lifetime',this.year);
    let wasteToEnergyLifeTime=this.year+costsDb.get('wastetoenergy','lifetime',this.year);
    let hydrogenProductionLifeTime=this.year+costsDb.get('hydrogen-production','lifetime',this.year);
    
    // Register future liabilities
    storageReplacements[storageNextLifeTime]=this.newStorageEnergy;
    pvReplacements[solarNextLifeTime]=this.newSolarCapacity;
    windReplacements[windNextLifeTime]=this.newWindCapacity;
    gasReplacements[gasNextLifeTime]=this.newGasCapacity;
    nuclearReplacements[nuclearLifeTime]=this.newNuclearCapacity;
    wasteToEnergyReplacements[wasteToEnergyLifeTime]=this.newWasteToEnergyCapacity;
    hydrogenProductionCapacityReplacements[hydrogenProductionLifeTime]=this.newHydrogenProductionCapacity
    
    
  //-------------------------------------------------------------------------------------
    // 4. CAPEX & OPEX Calculations (Financial Math)
    // Uses the PMT formula (Annuity) to annualize the Capital Expenditure.
    // Logic: Annual Cost = Loan Payment for New Builds + Loan Payments from Previous Years.

    // --- SOLAR ---// --- SOLAR ---// --- SOLAR ---// --- SOLAR ---// --- SOLAR ---
    this.solarCapex = (
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          this.pvAverage(costsDb, 'lifetime'),
          this.pvAverage(costsDb, 'capex') * this.newSolarCapacity * 1000
        ) 
      + previousYear.solarCapex);
    this.solarOpex = this.solarCapacity * 1000 * this.pvAverage(costsDb, 'opex');
    this.solarTotal = this.solarCapex + this.solarOpex;
    
    // --- WIND // --- WIND ---// --- WIND ---// --- WIND ---// --- WIND ---
    this.windCapex = (
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('wind', 'lifetime', this.year),
          costsDb.get('wind', 'capex', this.year) * this.newWindCapacity * 1000
        ) 
      + previousYear.windCapex);
    this.windOpex = this.windCapacity * 1000 * costsDb.get('wind', 'opex', this.year);
    this.windTotal = this.windCapex + this.windOpex;
    
    // --- STORAGE ---// --- STORAGE ---// --- STORAGE ---// --- STORAGE ---
    this.storageCapex = (
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('storage', 'lifetime', this.year),
          costsDb.get('storage', 'capex', this.year) * this.newStorageEnergy * 1000
        ) 
      + previousYear.storageCapex);
    this.storageOpex = this.storageEnergy * 1000 * costsDb.get('storage', 'opex', this.year);
    this.storageTotal = this.storageCapex + this.storageOpex;

    // --- NUCLEAR  ---// --- NUCLEAR  ---// --- NUCLEAR  ---// --- NUCLEAR ---
    this.nuclearCapex=(
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('nuclear', 'lifetime', this.year),
          costsDb.get('nuclear', 'capex', this.year) * this.newNuclearCapacity * 1000
    )
    + previousYear.nuclearCapex);
    this.nuclearVarOpex=this.nuclearCapacity*1000*365*24*costsDb.get('nuclear', 'var-opex', this.year);
    this.nuclearFuel = this.nuclearCapacity *1000*365*24 * costsDb.get('nuclear', 'fuel', this.year);
    this.nuclearOpex=this.nuclearCapacity*1000*costsDb.get('nuclear','opex',this.year)+this.nuclearVarOpex;
    this.nuclearTotal=this.nuclearCapex+this.nuclearOpex+this.nuclearVarOpex+this.nuclearFuel

    // --- WASTE TO ENERGY ---// --- WASTE TO ENERGY ---// --- WASTE TO ENERGY ---// --- WASTE TO ENERGY ---
    this.wasteToEnergyCapex=(
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('wastetoenergy', 'lifetime', this.year),
          costsDb.get('wastetoenergy', 'capex', this.year) * this.newWasteToEnergyCapacity * 1000
    )
    + previousYear.wasteToEnergyCapex);
    this.wasteToEnergyOpex=this.wasteToEnergyCapacity*1000*costsDb.get('wastetoenergy','opex',this.year);
    this.wasteToEnergyTotal=this.wasteToEnergyCapex+this.wasteToEnergyOpex//new**********

    // --- HYDROGEN  --- // --- HYDROGEN  --- // --- HYDROGEN  --- // --- HYDROGEN  ---
    this.hydrogenProductionCapex = (
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('hydrogen-production', 'lifetime', this.year),
          costsDb.get('hydrogen-production', 'capex', this.year) * this.newHydrogenProductionCapacity * 1000,
        ) 
      + previousYear.hydrogenProductionCapex);
    this.hydrogenProductionOpex = this.hydrogenProductionCapacity * 1000 * costsDb.get('hydrogen-production', 'opex', this.year);
    this.hydrogenProductionVarOpex = this.hydrogenGeneration * 1000 * costsDb.get('hydrogen-production', 'var-opex', this.year);//i pay only when im using for power
    this.hydrogenStorageVarOpex=this.meanHydrogenStorage* 1000 * costsDb.get('hydrogen', 'storage', this.year);
    this.hydrogenusageOpex = this.maxHydrogenUsageCapacity * 1000 * costsDb.get('hydrogen-usage', 'opex', this.year);

    this.hydrogenReuseCapex=(
            -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('ccgt', 'lifetime', this.year),
          costsDb.get('hydrogen-reuse', 'capex', this.year) * this.newGasHydrogenCapacity * 1000,
        ) 
      + previousYear.hydrogenReuseCapex);
    this.hydrogenFuel=this.hydrogenImported * 1000 * costsDb.get('hydrogen', 'fuel', this.year);
    

    this.hydrogenTotal=
       this.hydrogenProductionCapex  
      +this.hydrogenProductionOpex  
      +this.hydrogenStorageVarOpex  
      +this.hydrogenProductionVarOpex
      +this.hydrogenusageOpex
      +this.hydrogenReuseCapex
      +this.hydrogenFuel

    // --- V2G  ---// --- V2G  ---// --- V2G  ---// --- V2G  ---
    // Only Variable OPEX (wear and tear), assuming the car CAPEX is paid by the consumer.
    this.v2gVarOpex= this.v2gUsage * 1000 * costsDb.get('v2g', 'var-opex', this.year);

    // --- FOSSIL FUELS (Gas/CCGT) & EXTERNALITIES ---// --- FOSSIL FUELS (Gas/CCGT) & EXTERNALITIES ---
    this.gasCapex = (
      -1 * PMT(
          costsDb.get('financial', 'wacc', this.year),
          costsDb.get('ccgt', 'lifetime', this.year),
          costsDb.get('ccgt', 'capex', this.year) * this.newGasCapacity * 1000,
        ) 
      + previousYear.gasCapex);
    this.gasOpex = this.fossilCapacityWithMargin * 1000 * costsDb.get('ccgt', 'opex', this.year);
    this.gasVarOpex = this.fossilGeneration * 1000 * costsDb.get('ccgt', 'var-opex', this.year);
    this.gasFuel = this.fossilGeneration * 1000 * costsDb.get('ccgt', 'fuel', this.year);
    // Pollution Calculation
    this.gasCo2 = this.fossilGeneration * costsDb.get('ccgt-emissions', 'co2', this.year) / 1000;
    this.gasNox = this.fossilGeneration * costsDb.get('ccgt-emissions', 'nox', this.year) / 1000;
    this.gasSox = this.fossilGeneration * costsDb.get('ccgt-emissions', 'sox', this.year) / 1000;
    this.gasPmx = this.fossilGeneration * costsDb.get('ccgt-emissions', 'pmx', this.year) / 1000;
    // Pollution Pricing (Externalities)
    this.gasCo2Cost = this.gasCo2 * costsDb.get('emissions', 'co2', this.year);
    this.gasCo2Cummulative=previousYear.gasCo2Cummulative+this.gasCo2
    this.gasNoxCost = this.gasNox * costsDb.get('emissions', 'nox', this.year);
    this.gasNOXCummulative=previousYear.gasNOXCummulative+this.gasNox
    this.gasSoxCost = this.gasSox * costsDb.get('emissions', 'sox', this.year);
    this.gasSOXCummulative=previousYear.gasSOXCummulative+this.gasSox
    this.gasPmxCost = this.gasPmx * costsDb.get('emissions', 'pmx', this.year);
    this.gasPmxCummulative=previousYear.gasPmxCummulative+this.gasPmx
    this.externalities = this.gasCo2Cost + this.gasNoxCost + this.gasSoxCost + this.gasPmxCost;
    this.gasTotal = this.gasCapex + this.gasOpex + this.gasVarOpex + this.gasFuel;
    this.gasCummulative=previousYear.gasCummulative+this.gasConsumption;
    
    // Demand Side Management Cost
    this.dfsTotal=this.dfsHoursPerYear*1000*this.dfsReductionPerHour*costsDb.get('dfs', 'dfs-per-kwh', this.year);
    
    // --- TOTAL SYSTEM COST ---
    this.totalCost = this.solarTotal + this.windTotal + this.storageTotal + this.gasTotal + this.externalities+this.nuclearTotal+this.wasteToEnergyTotal+this.hydrogenTotal+this.dfsTotal+this.v2gVarOpex//new*********;
    // also calculate cummulative NPV

    // 5. Net Present Value (NPV) Aggregation
    // Discounting future cash flows to today's value for fair comparison.
    this.solarTotalCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.solarTotalCummulativeNPV, this.solarTotal, this.numYears);
    this.windTotalCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.windTotalCummulativeNPV, this.windTotal, this.numYears);
    this.storageTotalCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.storageTotalCummulativeNPV, this.storageTotal, this.numYears);
    this.v2gTotalCummulativeNPV=NPVcumulative(parameters.interestRate,previousYear.v2gTotalCummulativeNPV,this.v2gVarOpex,this.numYears)
    this.externalitiesCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.externalitiesCummulativeNPV, this.externalities, this.numYears);
    this.gasTotalCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.gasTotalCummulativeNPV, this.gasTotal, this.numYears);
    this.nuclearTotalCummulativeNPV=NPVcumulative(parameters.interestRate,previousYear.nuclearTotalCummulativeNPV,this.nuclearTotal,this.numYears);//new***
    this.wasteToEnergyTotalCummulativeNPV=NPVcumulative(parameters.interestRate,previousYear.wasteToEnergyTotalCummulativeNPV,this.wasteToEnergyTotal,this.numYears)
    this.hydrogenTotalCummulativeNPV=NPVcumulative(parameters.interestRate,previousYear.hydrogenTotalCummulativeNPV,this.hydrogenTotal,this.numYears)
    this.totalCostCummulativeNPV = NPVcumulative(parameters.interestRate, previousYear.totalCostCummulativeNPV, this.totalCost, this.numYears);  
  }
}

/**
 * The "Null Object" (Bootstrap YearState).
 * Creates a static YearState instance where all values are initialized to 0.
 * * Engineering Purpose: "Boundary Condition Handling"
 * This object solves the "Chicken and Egg" problem of the first simulation year.
 * When calculating the delta for 2026 (Current - Previous), there is no 2025.
 * Instead of checking for nulls in every formula, we simply subtract this ZERO_YEAR_STATE.
 * (e.g., 2026 Capacity - 0 = 2026 Capacity).
 */
var ZERO_YEAR_STATE = new YearState(
                                  // Functional Programming: Maps every header string to the number 0.
                                  // Result: [0, 0, 0, 0, ...] 
                                  YEAR_STATE_HEADERS_WITH_COSTS.map(function(x) { return 0; }), YEAR_STATE_HEADERS_WITH_COSTS
                                  );  

/**
 * Manual Scenario Loader & Interpolator.
 * Reads user-defined milestones from the input sheet and reconstructs the full timeline.
 * * Engineering Concept: "Keyframe Interpolation" / "Piecewise Linear Construction"
 * Instead of defining every single year manually, the user defines 'Key Years' (Nodes).
 * This function iterates through these nodes and generates the intermediate years 
 * to create a continuous, year-by-year simulation trajectory.
 * * @returns {Array<Scenario>} - Structured Scenario objects ready for simulation.
 */
function readScenariosFromKeyframes() {
  // 1. Raw Data Ingestion
  assertScenarioLayout();
  var rows = readTableFromSheet(SHEET_SCENARIO_KEYFRAMES, KEYFRAMES_HEADER_ROW, KEYFRAME_HEADERS);
  var yearStates = [];
  var lastYearState = null;
  // 2. Sequential Processing
  rows.forEach(function(r) {
    // Create the current node (Node B)
    var currentYearState = new YearState(r, KEYFRAME_HEADERS);//creating a yearState
    // 3. Gap Filling (The Bridge)
    // If there is a previous node, calculate all years between Node A and Node B.
    // Example: User defined 2030 and 2040 -> This generates 2031-2039.
    var interpolatedYearStates = currentYearState.interpolate(lastYearState);//creating yearStates from the current one 
    // Add the intermediate years to the main list
    interpolatedYearStates.forEach(function(s) { yearStates.push(s); });
    // Add the current explicit node (Keyframe)
    yearStates.push(currentYearState);
    // Update cursor for the next iteration
    lastYearState = currentYearState;
  });
  // 4. Factory Assembly
  // Group the flat list of years into organized Scenario objects.
  return applyScenarioSettings(groupYearsIntoScenarios(yearStates));
}

/**
 * Result Synchronization Module.
 * Transfers the aggregated results from the hourly simulation engine back to the persistent YearState object.
 * * Engineering Purpose: "Data Binding"
 * Maps the calculated physical values (Energy flows, Reliability metrics) 
 * into the structural object required for the Financial Analysis phase.
 * * @param {Object} yearState - The persistent container for the specific year (Target).
 * @param {Object} year_summary - The transient accumulator object holding hourly simulation totals (Source).
 */
function _updateYearStateWithResults(yearState, year_summary) {
  // 1. Generation Mix Mapping (Production)
  // Extracts total MWh produced by each technology.
  yearState.mustRun = year_summary.mustRun.value;
  yearState.fossilGeneration = year_summary.fossilGeneration.value
  yearState.solarGeneration = year_summary.solarGeneration.value;
  yearState.windGeneration = year_summary.windGeneration.value;
  yearState.gasInToEnergy = year_summary.gasInToEnergy.value;
  yearState.solarInToEnergy = year_summary.solarInToEnergy.value;
  yearState.windInToEnergy = year_summary.windInToEnergy.value;
  yearState.nuclearInToEnergy = year_summary.nuclearInToEnergy.value;
  yearState.wasteToEnergyInToEnergy = year_summary.wasteToEnergyInToEnergy.value;
  yearState.storageUsage = year_summary.storageUtilization.value;
  yearState.v2gUsage=year_summary.v2gUsage.value;
  yearState.renewableConsumption = year_summary.renewableConsumption.value;
  yearState.renewableShare = year_summary.renewableShare.value;
  yearState.maxGasCapacity = year_summary.maxGasCapacity.value;
  yearState.maxHydrogenUsageCapacity = year_summary.maxHydrogenUsageCapacity.value;
  yearState.maxGasPlusHydrogen=year_summary.maxGasPlusHydrogen.value;
  yearState.maxStorageCapacity = year_summary.maxStorageCapacity.value;
  yearState.fossilCapacityWithMargin = year_summary.fossilCapacityWithMargin.value;
  yearState.gasPlusHydrogenWithMargin=year_summary.gasPlusHydrogenWithMargin.value
  yearState.curtailedEnergy = year_summary.curtailedEnergy.value;
  yearState.missingEnergy = year_summary.missingEnergy.value;
  yearState.maxNetDemand = year_summary.maxNetDemand.value;
  yearState.gasGeneration = year_summary.fossilGeneration.value;
  yearState.nuclearGeneration=year_summary.nuclearGeneration.value;
  yearState.wasteToEnergyGeneration=year_summary.wasteToEnergyGeneration.value;
  yearState.hydrogenGeneration=year_summary.hydrogenGeneration.value;
  yearState.hydrogenImported=year_summary.hydrogenImported.value;
  yearState.meanHydrogenStorage=year_summary.meanHydrogenStorage.value;
  yearState.hydrogenStorage=year_summary.hydrogenStorage.value;
  yearState.gasConsumption=year_summary.gasConsumption.value;
  
};

/**
 * Detailed Results Exporter.
 * Writes the granular, year-by-year simulation results to the output sheet.
 * * Engineering Purpose: "Transparency & Auditing"
 * Unlike the summary views, this function dumps the full internal state of every simulated year.
 * It allows engineers to inspect the trajectory (2020->2050) and verify the interpolation 
 * and cost accumulation logic manually if needed.
 * * @param {Array<YearState>} yearStates - The complete timeline of yearState objects to be serialized.
 */
function saveYearStatesOutput(yearStates) {
  writeToSheet(SHEET_YEAR_STATES_OUTPUT, YEAR_STATE_HEADERS_WITH_COSTS, yearStates);
};




/**
 * Timeline Generator Module.
 * Constructs a full chronological scenario by bridging the gap between the start year and the target year.
 * * Functionality:
 * 1. Instantiation: Converts raw parameters into structured 'YearState' objects.
 * 2. Linear Interpolation: Calculates all intermediate years (e.g., 2024-2049).
 * 3. Assembly: Concatenates [Start] + [Intermediate] + [End] into a single timeline array.
 * * @param {YearStateParams} baseYearStateParams - The starting point (Baseline / Current Status).
 * @param {YearStateParams} targetYearStateParams - The goal (Target Year configuration).
 * @returns {Array<YearState>} - An ordered array of YearState objects representing the full transition path.
 */
function generateYearStates(baseYearStateParams, targetYearStateParams) {
  // 1. Object Factory: Create YearState instances from Data Transfer Objects
  // We explicitly assume KEYFRAME_HEADERS is a global constant defining the data structure.
  var baseYearState = new YearState(baseYearStateParams.toList(), KEYFRAME_HEADERS);
  var targetYearState = new YearState(targetYearStateParams.toList(), KEYFRAME_HEADERS);
  // 2. Initialize Timeline
  // Start the array with the Base Year (e.g., 2023)
  var yearStates = [baseYearState];
  // 3. Fill the Gap (The Bridge)
  // Generates the intermediate years. 
  // CRITICAL DEPENDENCY: The 'interpolate' method must return exclusive years (Start < Year < End).
  var interpolatedYearStates = targetYearState.interpolate(baseYearState);
  // 4. Merge Intermediate Years
  // Note: 'concat' returns a new array, re-assignment is necessary.
  yearStates = yearStates.concat(interpolatedYearStates);
  // 5. Finalize Timeline
  // BUG WATCH: Ensure 'interpolatedYearStates' did not already include the target year.
  // If 'interpolate' is inclusive, this line creates a duplicate 2050 yearState.
  yearStates.push(targetYearState);
  return yearStates;
};
