/**
 * @OnlyCurrentDoc Limits the script to only accessing the current sheet.
 */
function onOpen() {
  buildMenu();
}

function onEdit(e) {
  // Only rebuild menu if edit happened in parameters sheet
  if (e.range.getSheet().getName() === SHEET_PARAMETERS) {
    try {
      buildMenu();
    } catch (err) {
      console.warn('buildMenu failed in onEdit: ' + err);
    }
  }
}

function buildMenu() {//saveRoadmap
  var spreadsheet = SpreadsheetApp.getActive();
  var menuItems = [
    {name: `Predict Year: ${getParameters().currentYear}` , functionName: 'predictYear'},
    {name: 'Calculate Costs', functionName: 'calculateCosts'},
    {name: 'Enumerate Roadmaps', functionName: 'enumerateAndCompareRoadmaps'},
    {name: 'Summarize Roadmaps', functionName: 'summarizeRoadmaps'},
    {name: 'save Roadmap', functionName: 'saveRoadmap'},
    {name: 'Calculate Scenarios and Costs', functionName: 'calculateScenariosAndCosts'},
    // {name: 'sensitivity Analysis', functionName: 'sensitivityAnalysis'},
    // {name: 'stochastic Analysis',functionName: 'stochasticAnalysis'}
  ];
  var menu = SpreadsheetApp.getUi().createMenu('NZO Model');
  menuItems.forEach(function(item) { menu.addItem(item.name, item.functionName); });
  menu.addSubMenu(SpreadsheetApp.getUi().createMenu('Advanced')
    .addItem('Run reference test', 'runReferenceTest')
    .addItem('Record reference test', 'recordReferenceTest')
    .addSeparator()
    .addItem('Update data hash', 'updateDataHash')
    .addItem('Check data status', 'checkDataStatus'));
  menu.addToUi();
};



/**
 * Main function: Orchestrates the simulation process for a specific year.
 * Flows from data input -> calculation -> saving results.
 **/
function predictYear() {
  // 1. Fetch all necessary parameters and settings from the spreadsheet
  var in_data = getInputData();

  // 2. Execute the core logic: Calculate energy balance 
  var predictions = calculateYear(in_data);

  // 3. Write the detailed results back to the 'Outputs' sheet
  savePredictions(in_data, predictions);

  // 4. Archive high-level results to the history log for comparison
  logRunToHistory();

  // 5. Force an immediate UI update so the user sees results instantly
  SpreadsheetApp.flush();
};

/**
 * Runs the financial calculation module.
 * Retrieves unit costs and computes total project CAPEX/OPEX.
 */
function calculateCosts() {
 var costsDb = getCostsDb();
 saveCosts(costsDb);
 SpreadsheetApp.flush();
};

/**
 * Batch Processor: Executes simulation and financial analysis for ALL defined roadmaps.
 * Aggregates results from multiple scenarios into a single master output.
 */
function calculateScenariosAndCosts() {
  var in_data = getInputData();
  var roadmaps = readRoadmapsFromKeyframes();
  var costsDb = getCostsDb();

  var allYearStates = []
  roadmaps.forEach(function(roadmap) {
    roadmap.simulate(in_data);
    roadmap.calculateCosts(costsDb, in_data.parameters);
    allYearStates = allYearStates.concat(roadmap.years);
  });
  // Flatten results: Append current roadmap's scenarios to the master list

  saveYearStatesOutput(allYearStates);
  saveCosts(costsDb);
  SpreadsheetApp.flush();
};

/**Optimization
 * Sensitivity Analysis Engine: Generates and evaluates roadmaps based on parameter ranges (Min/Max/Interval).
 * Supports 'resumable execution' to handle long runs exceeding Google's 6-minute limit.
 */
function enumerateAndCompareRoadmaps() {
  var in_data = getInputData();

  // Fetch configuration object defining the search space (e.g., Solar: 60k-130k, steps of 10k)
  var roadmapsEnumState = getRoadmapsEnumInput();

  // Resume Logic: when resuming a saved sweep, startingIndex is the 0-based index of the first
  // combination that is NOT yet in the output sheet. A fresh sweep starts from 0.
  var startingIndex = roadmapsEnumState.started ? roadmapsEnumState.lastIndex() + 1 : 0;
  var costsDb = getCostsDb();

  // Generate the specific batch of roadmaps for this iteration
  var roadmaps = enumerateRoadmaps(roadmapsEnumState, in_data, costsDb);
  saveRoadmaps(roadmaps, startingIndex);

  // Checkpoint: Save the progress index so the next run knows where to start
  saveRoadmapsCalcProgress(roadmapsEnumState);
  SpreadsheetApp.flush();
};

/**
 * Post-Processing: Aggregates raw roadmap data into high-level KPIs.
 * Transforms detailed simulation outputs into a summary table for easier comparison.
 */
function summarizeRoadmaps() {
  var roadmaps = readRoadmapsOutput();

  var roadmapsSummary = summarizeRoadmapsOutput(roadmaps);

  saveRoadmapsSummary(roadmapsSummary);
};

function saveRoadmap(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var saveSheet = getOrCreateSheet(SHEET_SAVED_ROADMAPS);
  saveRoadmapToSheet(ss,saveSheet)

}
