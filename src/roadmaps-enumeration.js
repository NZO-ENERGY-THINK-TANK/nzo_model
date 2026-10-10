// Roadmap enumeration: automatic scan of parameter combinations (sheets 20_/21_/22_)
const SHEET_ROADMAP_INPUT = "20_roadmaps-input"
const SHEET_ROADMAP_OUTPUT = "21_roadmaps-output"
const SHEET_ROADMAP_SUMMARY = "22_roadmaps-summary"

var ROADMAPS_OUTPUT_HEADERS = ['name', 'solarCapacity', 'windCapacity', 'storageEnergy','v2gEnergy','nuclearCapacity','wasteToEnergyCapacity','hydrogenImportCapacity','hydrogenProductionCapacity','dfsHoursPerYear','dfsReductionPerHour',  'maxFossilCapacity', 
   'maxRenewableShare', 'solarCost', 'windCost', 'storageCost','v2gCost', 'gasCost','nuclearCost','wasteToEnergyCost','hydrogenCost','dfsCost', 'externalities', 'totalCost']//new************
var ROADMAPS_INPUT_HEADERS = ['parameter', 'val_base', 'min2050', 'max2050', 'interval', 'evaluated'];

/**
 * Data Ingestion Module.
 * Serves as the interface layer between the Spreadsheet UI and the Simulation Engine.
 * * Responsibilities:
 * 1. I/O Extraction: Fetches raw tabular data from the designated input sheet.
 * 2. Data Marshalling: Converts raw row arrays into structured 'ParameterEnumeration' objects.
 * 3. Aggregation: Packages the parsed parameters into a master 'RoadmapsEnumeration' container for sensitivity analysis.
 * * @returns {RoadmapsEnumeration} - The structured input object ready for scenario generation.
 */
function getRoadmapsEnumInput() {
  // 1. Raw Data Retrieval
  // Reads the table based on constant headers definition (SHEET_ROADMAP_INPUT).
  var rows = readTableFromSheet(SHEET_ROADMAP_INPUT, 1, ROADMAPS_INPUT_HEADERS);
  var paramEnums = [];
  // 2. Object Mapping (Marshalling)
  // Iterates through the raw spreadsheet rows and maps columns to object properties.
  rows.forEach(function(row) {
    paramEnums.push(new ParameterEnumeration(
      row[0], // Parameter Name / ID
      row[1], // Start Value (val_base)
      row[2], // min205
      row[3], // max2050
      row[4], // interval
      row[5]  // evaluted
    ));
  });
  // 3. Encapsulation
  // Returns a high-level object that encapsulates the logic for generating permutations based on these parameters.
  return new RoadmapsEnumeration(paramEnums);
};

/**
 * Sensitivity Analysis Iterator.
 * Implements the "Cartesian Product" logic to generate every possible combination of input parameters.
 * * Functionality:
 * Acts as an iterator/cursor that moves through the multi-dimensional parameter space.
 * For each step, it generates a full 'Roadmap' object representing that specific future scenario.
 */
class RoadmapsEnumeration{
  constructor(paramEnums) {
    this.params = paramEnums
    // Mapping: Allows accessing parameters by name (e.g., this['solarCapacity'])
    this.params.forEach(p => this[p.name] = p);// now parameters can be called by  paramEnums.(name of parameter)
    // True when resuming a saved sweep (every parameter already has an 'evaluated' value):
    // the first next() must then advance to the following combination instead of repeating the last one.
    // False on a fresh sweep, where the first next() must return the first combination.
    this.started = paramEnums.length > 0 && paramEnums.every(function(p) { return !isNull(p.evaluated); });
  }

  /**
   * Look-ahead check.
   * Recursive method to determine if there are more combinations left to generate.
   * @param {number} paramIdx - The current parameter dimension being checked.
   * @returns {boolean} - True if more permutations exist.
   */
  hasNext(paramIdx) {
    // Default to the first parameter (index 0)
    if (paramIdx === undefined) {
      paramIdx = 0;
    }
    // Base case: If we passed the last parameter, we are done.
    if (paramIdx === this.params.length) {
      return false;
    }
    // Recursive step: Check if current param has next, or if any subsequent param has next.
    if (this.params[paramIdx].hasNext()) {
      return true;
    }
    return this.hasNext(paramIdx + 1);
  };
  
