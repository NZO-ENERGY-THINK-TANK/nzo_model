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

  '10_demand-yearly': 'base',
  '11_must-run-yearly': 'base',
  '12_raw-data-hourly': 'base',
  '13_assumptions': 'base',

  '20_year-input': 'input',
  '14_assumptions-yearly': 'output',
  '21_year-summary': 'output',
  '22_year-daily': 'output',
  '23_year-hourly': 'output',
  '24_year-chart-day': 'charts',
  '25_year-chart-annual': 'charts',

  '30_scenarios-input': 'input',
  '31_scenarios-yearly': 'output',
  '29_year-run-history': 'saved',
  
  '_meta': 'status',
  '_status': 'status'
};

// Calculated cells inside an input tab: grey text + warning-only protection. None at present: 20_year-input has only
// plain inputs (storage efficiency and depth of discharge, rows 16-17, were formulas reading 14_assumptions-yearly until 17.10.2026).
const DESIGN_CALCULATED_CELLS = {};
// Cells that were calculated in an earlier version and are plain inputs now: grey text and background are reset.
const DESIGN_FORMER_CALCULATED_CELLS = {
  '20_year-input': ['C16:C17']
};

// Number formats. In 13_assumptions, columns H:N (change_2022..2050) hold fractions (-0.162 = a 16.2% decrease), shown as percent.
const DESIGN_NUMBER_FORMATS = {
  '13_assumptions': [['H2:N200', '0.0%']]
};

// Tab order = tab codes: documentation, 2x single year (Predict Year), 3x scenarios, 1x shared base data, system.
const DESIGN_TAB_ORDER = [
  '00_documentation',
  '20_year-input', '21_year-summary', '22_year-daily', '23_year-hourly', '24_year-chart-day', '25_year-chart-annual', '29_year-run-history',
  '30_scenarios-input', '31_scenarios-yearly',
  '14_assumptions-yearly',
  '10_demand-yearly', '11_must-run-yearly', '12_raw-data-hourly', '13_assumptions',
  '_meta', '_status'
];

const DESIGN_LEGEND_SHEET = '00_documentation';

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
  Object.keys(DESIGN_NUMBER_FORMATS).forEach(function(name) {
    lines.push(name + ': number format ' + DESIGN_NUMBER_FORMATS[name].map(function(f) { return f[0] + ' = ' + f[1]; }).join(', '));
  });
  console.log(lines.join('\n'));
  return lines;
}

/** Applies tab colors, warning-only protections, calculated-cell look, number formats, menu docs, run guide and the tab list (with the color legend as group headers). Idempotent. */
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
  Object.keys(DESIGN_FORMER_CALCULATED_CELLS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    DESIGN_FORMER_CALCULATED_CELLS[name].forEach(function(a1) {
      sheet.getRange(a1).setFontColor('#000000').setBackground(null);
    });
  });
  Object.keys(DESIGN_NUMBER_FORMATS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    DESIGN_NUMBER_FORMATS[name].forEach(function(f) { sheet.getRange(f[0]).setNumberFormat(f[1]); });
  });
  _applyParameterDropdowns(ss);
  var externalLinkRow = _readExternalLinkRow(ss); // read before the area is cleared
  _clearDocsArea(ss);
  _writeMenuDocs(ss);
  var guideEnd = _writeRunGuide(ss);
  var tableEnd = _writeSheetsTable(ss, guideEnd + 2, externalLinkRow);
  _writeDependencyDiagram(ss, tableEnd);
  _applyTabOrder(ss);
  SpreadsheetApp.flush();
}

/**
 * Dropdowns in 20_year-input (found by the label in column A, so row moves do not matter):
 * 'demand-forecast' = the forecasts in DEMAND_FORECAST_COLUMNS; 'predicted year' = 2023..2050.
 * The year list is built here, so no helper list in the sheet is needed.
 */
