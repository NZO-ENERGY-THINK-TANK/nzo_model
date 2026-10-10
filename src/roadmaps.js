/**
 * The Roadmap Class: The Strategic Manager.
 * Represents a long-term energy transition plan (e.g., 2025-2050).
 * It acts as a container for a series of yearly 'Scenarios'.
 * * Responsibilities:
 * 1. Orchestration: Runs the simulation for each year sequentially.
 * 2. Financial Aggregation: Calculates Net Present Value (NPV) for the entire project life-cycle.
 * 3. Target Tracking: Keeps track of the final goals (Capacity in 2050).
 */
class Roadmap{

    constructor(scenarios) {
    // Basic validation: Ensure all scenarios belong to the same project name
    this.name = scenarios[0].name
    // We store the parameters of the LAST scenario (target year) 
    // to easily see where this roadmap leads (e.g., "How much solar do we end up with?").
    this.solarCapacity = scenarios[scenarios.length - 1].solarCapacity
    this.windCapacity = scenarios[scenarios.length - 1].windCapacity
    this.storageEnergy = scenarios[scenarios.length - 1].storageEnergy
    this.nuclearCapacity=scenarios[scenarios.length -1].nuclearCapacity
    this.wasteToEnergyCapacity=scenarios[scenarios.length-1].wasteToEnergyCapacity
    this.v2gEnergy=scenarios[scenarios.length -1].v2gEnergy
    this.hydrogenProductionCapacity=scenarios[scenarios.length-1].hydrogenProductionCapacity
    this.hydrogenImportCapacity=scenarios[scenarios.length-1].hydrogenImportCapacity
    this.dfsHoursPerYear=scenarios[scenarios.length -1].dfsHoursPerYear
    this.dfsReductionPerHour=scenarios[scenarios.length -1].dfsReductionPerHour
    // Initialize containers
    this.yearStateByYear = {}
    this.years = scenarios
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
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i].name !== this.name) {
        throw "scenario.name (" + scenarios[i].name + ") is different from Roadmap name (" + this.name + ")";
      }
      this.yearStateByYear[scenarios[i].year] = scenarios[i];
    }
  }
  
  /**
   * PHYSICS ENGINE TRIGGER
   * Iterates through every year in the roadmap and runs the energy simulation.
   * @param {Object} in_data - The global input data (weather patterns, demand curves).
   */
  simulate(in_data) {
    let scen_data = Object.assign({}, in_data)//copy
    for (var i = 0; i < this.years.length; ++i) {
      var scenario = this.years[i];
      // OPTIMIZATION:
      // If this year was already simulated (has a timestamp), skip it.
      // Saves time when re-running the tool.
      if (scenario.lastCalculationTime !== '' && scenario.lastCalculationTime !== undefined) {
        continue;
      }
      // 1. Prepare Parameters: Merge global data with specific year settings
      scen_data.parameters = parametersFromYearState(scen_data, scenario,i);

      // 2. RUN SIMULATION: This calls the heavy-lifting functions (_applyDfs, _calculateStorage, etc.)
      // returns the 'yearlySummary' object we analyzed in previous steps.
      let {yearlySummary} = calculateYear(scen_data)
      
      // 3. Save Results: Inject the calculated stats back into the scenario object
      _updateYearStateWithResults(scenario, yearlySummary);
      scenario.lastCalculationTime = new Date();
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

    // 1. Calculate Annual Costs for each scenario
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
    // Find peaks across the entire roadmap timeline
    this.maxFossilCapacity = byYear.fossilCapacity[byYear.fossilCapacity.length - 1];
    this.maxRenewableShare = Math.max(...byYear.renewableShare);
    
  };
  
};

/**
 * Roadmap Factory Module.
 * Responsible for data pre-processing and structural organization.
 * Transforms a flat, unstructured list of Scenarios into logical 'Roadmap' objects.
 * * @param {Array} scenarios - The raw input array containing all scenario objects mixed together.
 * @returns {Array<Roadmap>} - An array of initialized Roadmap instances, grouped by name.
 */
function groupYearsIntoRoadmaps(scenarios) {
  // 1. Initialization: Create a Hash Map for efficient grouping.
  // Key = Roadmap Name, Value = Array of Scenarios belonging to that roadmap.
  var yearsByRoadmap = {};
  // 2. Aggregation Loop: Iterate through the raw data.
  for (var i = 0; i < scenarios.length; ++i) {
    // Check if the bucket for this specific roadmap name exists.
    // If not, initialize it with an empty array.
    if (!(yearsByRoadmap.hasOwnProperty(scenarios[i].name))) {
      yearsByRoadmap[scenarios[i].name] = [];
    }
    // Push the current scenario into the correct bucket.
    yearsByRoadmap[scenarios[i].name].push(scenarios[i]);
  }
  var roadmaps = []
  // 3. Instantiation Loop: Convert raw groups into Roadmap Class Instances.
  for (var name in yearsByRoadmap) {
    roadmaps.push(new Roadmap(yearsByRoadmap[name]));
  }
  return roadmaps;
};


