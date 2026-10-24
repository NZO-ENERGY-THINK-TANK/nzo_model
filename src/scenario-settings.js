/**
 * Scenario settings: per-scenario assumptions that are not part of a keyframe row.
 * Scenario runs take ALL their inputs from 30_scenarios-input. 20_year-input is used only by Predict Year.
 *
 * Layout of 30_scenarios-input (top to bottom):
 *   row 1        title "scenario settings"
 *   row 2        headers: name | demandForecast | interestRate | hydrogenEfficiency | paramSet
 *   rows 3-22    one row per scenario (room for 20 scenarios)
 *   row 24       title "keyframes"
 *   row 25       keyframe headers (KEYFRAME_HEADERS)
 *   rows 26...   keyframes. The "name" column accepts only names defined in the settings table (dropdown).
 */
const SETTINGS_TITLE_ROW = 1;
const SETTINGS_HEADER_ROW = 2;
const SETTINGS_FIRST_ROW = 3;
const SETTINGS_MAX_ROWS = 20;
const KEYFRAMES_TITLE_ROW = 24;
const KEYFRAMES_HEADER_ROW = 25;
const KEYFRAMES_NAME_VALIDATION_ROWS = 400;
// Default discount rate for new settings rows (20_year-input no longer has an interest row).
const SCENARIO_SETTINGS_DEFAULT_INTEREST = 0.06;
// paramSet = param_set of 13_tech-params used for the scenario costs (empty = DEFAULT_PARAM_SET).
const SCENARIO_SETTINGS_HEADERS = ['name', 'demandForecast', 'interestRate', 'hydrogenEfficiency', 'paramSet'];

/**
 * Settings of the reference test scenario ("Base"). Kept in code so edits in the sheet do not change the reference.
 * Values = what 20_year-input had when the reference was recorded.
 */
const REFERENCE_SCENARIO_SETTINGS = {
  demandForecast: 'Noga conservative',
  interestRate: 0.06,
  hydrogenEfficiency: 0.5,
  paramSet: 'NZO' // literal (not DEFAULT_PARAM_SET): file load order in Apps Script is not guaranteed
};

const SCENARIO_LAYOUT_HELP = 'Run NZO Model > Advanced > Set up scenario settings (moves the keyframes down and creates the settings table above them).';

/** True when the sheet has the new layout (settings table on top, keyframes from row 25). */
function _hasNewScenarioLayout(sheet) {
  var h = sheet.getRange(SETTINGS_HEADER_ROW, 1, 1, SCENARIO_SETTINGS_HEADERS.length).getValues()[0];
  var k = sheet.getRange(KEYFRAMES_HEADER_ROW, 1, 1, 2).getValues()[0];
  return SCENARIO_SETTINGS_HEADERS.every(function(v, j) { return h[j] === v; }) && k[0] === 'name' && k[1] === 'year';
}

/** Stops with a clear message when 30_scenarios-input is not in the new layout. */
function assertScenarioLayout() {
  var sheet = getSheet(SHEET_SCENARIO_KEYFRAMES);
  if (!_hasNewScenarioLayout(sheet)) {
    throw new Error(SHEET_SCENARIO_KEYFRAMES + ' is not in the expected layout (settings table in rows 1-22, keyframes header in row ' +
      KEYFRAMES_HEADER_ROW + '). ' + SCENARIO_LAYOUT_HELP);
  }
  return sheet;
}

/**
 * Reads the settings table. Returns { scenarioName: {demandForecast, interestRate, hydrogenEfficiency, paramSet} }.
 * An empty paramSet means DEFAULT_PARAM_SET; an unknown set stops the run when costs are calculated (CostsDb.forSet).
 * Throws a clear error on invalid values.
 */
function readScenarioSettings() {
  var sheet = assertScenarioLayout();
  var values = sheet.getRange(SETTINGS_FIRST_ROW, 1, SETTINGS_MAX_ROWS, SCENARIO_SETTINGS_HEADERS.length).getValues();
  var settings = {};
  values.forEach(function(row, i) {
    var name = row[0];
    if (name === '') return;
    var where = SHEET_SCENARIO_KEYFRAMES + ' settings row ' + (SETTINGS_FIRST_ROW + i) + ' (' + name + ')';
    if (settings.hasOwnProperty(name)) throw new Error('Duplicate scenario name in ' + where);
    var s = {demandForecast: row[1], interestRate: row[2], hydrogenEfficiency: row[3],
      paramSet: String(row[4]).trim() || DEFAULT_PARAM_SET};
    _validateScenarioSettings(s, where);
    settings[name] = s;
  });
  return settings;
}