function _applyParameterDropdowns(ss) {
  var sheet = ss.getSheetByName(SHEET_PARAMETERS);
  if (!sheet) return;
  var labels = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map(function(r) { return r[0]; });
  var years = [];
  for (var y = 2023; y <= 2050; ++y) years.push(String(y));
  var lists = {'demand-forecast': Object.keys(DEMAND_FORECAST_COLUMNS), 'predicted year': years};
  Object.keys(lists).forEach(function(label) {
    var row = labels.indexOf(label) + 1;
    if (row < 1) return;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(lists[label], true).setAllowInvalid(false).build();
    sheet.getRange(row, 3).setDataValidation(rule);
  });
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

// 00_documentation columns A:C (menu docs, run guide, tab list) are written entirely by code, top to bottom, with
// every block placed after the previous one. The area is cleared first so leftovers of earlier layouts never remain.
// The only manual row is the external link to Noga's forecast (first row under the tab-list header): it is read
// before the clearing (_readExternalLinkRow) and written back.
const DESIGN_DOCS_CLEAR_ROWS = 150;
function _clearDocsArea(ss) {
  var sheet = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!sheet) return;
  sheet.getRange(1, 1, Math.min(sheet.getMaxRows(), DESIGN_DOCS_CLEAR_ROWS), 3).clear();
}

/** Finds the tab-list header ('גליונות' in column A) and returns the rich text of the row two rows below it, or null. */
function _readExternalLinkRow(ss) {
  var doc = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!doc) return null;
  var colA = doc.getRange(1, 1, Math.min(doc.getMaxRows(), DESIGN_DOCS_CLEAR_ROWS), 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === DESIGN_SHEETS_HEADER) {
      var row = doc.getRange(i + 3, 1, 1, 3);
      var first = String(row.getValues()[0][0]).trim();
      if (!first || Object.keys(DESIGN_SCHEME).indexOf(first) >= 0 || first === 'קלט אישי') return null; // not the external link row
      return row.getRichTextValues()[0];
    }
  }
  return null;
}

// Menu documentation written to 00_documentation (A1 and down). Keep in sync with buildMenu() in main.js.
const DESIGN_MENU_DOCS_ANCHOR = {row: 1, col: 1};
const DESIGN_MENU_DOCS = [
  ['תפריט NZO Model', 'מה הפעולה עושה', 'לשוניות שמתעדכנות'],
  ['Predict Year', 'מריצה את המודל השנתי לשנה שב-20_year-input!C3: תמהיל ייצור, אחוז מתחדשות, פליטות', '23_year-hourly, 22_year-daily, 21_year-summary, 29_year-run-history'],
  ['Calculate Costs', 'מחשבת את טבלת ההנחות השנתית מ-13_assumptions ומציגה אותה ב-14. רצה אוטומטית ב-Calculate Scenarios and Costs וב-Sync. להפעלה ידנית רק לצפייה ב-14', '14_assumptions-yearly'],
  ['Calculate Scenarios and Costs', 'מריצה את כל ה-scenarios שב-30_scenarios-input ומחשבת עלויות. מבקשת אישור לפני דריסה', '31_scenarios-yearly, 14_assumptions-yearly'],
  ['Sync from master', 'מעתיקה את נתוני הבסיס (10–13) מהמאסטר לעותק שלך, בודקת תקינות (hash וכותרות), ומריצה Calculate Costs. לא נוגעת בקלט שלך ובתוצאות. מבקשת אישור לפני דריסה', '10_demand-yearly, 11_must-run-yearly, 12_raw-data-hourly, 13_assumptions, 14_assumptions-yearly, _meta, _status'],
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

// Run guide, written below the menu documentation. Returns the last row used.
const DESIGN_RUN_GUIDE = [
  ['שני use cases', ''],
  ['Use case 1: Predict Year (שנה בודדת)', 'קלט: 20_year-input (כחול). הרצה: Predict Year. תוצאות: 21–25 (21_year-summary נפתחת בסיום), והיסטוריה ב-29_year-run-history'],
  ['Use case 2: תרחישים (scenarios)', 'קלט: 30_scenarios-input (טבלת הגדרות לכל scenario ומתחתיה keyframes). הרצה: Calculate Scenarios and Costs. תוצאות: 31_scenarios-yearly'],
  ['משותף לשניהם', 'נתוני בסיס 10–13 (מסונכרנים מהמאסטר) ו-14_assumptions-yearly (פלט מחושב להצגה). לשונית קלט של use case אחד אינה משפיעה על האחר'],
  ['בדיקת נתונים', 'Advanced → Check data status: גרסת קוד וגרסת נתונים צריכות להיות תואמות למאסטר'],
  ['', ''],
  ['בדיקה להרצה ראשונה', ''],
  ['א.', 'בחר תחזית ביקוש ב-20_year-input!C2 ושנה ב-C3'],
  ['ב.', 'הרץ Predict Year'],
  ['ג.', 'ודא ש-Advanced → Run reference test מחזיר PASS'],
  ['ד.', 'בעותק שקיבלת מגרסה ישנה: Advanced → Set up scenario settings (פעם אחת), ושנה שמות לשוניות לפי הטבלה למטה']
];

function _writeRunGuide(ss) {
  var sheet = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!sheet) return 0;
  var startRow = DESIGN_MENU_DOCS_ANCHOR.row + DESIGN_MENU_DOCS.length + 1;
  sheet.getRange(startRow, 1, DESIGN_RUN_GUIDE.length, 2).setValues(DESIGN_RUN_GUIDE);
  [0, 6].forEach(function(i) { sheet.getRange(startRow + i, 1, 1, 2).setFontWeight('bold'); });
  return startRow + DESIGN_RUN_GUIDE.length - 1;
}

