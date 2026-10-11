/**
 * Design scheme (step 8): one table that defines every tab's role, color and protection.
 * applyDesignScheme() is idempotent: run it as often as needed, the result does not depend on the previous state.
 * Constraints: never adds rows/columns to existing tables and never renames tabs
 * (code and formulas reference fixed cells and tab names).
 */

const DESIGN_ROLES = {
  input:    {label: 'קלט אישי',     color: '#4285f4', protect: false, note: 'עריכה חופשית. Sync לא נוגע'},
  base:     {label: 'נתוני בסיס',   color: '#8e63ce', protect: true,  note: 'נדרסת ב-Sync. שינוי קבוע רק דרך PR בגיט'},
  output:   {label: 'פלט חד-פעמי',  color: '#34a853', protect: true,  note: 'נכתבת מחדש בכל הרצה'},
  saved:    {label: 'תוצאות שנשמרו', color: '#fb8c00', protect: true,  note: 'נכתבת רק על ידי הקוד'},
  charts:   {label: 'גרפים',        color: '#00acc1', protect: true,  note: 'נכתבת מחדש בעת רענון גרפים'},
  status:   {label: 'סטטוס ועזרה',  color: '#9e9e9e', protect: true,  note: 'מידע ואזהרות'}
};

const DESIGN_SCHEME = {
  '00_documentation': 'status',
  '20_parameters': 'input',
  '10_demand-yearly': 'base',
  '11_must-run-yearly': 'base',
  '12_raw-data-hourly': 'base',
  '13_costs': 'base',
  '42_hourly-predicted': 'output',
  '41_daily-predicted': 'output',
  '40_year-summary': 'output',
  '30_costs-forecast': 'output',
  '60_daily-chart': 'charts',
  '61_yearly-chart': 'charts',
  '21_scenarios-keyframes': 'input',
  '50_scenarios-yearly': 'output',
  '90_run-history': 'saved',
  '_meta': 'status',
  '_status': 'status'
};

// Calculated cells inside an input tab: grey text + warning-only protection (they update only after Calculate Costs / a data change).
const DESIGN_CALCULATED_CELLS = {
  '20_parameters': ['C4', 'C5', 'C7', 'C9', 'C10', 'C24:C26', 'C29']
};

// Where the color legend is written in 00_documentation: A1:B7 (7 rows x 2 columns; the area must be empty).
// Tab order: documentation, researcher inputs, outputs and charts (+ run history), base data, system.
const DESIGN_TAB_ORDER = [
  '00_documentation',
  '20_parameters', '21_scenarios-keyframes',
  '30_costs-forecast', '40_year-summary', '41_daily-predicted', '42_hourly-predicted', '50_scenarios-yearly',
  '60_daily-chart', '61_yearly-chart', '90_run-history',
  '10_demand-yearly', '11_must-run-yearly', '12_raw-data-hourly', '13_costs',
  '_meta', '_status'
];

const DESIGN_LEGEND_SHEET = '00_documentation';
const DESIGN_LEGEND_ANCHOR = {row: 1, col: 1};

const DESIGN_CALCULATED_BACKGROUND = '#efefef';
const DESIGN_PROTECTION_TAG = 'NZO design scheme';

/** Dry run: logs what applyDesignScheme() would do, changes nothing. */
function designSchemeDryRun() {
  var ss = SpreadsheetApp.getActive();
  var lines = [];
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    var role = DESIGN_SCHEME[name];
    if (!role) { lines.push('UNLISTED  ' + name + ' (not in DESIGN_SCHEME, left untouched)'); return; }
    lines.push(name + ' -> ' + role + ' ' + DESIGN_ROLES[role].color + (DESIGN_ROLES[role].protect ? ' + warning protection' : ''));
  });
  Object.keys(DESIGN_SCHEME).forEach(function(name) {
    if (!ss.getSheetByName(name)) lines.push('MISSING   ' + name + ' (in DESIGN_SCHEME, no such tab)');
  });
  Object.keys(DESIGN_CALCULATED_CELLS).forEach(function(name) {
    lines.push(name + ': calculated cells ' + DESIGN_CALCULATED_CELLS[name].join(', '));
  });
  console.log(lines.join('\n'));
  return lines;
}

/** Applies tab colors, warning-only protections, calculated-cell look and the legend. Idempotent. */
function applyDesignScheme() {
  var ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    var role = DESIGN_SCHEME[name];
    if (!role) return;
    var def = DESIGN_ROLES[role];
    sheet.setTabColor(def.color);
    _clearDesignProtections(sheet);
    if (def.protect) {
      var p = sheet.protect().setDescription(DESIGN_PROTECTION_TAG + ': ' + def.note);
      p.setWarningOnly(true);
    }
  });
  Object.keys(DESIGN_CALCULATED_CELLS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    DESIGN_CALCULATED_CELLS[name].forEach(function(a1) {
      var range = sheet.getRange(a1);
      range.setFontColor('#666666').setBackground(DESIGN_CALCULATED_BACKGROUND);
      var p = range.protect().setDescription(DESIGN_PROTECTION_TAG + ': calculated cell');
      p.setWarningOnly(true);
    });
  });
  _writeDesignLegend(ss);
  _writeMenuDocs(ss);
  _writeRunGuide(ss);
  _writeSheetsTable(ss);
  _applyTabOrder(ss);
  SpreadsheetApp.flush();
}

