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

function buildMenu() {
  var spreadsheet = SpreadsheetApp.getActive();
  var menu = SpreadsheetApp.getUi().createMenu('NZO Model');
  menu.addItem(`Predict Year: ${getParameters().currentYear}` , 'predictYear');
  menu.addItem('Calculate Scenarios and Costs', 'calculateScenariosAndCosts');
  menu.addSeparator();
  menu.addItem('Sync from master', 'syncFromMaster');
  menu.addSubMenu(SpreadsheetApp.getUi().createMenu('Advanced')
    .addItem('Run reference test', 'runReferenceTest')
    .addItem('Record reference test', 'recordReferenceTest')
    .addSeparator()
    .addItem('Set up scenario settings', 'createScenarioSettingsTable')
    .addSeparator()
    .addItem('Update data hash', 'updateDataHash')
    .addItem('Check data status', 'checkDataStatus')
    .addSeparator()
    .addItem('Apply design scheme', 'applyDesignScheme'));
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

  // 6. Switch to the run summary
  SpreadsheetApp.setActiveSheet(getOrCreateSheet(SHEET_SUMMARY));
};

/**
 * Batch Processor: Executes simulation and financial analysis for ALL defined scenarios.
 * Aggregates results from multiple scenarios into a single master output.
 */
function calculateScenariosAndCosts() {
  if (!confirmOverwrite([SHEET_YEAR_STATES_OUTPUT])) return;
  var in_data = getInputData();
  var scenarios = readScenariosFromKeyframes();
  var costsDb = getCostsDb();

  var allYearStates = []
  scenarios.forEach(function(scenario) {
    scenario.simulate(in_data);
    scenario.calculateCosts(costsDb, in_data.parameters);
    allYearStates = allYearStates.concat(scenario.years);
  });
  // Flatten results: Append current scenario's year states to the master list

  saveYearStatesOutput(allYearStates);
  SpreadsheetApp.flush();

  // Switch to the scenario results
  SpreadsheetApp.setActiveSheet(getOrCreateSheet(SHEET_YEAR_STATES_OUTPUT));
};

/**
 * Asks the user to confirm before an action overwrites output tabs.
 * Returns true to continue. Without a UI (editor run, trigger) it continues, so unattended runs are not blocked.
 */
function confirmOverwrite(sheetNames) {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    return true;
  }
  var answer = ui.alert('אישור דריסה',
    'הפעולה תכתוב מחדש את הלשוניות:\n' + sheetNames.join('\n') + '\n\nלהמשיך?',
    ui.ButtonSet.YES_NO);
  return answer === ui.Button.YES;
}
