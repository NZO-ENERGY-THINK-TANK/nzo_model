/**
 * Data version and integrity (step 6 of the collaboration plan).
 *
 * _meta   : data_version (git tag of data/) and data_hash, written by "Update data hash".
 * _status : code version, data version and whether the live data still matches the hash.
 *
 * The hash covers only the ranges that are exported to data/ in git, so it can later be recomputed
 * from the CSV files. Normalization: numbers -> 10 significant digits, Date -> H:MM:SS,
 * text -> trimmed, empty -> ''. Cells are joined by ',' and rows by '\n', each range is preceded
 * by a "#sheet!range" line, and the text is hashed with SHA-256 (hex).
 */
const SHEET_META = '_meta';
const SHEET_STATUS = '_status';
const SHEET_DEMAND_INPUT = '10_demand-yearly';
const SHEET_MUST_RUN_INPUT = '11_must-run-yearly';


const DATA_HASH_RANGES = [
  {sheet: '13_assumptions', row: 1, col: 1, rows: 60, cols: 14, pick: null},
  {sheet: SHEET_DEMAND_INPUT, row: 2, col: 1, rows: 28, cols: 3, pick: null},
  {sheet: SHEET_MUST_RUN_INPUT, row: 2, col: 1, rows: 28, cols: 2, pick: null},
  {sheet: '12_raw-data-hourly', row: 2, col: 1, rows: 8760, cols: 14, pick: null}
];

function _normalizeForHash(v) {
  if (v instanceof Date) {
    var mm = ('0' + v.getMinutes()).slice(-2);
    var ss = ('0' + v.getSeconds()).slice(-2);
    return v.getHours() + ':' + mm + ':' + ss;
  }
  if (typeof v === 'number') return String(Number(v.toPrecision(10)));
  return String(v).trim();
}

function _hexOf(bytes) {
  return bytes.map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/**
 * Computes the SHA-256 hash of the exported data ranges from the live sheets.
 * @param {Spreadsheet=} spreadsheet defaults to the active spreadsheet (pass the master to hash it, used by Sync).
 */
function computeDataHash(spreadsheet) {
  var parts = [];
  var source = spreadsheet || SpreadsheetApp.getActive();
  DATA_HASH_RANGES.forEach(function(r) {
    var sheet = source.getSheetByName(r.sheet);
    if (!sheet) throw new Error('Sheet "' + r.sheet + '" not found in ' + source.getName());
    var values = sheet.getRange(r.row, r.col, r.rows, r.cols).getValues();
    var a1 = sheet.getRange(r.row, r.col, r.rows, r.cols).getA1Notation();
    parts.push('#' + r.sheet + '!' + a1);
    values.forEach(function(row) {
      var cells = r.pick ? r.pick.map(function(c) { return row[c - r.col]; }) : row;
      parts.push(cells.map(_normalizeForHash).join(','));
    });
  });
  var text = parts.join('\n') + '\n';
  return _hexOf(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/**
 * Reads _meta. Returns {dataVersion, dataHash, hashUpdated} (empty strings when missing).
 * @param {Spreadsheet=} spreadsheet defaults to the active spreadsheet (pass the master to read its _meta).
 */
function getDataMeta(spreadsheet) {
  var meta = {dataVersion: '', dataHash: '', hashUpdated: ''};
  var sheet = (spreadsheet || SpreadsheetApp.getActive()).getSheetByName(SHEET_META);
  if (!sheet || sheet.getLastRow() < 1) return meta;
  sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues().forEach(function(row) {
    if (row[0] === 'data_version') meta.dataVersion = String(row[1]);
    if (row[0] === 'data_hash') meta.dataHash = String(row[1]);
    if (row[0] === 'hash_updated') meta.hashUpdated = String(row[1]);
  });
  return meta;
}

function _writeMeta(dataVersion, dataHash) {
  var sheet = getOrCreateSheet(SHEET_META);
  var ranges = DATA_HASH_RANGES.map(function(r) {
    return r.sheet + '!' + sheet.getParent().getSheetByName(r.sheet).getRange(r.row, r.col, r.rows, r.cols).getA1Notation();
  }).join('; ');
  var rows = [
    ['name', 'value'],
    ['data_version', dataVersion],
    ['data_hash', dataHash],
    ['hash_updated', new Date()],
    ['hash_ranges', ranges]
  ];
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
}

/** Writes _status from the recorded _meta and a live hash. Returns the match flag. */
function _writeStatus(liveHash) {
  var meta = getDataMeta();
  var match = meta.dataHash !== '' && meta.dataHash === liveHash;
  var sheet = getOrCreateSheet(SHEET_STATUS);
  var rows = [
    ['name', 'value'],
    ['code_version', CODE_VERSION],
    ['data_version', meta.dataVersion],
    ['data_hash_match', meta.dataHash === '' ? 'NO HASH RECORDED' : match],
    ['checked_at', new Date()],
    ['last_sync', PropertiesService.getDocumentProperties().getProperty(SYNC_PROPERTY_LAST) || '']
  ];
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(4, 2).setBackground(match ? '#b7e1cd' : '#f4c7c3');
  return match;
}

/** Menu: asks for data_version, records it with a fresh hash in _meta, and refreshes _status. */
function updateDataHash() {
  var ui = SpreadsheetApp.getUi();
  var current = getDataMeta().dataVersion;
  var resp = ui.prompt('Update data hash',
    'Data version (git tag of data/, e.g. data-1.0).\nCurrent: ' + (current || '(none)'), ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var version = (resp.getResponseText() || '').trim() || current;
  if (!version) {
    ui.alert('Data version is required.');
    return;
  }
  var hash = computeDataHash();
  _writeMeta(version, hash);
  _writeStatus(hash);
  ui.alert('Data hash updated', version + '\n' + hash, ui.ButtonSet.OK);
}

/** Menu: computes the live hash, refreshes _status, and shows whether the data matches _meta. */
function checkDataStatus() {
  var match = _writeStatus(computeDataHash());
  var meta = getDataMeta();
  var text = 'code_version: ' + CODE_VERSION + '\ndata_version: ' + (meta.dataVersion || '(none)') +
    '\ndata hash matches _meta: ' + (meta.dataHash === '' ? 'no hash recorded' : match);
  Logger.log(text);
  try {
    SpreadsheetApp.getUi().alert('Data status', text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // no UI in this context: result is in _status and the log
  }
}

/**
 * Identity of a run: who, which code, which data, and whether the data still matches _meta.
 * Written to every row of 29_year-run-history .
 * @return {{run_id, researcher, code_version, data_version, data_hash_match}}
 */
function getRunMetadata() {
  var researcher = '';
  try {
    researcher = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    // not available outside the owner's domain: leave empty
  }
  var meta = getDataMeta();
  var match = 'NO HASH RECORDED';
  if (meta.dataHash !== '') {
    match = (computeDataHash() === meta.dataHash);
  }
  var now = new Date();
  var stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  var who = researcher ? researcher.split('@')[0] : 'unknown';
  var rand = Math.floor(Math.random() * 65536).toString(16);
  return {
    run_id: stamp + '_' + who + '_' + ('000' + rand).slice(-4),
    researcher: researcher,
    code_version: CODE_VERSION,
    data_version: meta.dataVersion,
    data_hash_match: match
  };
}