  /**
   * THE GENERATOR CORE.
   * Advances the internal state to the next combination and constructs the corresponding Roadmap.
   * * Logic: "Odometer Algorithm"
   * Iterates from the right-most parameter to the left.
   * 1. Finds the first parameter that can be incremented.
   * 2. Increments it.
   * 3. Resets all parameters to its right back to their start value.
   * * @returns {Roadmap} - A fully initialized Roadmap object for the new scenario.
   */
  next() {
    // 1. Odometer Logic: Find the "right-most" parameter to advance
    for (var i = this.params.length - 1; i >= 0 ; --i) {
      if (this.params[i].hasNext()) {
        // Advance the specific parameter
        if (this.started){this.params[i].next();}
        // First run special case
        else {this.started=true;}
        // 2. Reset Logic: Reset all "digits" to the right of the changed parameter
        // (Like when a clock changes hour, the minutes reset to 00)
        for (var j = i + 1; j < this.params.length ; ++j) {
          this.params[j].reset();
        }
        // 3. YearState Construction: Extract values and build the Roadmap
        // Defines the target year (2050) and base year (2025)
        var targetParams = {year: 2050};
        var baseParams = {year: 2025};
        // Collect current values from the iterator state
        for (var k = 0; k < this.params.length ; ++k) {
          targetParams[this.params[k].name] = this.params[k].current();
          baseParams[this.params[k].name] = this.params[k].val_base;
        }
        // Instantiate YearState Objects
        var targetYearStateParams = new YearStateParams(targetParams);
        baseParams.name = targetYearStateParams.name;// Ensure consistent naming
        
        var baseYearStateParams = new YearStateParams(baseParams);
        // Generate the interpolation (Timeline) and wrap in a Roadmap object
        return new Roadmap(generateYearStates(baseYearStateParams, targetYearStateParams));
      }
    }
    
    // none of the params have a next value in line, throw exception
    throw new Error('RoadmapsEnumeration index out of bounds error');
  };
  
  /**
   * Progress Tracking.
   * Calculates a unique index representing the current position in the permutation space.
   * Useful for progress bars (e.g., "Scenario 50 of 5000").
   */
  lastIndex() {
    var sum = 0;
    for (var i = 0; i < this.params.length; ++i) {
      if (i > 0) {
        sum *= this.params[i].numValues();
      }
      sum += this.params[i].lastIndex();
    }
    return sum;
  };
  
  toRows() {
    var rows = [];
    this.params.forEach(function(p) { rows.push(p.toRow()); });
    return rows;
  };
};

/**
 * Single Parameter Range Iterator.
 * Manages the state and iteration logic for a specific variable dimension (e.g., Solar Capacity).
 * * Functionality:
 * Converts a continuous numerical range [min, max] into a discrete set of steps based on the defined interval.
 * It maintains its own state ('evaluated') to track progress during the sensitivity analysis loop.
 */
class ParameterEnumeration{
  constructor(name, val_base, min, max, interval, evaluated) {
    this.name = name
    this.val_base = val_base; // Baseline value (starting point for interpolation)
    this.min = min;             // Lower bound of the sensitivity range
    this.max = max;             // Upper bound
    this.interval = Math.max(1,interval);   // Step size

    // The current value in the iteration process. 
    // If null, the iteration hasn't started yet.
    this.evaluated = evaluated;
  };
  
  /**
   * Boundary Check.
   * Determines if the iterator has reached the upper limit of its range.
   * @returns {boolean} - True if there are more steps remaining.
   */
  hasNext() {
    return (this.evaluated !== this.max);
  };
  
  /**
   * State Transition.
   * Advances the parameter to the next discrete value.
   * Includes logic for initialization, incrementing, and boundary clamping.
   */
  next() {
    // 1. Initialization Case: First run
    if (isNull(this.evaluated)) {
      this.evaluated = this.min;

      // 2. Overflow Guard: Prevent stepping beyond max
    } else if (this.evaluated >= this.max) {
      throw new Error('ParameterEnumeration ' + this.name + ' index out of bounds error');
      // 3. Increment Logic
    } else {
      // Use a helper function (increaseAndRound) to handle Floating Point precision errors.
      // (e.g., ensures 0.1 + 0.2 equals 0.3, not 0.30000000004)
      this.evaluated = increaseAndRound(this.evaluated, this.interval, this.interval);
      // 4. Clamping: Ensure we don't overshoot the max due to uneven intervals
      if (this.evaluated > this.max) {
        this.evaluated = this.max
      }
    }
    return this.evaluated;
  };
  
  /**
   * Current Value Accessor.
   * Returns the current state. Initializes to 'min' if called before iteration started.
   */
  current() {
    if (isNull(this.evaluated)) {
      return this.next();
    }
    return this.evaluated;
  };
  
