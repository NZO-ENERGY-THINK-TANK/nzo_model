/**
 * The Scenario Class: The Strategic Manager.
 * Represents a long-term energy transition plan (e.g., 2025-2050).
 * It acts as a container for a series of yearly 'Year states'.
 * * Responsibilities:
 * 1. Orchestration: Runs the simulation for each year sequentially.
 * 2. Financial Aggregation: Calculates Net Present Value (NPV) for the entire project life-cycle.
 * 3. Target Tracking: Keeps track of the final goals (Capacity in 2050).
 */
class Scenario{

    constructor(yearStates) {
    // Basic validation: Ensure all yearStates belong to the same project name
    this.name = yearStates[0].name
    // We store the parameters of the LAST yearState (target year) 
    // to easily see where this scenario leads (e.g., "How much solar do we end up with?").
    this.solarCapacity = yearStates[yearStates.length - 1].solarCapacity
    this.windCapacity = yearStates[yearStates.length - 1].windCapacity
    this.storageEnergy = yearStates[yearStates.length - 1].storageEnergy
    this.nuclearCapacity=yearStates[yearStates.length -1].nuclearCapacity
    this.wasteToEnergyCapacity=yearStates[yearStates.length-1].wasteToEnergyCapacity
    this.v2gEnergy=yearStates[yearStates.length -1].v2gEnergy
    this.hydrogenProductionCapacity=yearStates[yearStates.length-1].hydrogenProductionCapacity
    this.hydrogenImportCapacity=yearStates[yearStates.length-1].hydrogenImportCapacity
    this.dfsHoursPerYear=yearStates[yearStates.length -1].dfsHoursPerYear
    this.dfsReductionPerHour=yearStates[yearStates.length -1].dfsReductionPerHour
    // Initialize containers
    this.yearStateByYear = {}
    this.years = yearStates
    // Initialize Financial KPIs (to be calculated later)
    this.solarCost = null
    this.windCost = null
    this.storageCost = null
    this.v2gCost=null
    this.gasCost = null
    this.nuclearCost=null
    this.wasteToEnergyCost=null
    this.dfsCost=null
    this.hydrogenCost=null
    this.externalities = null
    this.totalCost = null
    // Performance Metrics
    this.maxFossilCapacity = 0
    this.maxRenewableShare = 0

    // Map array to object for O(1) access by year
    for (var i = 0; i < yearStates.length; i++) {
      if (yearStates[i].name !== this.name) {
        throw "yearState.name (" + yearStates[i].name + ") is different from Scenario name (" + this.name + ")";
      }
      this.yearStateByYear[yearStates[i].year] = yearStates[i];
    }
  }
  
  /**
   * PHYSICS ENGINE TRIGGER
   * Iterates through every year in the scenario and runs the energy simulation.
   * @param {Object} in_data - The global input data (weather patterns, demand curves).
   */
  simulate(in_data) {
    let scen_data = Object.assign({}, in_data)//copy
    for (var i = 0; i < this.years.length; ++i) {
      var yearState = this.years[i];
      // OPTIMIZATION:
      // If this year was already simulated (has a timestamp), skip it.
      // Saves time when re-running the tool.
      if (yearState.lastCalculationTime !== '' && yearState.lastCalculationTime !== undefined) {
        continue;
      }
      // 1. Prepare Parameters: Merge global data with specific year settings
      scen_data.parameters = parametersFromYearState(scen_data, yearState,i);

      // 2. RUN SIMULATION: This calls the heavy-lifting functions (_applyDfs, _calculateStorage, etc.)
      // returns the 'yearlySummary' object we analyzed in previous steps.
      let {yearlySummary} = calculateYear(scen_data)
      
      // 3. Save Results: Inject the calculated stats back into the yearState object
      _updateYearStateWithResults(yearState, yearlySummary);
      yearState.lastCalculationTime = new Date();
    }
  }
  