function _validateScenarioSettings(s, where) {
  if (!DEMAND_FORECAST_COLUMNS[s.demandForecast]) {
    throw new Error(where + ": unknown demandForecast '" + s.demandForecast + "'. Expected one of: " + Object.keys(DEMAND_FORECAST_COLUMNS).join(', '));
  }
  if (typeof s.interestRate !== 'number' || !(s.interestRate >= 0 && s.interestRate < 1)) {
    throw new Error(where + ': interestRate must be a number from 0 to 1 (e.g. 6%), found ' + s.interestRate);
  }
  if (typeof s.hydrogenEfficiency !== 'number' || !(s.hydrogenEfficiency > 0 && s.hydrogenEfficiency <= 1)) {
    throw new Error(where + ': hydrogenEfficiency must be a number above 0 and up to 1 (e.g. 50%), found ' + s.hydrogenEfficiency);
  }
}

/** Attaches the settings row to every scenario. A scenario without a row stops the run. */
function applyScenarioSettings(scenarios) {
  var settings = readScenarioSettings();
  scenarios.forEach(function(scenario) {
    if (!settings.hasOwnProperty(scenario.name)) {
      throw new Error("Scenario '" + scenario.name + "' has no row in the settings table (" + SHEET_SCENARIO_KEYFRAMES + ' rows ' +
        SETTINGS_FIRST_ROW + '-' + (SETTINGS_FIRST_ROW + SETTINGS_MAX_ROWS - 1) + '). Add a row with the same name.');
    }
    scenario.settings = settings[scenario.name];
  });
  return scenarios;
}

/**
 * Menu: "Set up scenario settings". Safe to run again.
 * - Old layout (keyframes header in row 1): moves the keyframes down (rows are inserted above them, so formulas follow),
 *   and moves a settings table from columns T:W (previous version) to the top.
 * - Adds a settings row for every scenario name found in the keyframes (defaults from the current 20_year-input; existing rows are kept).
 * - Fills an empty paramSet with DEFAULT_PARAM_SET (rows created before paramSet existed).
 * - Adds dropdowns: demandForecast and paramSet (the sets in 13_tech-params; run again after adding a set) in the settings table,
 *   and the keyframes "name" column limited to the names in the settings table.
 */