  /**
   * Rewind Mechanism.
   * Resets the iterator back to the start (Min).
   * Crucial for the "Odometer" logic in the parent class (when a higher-order param changes).
   */
  reset() {
    this.evaluated = null;
    this.next();// Immediately set to min
  };
  
  // Serialization for debugging/logging
  toRow(){
    return [this.name, this.val_base, this.min, this.max, this.interval, this.evaluated];
  };
  
  /**
   * Combinatorics Helper.
   * Calculates the total number of steps in this range.
   * Formula: Ceiling((Max - Min) / Interval) + 1
   */
  numValues() {
    return Math.ceil((this.max - this.min)/this.interval + 1);
  };
  
  /**
   * Progress Helper.
   * Returns the current step index (0-based).
   * Used to calculate the global progress percentage of the simulation.
   */
  lastIndex() {
    return Math.ceil((this.evaluated - this.min)/this.interval);
  };
};

/**
 * Simulation Batch Executor.
 * The main driver function that iterates through the generated scenarios and triggers the simulation pipeline.
 * * Engineering Highlight: "Time-Boxing"
 * Implements a safety mechanism to pause execution before hitting the server's hard timeout limit (Google Apps Script ~6 min limit).
 * This allows the simulation to run in "chunks" and resume later (Scalability).
 * * @param {RoadmapsEnumeration} roadmapsEnumState - The iterator holding the state of generated permutations.
 * @param {Object} in_data - Global input data (weather, demand profiles).
 * @param {Object} costsDb - Financial database.
 * @returns {Array<Roadmap>} - A batch of simulated roadmaps completed in this run.
 */
function enumerateRoadmaps(roadmapsEnumState, in_data, costsDb) {
  var roadmaps = [];
  var start = new Date();// Start the execution timer
  
  // TERMINATION CONDITION:
  // Continue ONLY if:
  // 1. There are more scenarios to run (.hasNext)
  // 2. We are still within the safe time window (Time Boxing)
  while (roadmapsEnumState.hasNext() && new Date() - start <= 340000) {//while i havnt cleared all the scenarios
    // 1. Generation: Create the next specific scenario configuration
    roadmap = roadmapsEnumState.next()
    // 2. Physics Simulation: Run the hourly energy balance model (2020-2050)
    roadmap.simulate(in_data);
    // 3. Financial Analysis: Apply costs and calculate NPV based on simulation results
    roadmap.calculateCosts(costsDb, in_data.parameters);
    // 4. Aggregation: Add the completed result to the batch
    roadmaps.push(roadmap);
  }
  return roadmaps;
};

/**
 * Result Aggregator & Filter.
 * Processes the raw simulation output to construct the "Optimal Cost Curve" (Pareto Frontier).
 * * Functionality:
 * 1. Discretization: Groups scenarios into 5% buckets of Renewable Share (e.g., 80-85%, 85-90%).
 * 2. Cost Minimization: Within each bucket, identifies the single scenario with the lowest Total Cost.
 * 3. Secondary Optimization: Uses 'Externalities' as a tie-breaker for scenarios with identical costs.
 * * @param {Array<Roadmap>} roadmapsOutput - The unsorted list of all simulated scenarios.
 * @returns {Array<Roadmap>} - A refined list containing only the most efficient roadmap for each 5% interval.
 */
function summarizeRoadmapsOutput(roadmapsOutput) {
  // Hash Map to store the "Champion" of each category.
  // Key = Renewable Share (e.g., "85"), Value = Best Roadmap Object.
  var cheapestByRenewableShare = {}
  roadmapsOutput.forEach(function(roadmap) {
    // 1. Binning Logic (Histogram Grouping)
    // Formula: Floor(Share * 20) / 20 -> Rounds down to nearest 5%.
    // Example: 87.3% -> 85% bin.
    var renewableShareCategory = Math.trunc(roadmap.maxRenewableShare * 100 / 5) * 5;
    // 2. Selection Logic (King of the Hill)
    // Case A: First entry for this category -> Take it.
    if (!cheapestByRenewableShare.hasOwnProperty(renewableShareCategory)) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
      // Case B: Found a cheaper alternative -> Replace the current champion.
    } else if (roadmap.totalCost < cheapestByRenewableShare[renewableShareCategory].totalCost) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
      // Case C: Costs are identical -> Use Externalities (Pollution Cost) as tie-breaker.
    } else if (roadmap.totalCost == cheapestByRenewableShare[renewableShareCategory].totalCost 
               && roadmap.externalities < cheapestByRenewableShare[renewableShareCategory].externalities) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
    }
  });
  // 3. Flattening
  // Convert the Hash Map back into an ordered Array for plotting.
  var roadmapsSummary = [];
  for (var k in cheapestByRenewableShare) {
    if (cheapestByRenewableShare.hasOwnProperty(k)) {
      roadmapsSummary.push(cheapestByRenewableShare[k]);
    }
  }
  // Reverse to order from High Renewables to Low (or vice versa depending on chart needs)
  return roadmapsSummary.reverse();
};
  
  
/**
 * Results Retrieval Module (Data Access Object).
 * Reads the stored simulation results from the persistence layer (Spreadsheet).
 * * Functionality:
 * Performs "Deserialization" - converts raw table rows back into structured JavaScript objects.
 * This allows the application to visualize or analyze previous runs without re-executing the heavy simulation.
 * * @returns {Array<Object>} - A list of result objects mapped by their header names.
 */