// Tab list (table of contents), organized by use case. Each group has a header row; every tab row shows its role
// (the tab color) in column C. Header text 'גליונות' is also what _readExternalLinkRow searches for.
const DESIGN_SHEETS_HEADER = 'גליונות';
const DESIGN_SHEETS_TABLE = [
  {title: 'Use case 1: Predict Year (שנה בודדת)', color: '#1565c0',
   note: 'קלט ב-20_year-input, הרצה בתפריט Predict Year, תוצאות בלשוניות 21–25', tabs: [
    ['20_year-input', 'קלט ידני: תחזית ביקוש, השנה לחיזוי, הקיבולות (סולארי, רוח, גרעין, אגירה, מימן), DFS ו-V2G'],
    ['21_year-summary', 'סיכום תוצאות השנה, עם כותרת השנה בשורה 1. נפתחת בסיום Predict Year'],
    ['22_year-daily', 'תוצאות ברמה יומית לכל השנה'],
    ['23_year-hourly', 'תוצאות ברמה שעתית לכל השנה (8,760 שעות)'],
    ['24_year-chart-day', 'גרף ביקוש וייצור ליום אחד, מבוסס על 23_year-hourly (בחירת יום ב-B1)'],
    ['25_year-chart-annual', 'גרף "יום אחר יום" לכל השנה. העמודות נשלפות מ-22_year-daily לפי הכותרות בשורה 24'],
    ['29_year-run-history', 'יומן הרצות Predict Year: קלט, תוצאות, גרסת קוד וגרסת נתונים']]},
  {title: 'Use case 2: תרחישים (scenarios)', color: '#00695c',
   note: 'קלט ב-30_scenarios-input, הרצה בתפריט Calculate Scenarios and Costs', tabs: [
    ['30_scenarios-input', 'למעלה: טבלת הגדרות לכל scenario (תחזית ביקוש, ריבית, נצילות מימן). מתחתיה: keyframes לפי שנה'],
    ['31_scenarios-yearly', 'תוצאות כל ה-scenarios ברמה שנתית, כולל עלויות ופליטות']]},
  {title: 'משותף לשני ה-use cases', color: '#6d4c41',
   note: 'נתוני בסיס (מסונכרנים מהמאסטר) ותוצר ההנחות לפי שנה', tabs: [
    ['10_demand-yearly', 'ביקוש שנתי (TWh) לפי תרחיש, 2023-2050. מקור: תחזית נוגה. נטען מ-data/yearly_demand.csv'],
    ['11_must-run-yearly', 'קיבולת must-run (MW) לפי שנה. נטען מ-data/must_run_yearly.csv'],
    ['12_raw-data-hourly', 'נתונים שעתיים לשנת ייחוס 2023. מקור: דו"ח מצב משק החשמל. נטען מ-data/hourly_demand23.csv'],
    ['13_assumptions', 'הנחות לפי טכנולוגיה: עלויות, אורך חיים, יעילות, מקדמי פליטה וירידת מחירים (הערכות ומחקרים, בהם Bloomberg). נטען מ-data/costs.csv'],
    ['14_assumptions-yearly', 'פלט מחושב להצגה בלבד (לא קלט של אף use case): 13_assumptions מורחבת לכל שנה 2022–2050 (אינטרפולציה של ה-change_). מתעדכנת ב-Calculate Scenarios and Costs, ב-Sync וב-Calculate Costs']]},
  {title: 'מערכת', color: '#757575',
   note: 'גרסאות ובדיקת תקינות', tabs: [
    ['_meta', 'גרסת נתונים וחתימה (hash)'],
    ['_status', 'סטטוס בדיקת נתונים וגרסאות']]}
];

/**
 * Writes the tab list starting at startRow: title, column headings, the preserved external link row (Noga's forecast),
 * then the groups. Returns the next free row.
 */