/** Moves the tabs listed in DESIGN_TAB_ORDER to the front, in that order. Other tabs stay after them. */
function _applyTabOrder(ss) {
  var pos = 1;
  DESIGN_TAB_ORDER.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(pos);
    pos++;
  });
}

function _clearDesignProtections(sheet) {
  var types = [SpreadsheetApp.ProtectionType.SHEET, SpreadsheetApp.ProtectionType.RANGE];
  types.forEach(function(type) {
    sheet.getProtections(type).forEach(function(p) {
      if ((p.getDescription() || '').indexOf(DESIGN_PROTECTION_TAG) === 0) p.remove();
    });
  });
}

function _writeDesignLegend(ss) {
  var sheet = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!sheet) return;
  var keys = Object.keys(DESIGN_ROLES);
  var rows = [['מקרא צבעי הלשוניות', '']];
  keys.forEach(function(k) { rows.push([DESIGN_ROLES[k].label, DESIGN_ROLES[k].note]); });
  var a = DESIGN_LEGEND_ANCHOR;
  var range = sheet.getRange(a.row, a.col, rows.length, 2);
  range.setValues(rows);
  sheet.getRange(a.row, a.col, 1, 2).setFontWeight('bold');
  keys.forEach(function(k, i) {
    var cell = sheet.getRange(a.row + 1 + i, a.col);
    cell.setBackground(DESIGN_ROLES[k].color).setFontColor('#ffffff').setFontWeight('bold');
  });
}

// Menu documentation written to 00_documentation below the legend. Keep in sync with buildMenu() in main.js.
const DESIGN_MENU_DOCS_ANCHOR = {row: 9, col: 1};
const DESIGN_MENU_DOCS = [
  ['תפריט NZO Model', 'מה הפעולה עושה', 'לשוניות שמתעדכנות'],
  ['Predict Year', 'מריצה את המודל השנתי לשנה שב-20_parameters!C8: תמהיל ייצור, אחוז מתחדשות, פליטות', '42_hourly-predicted, 41_daily-predicted, 40_year-summary, 90_run-history'],
  ['Calculate Costs', 'מחשבת את תחזית העלויות השנתית מ-13_costs. להריץ אחרי כל שינוי ב-13_costs', '30_costs-forecast'],
  ['Calculate Scenarios and Costs', 'מריצה את כל ה-scenarios שב-21_scenarios-keyframes ומחשבת עלויות. מבקשת אישור לפני דריסה', '50_scenarios-yearly, 30_costs-forecast'],
  ['Advanced → Run reference test', 'מריצה את scenario הייחוס ומשווה לערכים השמורים בקוד. PASS פירושו שהתוצאות לא השתנו', 'לא כותבת ללשוניות'],
  ['Advanced → Record reference test', 'מקליטה ערכי ייחוס חדשים. רק לשינוי מכוון בתוצאות, ואז מדביקים ל-reference_test_expected.js', 'לא כותבת ללשוניות'],
  ['Advanced → Update data hash', 'רושמת גרסת נתונים וחתימה (hash) של לשוניות 10–13', '_meta, _status'],
  ['Advanced → Check data status', 'בודקת שהנתונים בגליון תואמים לחתימה השמורה, ומציגה גרסת קוד וגרסת נתונים', '_status'],
  ['Advanced → Apply design scheme', 'צובעת לשוניות, מוסיפה הגנות במצב אזהרה, וכותבת את המקרא, את תיעוד התפריט ואת מדריך ההרצה', '00_documentation']
];

function _writeMenuDocs(ss) {
  var sheet = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!sheet) return;
  var a = DESIGN_MENU_DOCS_ANCHOR;
  sheet.getRange(a.row, a.col, DESIGN_MENU_DOCS.length, 3).setValues(DESIGN_MENU_DOCS);
  sheet.getRange(a.row, a.col, 1, 3).setFontWeight('bold');
}