  /**
   * FINANCIAL ENGINE (The CFO)
   * Aggregates costs from all years and applies Discount Rate (NPV).
   * Unlike simple summation, this accounts for the "Time Value of Money".
   * * @param {Object} costsDb - Database of technology costs (CAPEX/OPEX) per year.
   * @param {Object} parameters - Contains the 'interestRate' (Discount Rate).
   */
  calculateCosts(costsDb, parameters) {
    // Temporary arrays to hold the cash flow for each category over the years
    var byYear = {
      solarCost: [],
      windCost: [],
      storageCost: [],
      v2gCost:[],
      gasCost: [],
      nuclearCost:[],
      wasteToEnergyCost:[],
      dfsCost:[],
      hydrogenCost:[],
      externalities: [],
      totalCost: [],
      fossilCapacity: [],
      renewableShare: []
    }  
    var previous = null;// Used to calculate incremental CAPEX (new builds only)

    // 1. Calculate Annual Costs for each yearState
    this.years.forEach(current => {
      // Delegate the specific year calculation to the YearState class
      current.calculateCosts(costsDb, previous, parameters);
      // Push results to the timeline arrays
      byYear.solarCost.push(current.solarTotal);
      byYear.windCost.push(current.windTotal);
      byYear.storageCost.push(current.storageTotal);
      byYear.v2gCost.push(current.v2gVarOpex);// Only Variable OPEX for V2G (assuming car is bought anyway)
      byYear.gasCost.push(current.gasTotal);
      byYear.nuclearCost.push(current.nuclearTotal);
      byYear.wasteToEnergyCost.push(current.wasteToEnergyTotal);
      byYear.dfsCost.push(current.dfsTotal);
      byYear.hydrogenCost.push(current.hydrogenTotal);
      byYear.externalities.push(current.externalities);
      byYear.totalCost.push(current.totalCost);
      // Track operational stats
      byYear.fossilCapacity.push(current.fossilCapacityWithMargin);
      byYear.renewableShare.push(current.renewableShare);
      // Set current as previous for the next iteration
      previous = current;
    });
    // 2. Calculate NPV (Net Present Value)
    // Formula: Sum [ Cost_t / (1 + i)^t ]
    // This gives the "Total Lifecycle Cost" in today's money.
    this.solarCost = NPV(parameters.interestRate, byYear.solarCost);
    this.windCost = NPV(parameters.interestRate, byYear.windCost);
    this.storageCost = NPV(parameters.interestRate, byYear.storageCost);
    this.v2gCost=NPV(parameters.interestRate, byYear.v2gCost);
    this.gasCost = NPV(parameters.interestRate, byYear.gasCost);
    this.nuclearCost=NPV(parameters.interestRate,byYear.nuclearCost);
    this.wasteToEnergyCost=NPV(parameters.interestRate,byYear.wasteToEnergyCost);//new********
    this.dfsCost=NPV(parameters.interestRate,byYear.dfsCost);
    this.hydrogenCost=NPV(parameters.interestRate,byYear.hydrogenCost);
    this.externalities = NPV(parameters.interestRate, byYear.externalities);
    this.totalCost = NPV(parameters.interestRate, byYear.totalCost);
    // Find peaks across the entire scenario timeline
    this.maxFossilCapacity = byYear.fossilCapacity[byYear.fossilCapacity.length - 1];
    this.maxRenewableShare = Math.max(...byYear.renewableShare);
    
  };
  
};

/**
 * Scenario Factory Module.
 * Responsible for data pre-processing and structural organization.
 * Transforms a flat, unstructured list of Year states into logical 'Scenario' objects.
 * * @param {Array} yearStates - The raw input array containing all yearState objects mixed together.
 * @returns {Array<Scenario>} - An array of initialized Scenario instances, grouped by name.
 */
function groupYearsIntoScenarios(yearStates) {
  // 1. Initialization: Create a Hash Map for efficient grouping.
  // Key = Scenario Name, Value = Array of Year states belonging to that scenario.
  var yearsByScenario = {};
  // 2. Aggregation Loop: Iterate through the raw data.
  for (var i = 0; i < yearStates.length; ++i) {
    // Check if the bucket for this specific scenario name exists.
    // If not, initialize it with an empty array.
    if (!(yearsByScenario.hasOwnProperty(yearStates[i].name))) {
      yearsByScenario[yearStates[i].name] = [];
    }
    // Push the current yearState into the correct bucket.
    yearsByScenario[yearStates[i].name].push(yearStates[i]);
  }
  var scenarios = []
  // 3. Instantiation Loop: Convert raw groups into Scenario Class Instances.
  for (var name in yearsByScenario) {
    scenarios.push(new Scenario(yearsByScenario[name]));
  }
  return scenarios;
};