function _writeSheetsTable(ss, startRow, externalLinkRow) {
  var doc = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!doc) return 0;
  var row = startRow;
  doc.getRange(row, 1).setValue(DESIGN_SHEETS_HEADER).setFontWeight('bold');
  doc.getRange(row + 1, 1, 1, 3).setValues([['שם', 'תיאור', 'סוג']]).setFontWeight('bold');
  row += 2;
  if (externalLinkRow) { doc.getRange(row, 1, 1, 3).setRichTextValues([externalLinkRow]); row++; }
  DESIGN_SHEETS_TABLE.forEach(function(group) {
    row++; // blank row between groups
    doc.getRange(row, 1, 1, 3).setValues([[group.title, group.note, '']])
      .setBackground(group.color).setFontColor('#ffffff').setFontWeight('bold');
    row++;
    group.tabs.forEach(function(tab) {
      var sheet = ss.getSheetByName(tab[0]);
      var builder = SpreadsheetApp.newRichTextValue().setText(tab[0]);
      if (sheet) builder.setLinkUrl('#gid=' + sheet.getSheetId());
      doc.getRange(row, 1).setRichTextValue(builder.build());
      doc.getRange(row, 2).setValue(tab[1]);
      var role = DESIGN_ROLES[DESIGN_SCHEME[tab[0]]];
      if (role) doc.getRange(row, 3).setValue(role.label).setBackground(role.color).setFontColor('#ffffff');
      row++;
    });
  });
  return row;
}

const DESIGN_DIAGRAM_ALT_PREFIX = 'NZO dependency diagram ';
const DESIGN_DIAGRAM_OLD_ALTS = ['NZO tab dependency diagram', 'NZO dependency diagram use case 1', 'NZO dependency diagram use case 2']; // earlier versions, removed when found
const DESIGN_DIAGRAM_WIDTH = 1000; // px; the PNGs are DEPENDENCY_DIAGRAM_SIZE.width wide
const DESIGN_DIAGRAM_ROWS = 21;    // rows reserved for one diagram (title + image)

/** Writes the dependency diagrams (use case 1, use case 2, system), each with a title, below the tab list. Replaces earlier copies. */
function _writeDependencyDiagram(ss, tableEnd) {
  var doc = ss.getSheetByName(DESIGN_LEGEND_SHEET);
  if (!doc || !tableEnd) return;
  doc.getImages().forEach(function(img) {
    var alt = img.getAltTextTitle() || '';
    if (DESIGN_DIAGRAM_OLD_ALTS.indexOf(alt) >= 0 || alt.indexOf(DESIGN_DIAGRAM_ALT_PREFIX) === 0) img.remove();
  });
  var diagrams = [
    {key: 'use-case-1', title: 'דיאגרמת תלויות: Use case 1 (Predict Year)', base64: DEPENDENCY_DIAGRAM_1_PNG_BASE64},
    {key: 'use-case-2', title: 'דיאגרמת תלויות: Use case 2 (תרחישים)', base64: DEPENDENCY_DIAGRAM_2_PNG_BASE64},
    {key: 'system', title: 'דיאגרמת מערכת: גרסת נתונים, hash ו-Sync', base64: DEPENDENCY_DIAGRAM_3_PNG_BASE64}
  ];
  var needRows = tableEnd + 2 + DESIGN_DIAGRAM_ROWS * diagrams.length;
  if (doc.getMaxRows() < needRows) doc.insertRowsAfter(doc.getMaxRows(), needRows - doc.getMaxRows());
  diagrams.forEach(function(dg, i) {
    var titleRow = tableEnd + 2 + i * DESIGN_DIAGRAM_ROWS;
    doc.getRange(titleRow, 1, DESIGN_DIAGRAM_ROWS, 1).clear();
    doc.getRange(titleRow, 1).setValue(dg.title).setFontWeight('bold');
    var blob = Utilities.newBlob(Utilities.base64Decode(dg.base64), 'image/png', 'dependency-diagram-' + dg.key + '.png');
    var image = doc.insertImage(blob, 1, titleRow + 1);
    image.setAltTextTitle(DESIGN_DIAGRAM_ALT_PREFIX + dg.key);
    image.setWidth(DESIGN_DIAGRAM_WIDTH).setHeight(Math.round(DESIGN_DIAGRAM_WIDTH * DEPENDENCY_DIAGRAM_SIZE.heights[i] / DEPENDENCY_DIAGRAM_SIZE.width));
  });
}