// Run guide written to 00_documentation below the menu documentation (A19 and down).
const DESIGN_RUN_GUIDE_ANCHOR = {row: 19, col: 1};
const DESIGN_RUN_GUIDE = [
  ['ארבעה שלבים להרצה', ''],
  ['1. קלט', 'ערוך רק לשוניות כחולות: 20_parameters ו-21_scenarios-keyframes'],
  ['2. הרצה', 'תפריט NZO Model: Predict Year לשנה אחת, או Calculate Scenarios and Costs לכל ה-scenarios'],
  ['3. תוצאות', 'לשוניות ירוקות (30, 40, 41, 42, 50) נכתבות מחדש בכל הרצה. ההיסטוריה נשמרת ב-90_run-history (כתום)'],
  ['4. בדיקה', 'Advanced → Check data status: גרסת קוד וגרסת נתונים צריכות להיות תואמות למאסטר'],
  ['', ''],
  ['בדיקה להרצה ראשונה', ''],
  ['א.', 'בחר תרחיש ב-20_parameters!C2 ושנה ב-C8'],
  ['ב.', 'הרץ Calculate Costs ואז Predict Year'],
  ['ג.', 'ודא ש-Advanced → Run reference test מחזיר PASS']
];

function _writeRunGuide(ss) {
  var sheet = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!sheet) return;
  var a = DESIGN_RUN_GUIDE_ANCHOR;
  sheet.getRange(a.row, a.col, DESIGN_RUN_GUIDE.length, 2).setValues(DESIGN_RUN_GUIDE);
  [0, 6].forEach(function(i) { sheet.getRange(a.row + i, a.col, 1, 2).setFontWeight('bold'); });
}

// Tab list in 00_documentation: found by the header cell 'גליונות' in column A. The first row below the
// 'שם/תאור' header (external link to Noga's forecast) is kept; the rows after it are rewritten.
const DESIGN_SHEETS_HEADER = 'גליונות';
const DESIGN_SHEETS_OLD_ROWS = 20; // extent of the old table that is cleared before writing
const DESIGN_SHEETS_TABLE = [
  ['20_parameters', 'input', 'נתוני קלט ידניים. למשל השנה שעבורה יש להריץ את המודל'],
  ['21_scenarios-keyframes', 'input', 'קלט ערכים באינטרוולים לחילוץ scenarios'],
  null,
  ['30_costs-forecast', 'output', 'תחזית מחירים שנתית - קלט למודל'],
  ['40_year-summary', 'output', 'תוצאות החישוב של המודל השנתי'],
  ['41_daily-predicted', 'output', 'ביקוש יומי - מודל שנתי'],
  ['42_hourly-predicted', 'output', 'ביקוש שעתי - מודל שנתי'],
  ['50_scenarios-yearly', 'output', 'scenarios מחוללים לפי התרחישים עם מדדים ברמה שנתית'],
  ['60_daily-chart', 'charts', 'גרף ביקוש וייצור יומי'],
  ['61_yearly-chart', 'charts', 'גרף שנתי - לנתוני המודל השנתי'],
  ['90_run-history', 'saved', 'יומן המתעד את הרצות המודל השנתי'],
  null,
  ['10_demand-yearly', 'base', 'ביקוש שנתי (TWh) לפי תרחיש, 2023-2050. מקור: תחזית נוגה. נטען מ-data/yearly_demand.csv'],
  ['11_must-run-yearly', 'base', 'קיבולת must-run (MW) לפי שנה. נטען מ-data/must_run_yearly.csv'],
  ['12_raw-data-hourly', 'base', 'נתונים שעתיים לשנת ייחוס 2023. מקור: דו"ח מצב משק החשמל. נטען מ-data/hourly_demand23.csv'],
  ['13_costs', 'base', 'עלויות וירידת מחירים (הערכות ומחקרים, בהם Bloomberg). נטען מ-data/costs.csv'],
  null,
  ['_meta', 'status', 'גרסת נתונים וחתימה (hash)'],
  ['_status', 'status', 'סטטוס בדיקת נתונים וגרסאות']
];

function _writeSheetsTable(ss) {
  var doc = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!doc) return;
  var colA = doc.getRange(1, 1, Math.min(doc.getMaxRows(), 200), 1).getValues();
  var header = -1;
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === DESIGN_SHEETS_HEADER) { header = i + 1; break; }
  }
  if (header < 0) { console.log("_writeSheetsTable: header '" + DESIGN_SHEETS_HEADER + "' not found in column A, skipped"); return; }
  var start = header + 3;
  doc.getRange(start, 1, DESIGN_SHEETS_OLD_ROWS, 2).clear();
  DESIGN_SHEETS_TABLE.forEach(function(entry, k) {
    if (!entry) return;
    var sheet = ss.getSheetByName(entry[0]);
    var row = start + k;
    var cellA = doc.getRange(row, 1);
    var role = DESIGN_ROLES[entry[1]];
    var style = SpreadsheetApp.newTextStyle().setForegroundColor('#ffffff').setBold(true).build();
    var builder = SpreadsheetApp.newRichTextValue().setText(entry[0]);
    if (sheet) builder.setLinkUrl('#gid=' + sheet.getSheetId());
    builder.setTextStyle(style);
    cellA.setRichTextValue(builder.build()).setBackground(role.color);
    doc.getRange(row, 2).setValue(entry[2]);
  });
}