function readRoadmapsOutput() {
  // 1. Raw Data Fetch
  // Retrieves the data grid starting from row 1 (skipping headers if needed, depending on implementation).
  var rows = readTableFromSheet(SHEET_ROADMAP_OUTPUT, 1, ROADMAPS_OUTPUT_HEADERS);
  // 2. Data Transformation (Map Operation)
  // Iterates over every row to transform it from an Array [v1, v2, ...] to an Object {key1: v1, key2: v2}.
  return rows.map(function(r) {
    var roadmap = {}
    // 3. Dynamic Property Mapping
    // Uses the defined constants (ROADMAPS_OUTPUT_HEADERS) to map columns to properties.
    // This makes the code robust: if column order changes in the constants, the mapping adapts automatically.
    ROADMAPS_OUTPUT_HEADERS.forEach(function(h, idx) {
      roadmap[h] = r[idx];
    });
    return roadmap;
  });
}


/**
 * Output Persistence Module.
 * Saves the simulation results to the spreadsheet.
 * * Engineering Highlight: "Append vs. Overwrite" Strategy
 * This function supports the Batch Processing architecture.
 * - If starting from scratch: It clears the sheet and writes headers.
 * - If resuming (startingIndex > 0): It appends data to the bottom without deleting previous results.
 * * @param {Array} roadmaps - The batch of calculated results to save.
 * @param {number} startingIndex - The cursor position. If null/0, implies a fresh run.
 */
function saveRoadmaps(roadmaps, startingIndex) {
  // Default State: "Fresh Start" Mode
  // Assume we are writing from the very beginning (Overwrite everything).
  var startingRow = null;
  var includeHeaders = true;
  var clearContents = true;
  if (!(isNull(startingIndex)) && startingIndex > 0) {
    // Offset Adjustment:
    // Spreadsheets are 1-based, Arrays are 0-based (+1), and row 1 holds the headers (+1).
    startingRow = startingIndex + 2;
    // Optimization:
    // Do not write headers again (they already exist from the first batch).
    includeHeaders = false;
    // Safety:
    // Do NOT clear the sheet, otherwise we lose the previous batches.
    clearContents = false;
  }
  // I/O Operation
  // Delegates the actual API call to a utility function using the configured flags.
  writeToSheet(SHEET_ROADMAP_OUTPUT, ROADMAPS_OUTPUT_HEADERS, roadmaps, startingRow, includeHeaders, clearContents);
}

/**
 * State Persistence Module (Checkpointing).
 * Saves the current progress of the simulation iterator back to the input sheet.
 * * Engineering Purpose: "Checkpointing"
 * Updates the 'evaluated' column in the configuration table.
 * If the simulation crashes or times out, this ensures the next run will skip 
 * the scenarios that were already calculated (Resume capability).
 * * @param {RoadmapsEnumeration} roadmapsEnumState - The iterator object containing current cursor positions.
 */
function saveRoadmapsCalcProgress(roadmapsEnumState) {
  // Serializes the complex iterator state into simple table rows and updates the DB.
  writeToSheet(SHEET_ROADMAP_INPUT, ROADMAPS_INPUT_HEADERS, roadmapsEnumState.toRows(),1,true,false);
}

/**
 * Executive Summary Publisher.
 * Writes the filtered, optimal results (Pareto Frontier) to a dedicated summary sheet.
 * * Engineering Purpose: "Decision Support"
 * Separates the "Raw Data" (thousands of rows) from the "Insights" (best scenario per category).
 * This sheet is likely the data source for the final charts presented to the user.
 * * @param {Array} roadmapsSummary - The list of optimal scenarios (Cheapest per Renewable Share).
 */
function saveRoadmapsSummary(roadmapsSummary) {
  writeToSheet(SHEET_ROADMAP_SUMMARY, ROADMAPS_OUTPUT_HEADERS, roadmapsSummary);
}