function createScenarioSettingsTable() {
  var sheet = getSheet(SHEET_SCENARIO_KEYFRAMES);
  var sideRows = [];
  var firstRun = false;
  var oldKeyframes = sheet.getRange(1, 1, 1, 2).getValues()[0];
  if (oldKeyframes[0] === 'name' && oldKeyframes[1] === 'year') {
    firstRun = true;
    // Settings table of the previous version (columns T:W, header in row 1), if present.
    var side = sheet.getRange(1, 20, 100, 4).getValues(); // previous version: 4 columns, no paramSet
    if (side[0][0] === 'name' && side[0][1] === 'demandForecast') {
      side.slice(1).forEach(function(r) { if (r[0] !== '') sideRows.push(r); });
    }
    sheet.getRange(1, 20, 100, 4).clear();
    sheet.insertRowsBefore(1, KEYFRAMES_HEADER_ROW - 1);
    sheet.getRange(1, 1, KEYFRAMES_HEADER_ROW - 1, 18).clear();
    sheet.setFrozenRows(0);
  } else if (!(oldKeyframes[0] !== 'name' && _hasKeyframesAt(sheet, KEYFRAMES_HEADER_ROW))) {
    throw new Error(SHEET_SCENARIO_KEYFRAMES + ': keyframes header (name, year, ...) not found in row 1 or row ' + KEYFRAMES_HEADER_ROW + '.');
  }

  // Titles and headers
  sheet.getRange(SETTINGS_TITLE_ROW, 1).setValue('scenario settings (one row per scenario; the names here are the only names allowed in the keyframes below)').setFontWeight('bold');
  sheet.getRange(SETTINGS_HEADER_ROW, 1, 1, SCENARIO_SETTINGS_HEADERS.length).setValues([SCENARIO_SETTINGS_HEADERS])
    .setFontWeight('bold').setBackground('#d9d9d9');
  sheet.getRange(KEYFRAMES_TITLE_ROW, 1).setValue('keyframes (a year row per scenario; values between keyframes are interpolated)').setFontWeight('bold');
  sheet.getRange(KEYFRAMES_HEADER_ROW, 1, 1, KEYFRAME_HEADERS.length).setFontWeight('bold').setBackground('#d9d9d9');

  // Existing settings rows
  var existing = {};
  var filled = 0;
  sheet.getRange(SETTINGS_FIRST_ROW, 1, SETTINGS_MAX_ROWS, 1).getValues().forEach(function(r) {
    if (r[0] !== '') { existing[r[0]] = true; filled++; }
  });
  // Names from the keyframes
  var names = [];
  readTableFromSheet(SHEET_SCENARIO_KEYFRAMES, KEYFRAMES_HEADER_ROW, KEYFRAME_HEADERS).forEach(function(r) {
    if (names.indexOf(r[0]) === -1) names.push(r[0]);
  });
  var params = getParameters();
  var forecastRow = readParams().filter(function(row) { return row[0] === 'demand-forecast'; })[0];
  var defaults = [forecastRow ? forecastRow[2] : '', SCENARIO_SETTINGS_DEFAULT_INTEREST, params.hydrogenEfficenty, DEFAULT_PARAM_SET];
  var sideByName = {};
  sideRows.forEach(function(r) { sideByName[r[0]] = r; });
  var rows = names.filter(function(n) { return !existing[n]; }).map(function(n) {
    return sideByName[n] ? [n, sideByName[n][1], sideByName[n][2], sideByName[n][3], DEFAULT_PARAM_SET] : [n].concat(defaults);
  });
  if (filled + rows.length > SETTINGS_MAX_ROWS) {
    throw new Error('Too many scenarios for the settings table (room for ' + SETTINGS_MAX_ROWS + ').');
  }
  if (rows.length) {
    sheet.getRange(SETTINGS_FIRST_ROW + filled, 1, rows.length, SCENARIO_SETTINGS_HEADERS.length).setValues(rows);
  }
  sheet.getRange(SETTINGS_FIRST_ROW, 3, SETTINGS_MAX_ROWS, 2).setNumberFormat('0.0%');

  // paramSet: existing rows without a set get the default
  var setCol = SCENARIO_SETTINGS_HEADERS.indexOf('paramSet') + 1;
  var setRange = sheet.getRange(SETTINGS_FIRST_ROW, 1, SETTINGS_MAX_ROWS, setCol);
  var setValues = setRange.getValues();
  var setsFilled = 0;
  setValues.forEach(function(r) { if (r[0] !== '' && String(r[setCol - 1]).trim() === '') { r[setCol - 1] = DEFAULT_PARAM_SET; setsFilled++; } });
  if (setsFilled) sheet.getRange(SETTINGS_FIRST_ROW, setCol, SETTINGS_MAX_ROWS, 1).setValues(setValues.map(function(r) { return [r[setCol - 1]]; }));

  // Dropdowns
  var forecastRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(DEMAND_FORECAST_COLUMNS), true).setAllowInvalid(false).build();
  sheet.getRange(SETTINGS_FIRST_ROW, 2, SETTINGS_MAX_ROWS, 1).setDataValidation(forecastRule);
  var setRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(getCostsDb().setNames(), true).setAllowInvalid(false)
    .setHelpText('param_set of ' + SHEET_TECH_PARAMS + ' used for the costs of this scenario. Run Set up scenario settings again after adding a set.').build();
  sheet.getRange(SETTINGS_FIRST_ROW, setCol, SETTINGS_MAX_ROWS, 1).setDataValidation(setRule);
  var nameRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sheet.getRange(SETTINGS_FIRST_ROW, 1, SETTINGS_MAX_ROWS, 1), true)
    .setAllowInvalid(false)
    .setHelpText('Only scenario names defined in the settings table at the top of this tab.').build();
  var nameRows = Math.min(KEYFRAMES_NAME_VALIDATION_ROWS, sheet.getMaxRows() - KEYFRAMES_HEADER_ROW);
  sheet.getRange(KEYFRAMES_HEADER_ROW + 1, 1, nameRows, 1).setDataValidation(nameRule);

  SpreadsheetApp.flush();
  var msg = (firstRun ? 'Keyframes moved down to row ' + (KEYFRAMES_HEADER_ROW + 1) + '. ' : '') +
    rows.length + ' scenario(s) added to the settings table.' +
    (setsFilled ? ' paramSet set to ' + DEFAULT_PARAM_SET + ' in ' + setsFilled + ' existing row(s).' : '');
  try { SpreadsheetApp.getUi().alert('Scenario settings', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
}

function _hasKeyframesAt(sheet, row) {
  var k = sheet.getRange(row, 1, 1, 2).getValues()[0];
  return k[0] === 'name' && k[1] === 'year';
}
