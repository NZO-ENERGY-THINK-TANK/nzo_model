/**
 * Sync from master (step 10a of the collaboration plan).
 *
 * Copies the base data (the ranges covered by DATA_HASH_RANGES: 10, 11, 12, 13) from the master spreadsheet
 * into this copy, after checking that the master itself was not edited by hand (hash) and that its headers
 * match what the code expects. Then refreshes 30_costs-forecast, the design scheme and _status.
 *
 * Does not touch: 20_parameters, 21_scenarios-keyframes, 90_run-history and every output tab.
 * Local overrides of base values are step 10b and not part of this file yet.
 *
 * Steps run in a fixed order; everything is checked before the first cell is written.
 */
const SYNC_PROPERTY_LAST = 'last_sync';

// Headers (row 1) that the code relies on in each synced tab. Costs: exact order (readTableFromSheet checks position).
const SYNC_REQUIRED_HEADERS = {
  '13_costs': {ordered: true, headers: function() { return FORECASTED_PARAM_HEADERS; }},
  '10_demand-yearly': {ordered: false, headers: function() {
    return ['year'].concat(Object.keys(DEMAND_FORECAST_COLUMNS).map(function(k) { return DEMAND_FORECAST_COLUMNS[k]; }));
  }},
  '11_must-run-yearly': {ordered: false, headers: function() { return ['year', 'must_run_mw']; }},
  '12_raw-data-hourly': {ordered: true, headers: function() {
    return ['day', 'month', 'year', 'time', 'hour_of_year', 'total_generation_mw', 'must_run_mw', 'solar_mw',
      'gas_mw', 'fossil_mw', 'gas_share', 'wind_mw'];
  }}
};

/** Menu: Sync from master. */
function syncFromMaster() {
  var ui = SpreadsheetApp.getUi();
  var local = SpreadsheetApp.getActive();

  if (local.getId() === MASTER_SPREADSHEET_ID) {
    ui.alert('Sync from master', 'This is the master spreadsheet. Sync runs in researcher copies.', ui.ButtonSet.OK);
    return;
  }

  // 1. Open the master and read its recorded version.
  var master;
  try {
    master = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  } catch (e) {
    ui.alert('Sync from master', 'Cannot open the master spreadsheet. Check that you have access to it.\n\n' + e, ui.ButtonSet.OK);
    return;
  }
  var masterMeta = getDataMeta(master);
  if (!masterMeta.dataVersion || !masterMeta.dataHash) {
    ui.alert('Sync stopped', 'The master has no recorded data version or hash (_meta). Ask the master owner to run Update data hash.', ui.ButtonSet.OK);
    return;
  }

  // 2. Already up to date? Same version and the local data still matches the master hash.
  var localMeta = getDataMeta();
  var localHash = computeDataHash();
  if (localMeta.dataVersion === masterMeta.dataVersion && localHash === masterMeta.dataHash) {
    ui.alert('Sync from master', 'Already up to date: ' + masterMeta.dataVersion, ui.ButtonSet.OK);
    return;
  }

  // 3. The master must match its own recorded hash (nobody edited it by hand).
  var masterLiveHash = computeDataHash(master);
  if (masterLiveHash !== masterMeta.dataHash) {
    ui.alert('Sync stopped',
      'The master data does not match its recorded hash (' + masterMeta.dataVersion + '). Someone may have edited the master by hand.\n' +
      'Nothing was copied. Tell the master owner.', ui.ButtonSet.OK);
    return;
  }

  // 4. Headers must match what the code expects, in the master and in this copy.
  var problems = _syncCheckHeaders(master, 'master').concat(_syncCheckHeaders(local, 'this copy'));
  if (problems.length > 0) {
    ui.alert('Sync stopped', 'Header check failed:\n' + problems.join('\n') + '\n\nNothing was copied.', ui.ButtonSet.OK);
    return;
  }

  // 5. Confirm.
  var tabs = DATA_HASH_RANGES.map(function(r) { return r.sheet; });
  var answer = ui.alert('Sync from master',
    'Data version: ' + (localMeta.dataVersion || '(none)') + '  →  ' + masterMeta.dataVersion + '\n\n' +
    'The base-data ranges of these tabs will be overwritten with the master values:\n' + tabs.join('\n') +
    '\n\nYour inputs (20, 21) and results (90 and output tabs) are not touched. Continue?',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  // 6. Copy values and number formats range by range.
  DATA_HASH_RANGES.forEach(function(r) {
    var from = master.getSheetByName(r.sheet).getRange(r.row, r.col, r.rows, r.cols);
    var target = local.getSheetByName(r.sheet);
    _syncEnsureSize(target, r.row + r.rows - 1, r.col + r.cols - 1);
    var to = target.getRange(r.row, r.col, r.rows, r.cols);
    to.setNumberFormats(from.getNumberFormats());
    to.setValues(from.getValues());
  });
  SpreadsheetApp.flush();

  // 7. Verify the copy: the local hash must now equal the master hash.
  var newHash = computeDataHash();
  if (newHash !== masterMeta.dataHash) {
    ui.alert('Sync failed verification',
      'The data was copied but the local hash does not match the master (' + masterMeta.dataVersion + ').\n' +
      '_meta was not updated. Run Sync again; if it repeats, tell the master owner.', ui.ButtonSet.OK);
    return;
  }
  _writeMeta(masterMeta.dataVersion, newHash);
  PropertiesService.getDocumentProperties().setProperty(SYNC_PROPERTY_LAST,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm") + ' ' + masterMeta.dataVersion);

  // 8. Refresh derived tabs: 30_costs-forecast is not refreshed by Predict Year, so it is recalculated here.
  calculateCosts();
  applyDesignScheme();
  _writeStatus(newHash);
  SpreadsheetApp.flush();

  ui.alert('Sync from master',
    'Done. Data version: ' + masterMeta.dataVersion + '\n30_costs-forecast was recalculated.\n\nPrevious results in 90_run-history keep their old data version.',
    ui.ButtonSet.OK);
}

/**
 * Checks row 1 of each synced tab against SYNC_REQUIRED_HEADERS.
 * @return {string[]} problem descriptions (empty when everything matches)
 */
function _syncCheckHeaders(spreadsheet, label) {
  var problems = [];
  Object.keys(SYNC_REQUIRED_HEADERS).forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      problems.push(label + ': tab ' + name + ' is missing');
      return;
    }
    var spec = SYNC_REQUIRED_HEADERS[name];
    var required = spec.headers();
    var actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), required.length)).getValues()[0]
      .map(function(h) { return String(h).trim(); });
    if (spec.ordered) {
      for (var i = 0; i < required.length; i++) {
        if (actual[i] !== required[i]) {
          problems.push(label + ': ' + name + ' column ' + (i + 1) + ' is "' + actual[i] + '", expected "' + required[i] + '"');
          break;
        }
      }
    } else {
      required.forEach(function(h) {
        if (actual.indexOf(h) < 0) problems.push(label + ': ' + name + ' has no column "' + h + '"');
      });
    }
  });
  return problems;
}

/** Adds rows or columns so that the sheet has at least the given size. */
function _syncEnsureSize(sheet, rows, cols) {
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet.getMaxColumns());
}
