const SHEET_HISTORY = "90_run-history"; 
const SHEET_SAVED_ROADMAPS = '32_saved-roadmaps';

// --- Helper Function: Read (name, value) pairs from a sheet ---
// Reads names (nameColumn), units (the column right after the name) and values (valueColumn) together,
// so that a header built from the names is ALWAYS aligned with the values built in the same pass.
// Section-label rows (a name with no unit and no value, e.g. "Last Calculation Parameter Values")
// are skipped. A named row that has a unit but an empty value is kept as a blank cell.
function getNameValuePairs(sheetName, startRow, nameColumn, valueColumn) {
  var sheet = getSheet(sheetName);
  var numRows = sheet.getLastRow() - startRow + 1;
  if (numRows < 1) return [];
  var nameCol = nameColumn.charCodeAt(0) - 64; // Column letter (e.g. "A") -> number (1)
  var valueCol = valueColumn.charCodeAt(0) - 64;
  var lastCol = Math.max(nameCol + 1, valueCol);
  var data = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
  var pairs = [];
  data.forEach(function(row) {
    var name = row[nameCol - 1];
    var unit = row[nameCol];       // the column right after the name holds the unit
    var value = row[valueCol - 1];
    if (String(name) === '') return;                                  // empty row
    if (String(value) === '' && String(unit) === '') return;          // section label
    pairs.push({ name: name, value: value });
  });
  return pairs;
}

/**
 * AUTOMATED LOGGING SYSTEM
 * Captures the entire state of a simulation run (Inputs + Outputs) into a single row.
 * Creates an "Audit Trail" allowing the engineer to compare different runs over time.
 * Header and values are built from the same (name, value) pairs, and a new header row is
 * appended (never inserted over history) whenever the layout differs from the last header.
 */
function logRunToHistory() {
  // --- Configuration ---
  var parameterStartRow = 2; // Row where the parameter data *starts* (first row of data)
  var parameterNameColumn = "A";
  var parameterValueColumn = "C";
  var summaryStartRow = 3;   // Row where the summary data *starts*
  var summaryNameColumn = "A";
  var summaryValueColumn = "C";

  var historySheet = getOrCreateSheet(SHEET_HISTORY);

  // --- Build header and data from the same pairs ---
  var pairs = getNameValuePairs(SHEET_PARAMETERS, parameterStartRow, parameterNameColumn, parameterValueColumn)
    .concat(getNameValuePairs(SHEET_SUMMARY, summaryStartRow, summaryNameColumn, summaryValueColumn));
  // Run identity (step 6): who, code version, data version, data hash check. Columns follow Timestamp.
  var runMeta = getRunMetadata();
  var metaNames = ['run_id', 'researcher', 'code_version', 'data_version', 'data_hash_match'];
  var headerRow = ["Timestamp"].concat(metaNames, pairs.map(function(p) { return p.name; }));
  var newData = [new Date()].concat(
    metaNames.map(function(n) { return runMeta[n]; }),
    pairs.map(function(p) { return p.value; }));

  // --- Find the last header row ("Timestamp" in column A) and compare it with the new layout ---
  var lastRow = historySheet.getLastRow();
  var needHeader = true;
  if (lastRow > 0) {
    var colA = historySheet.getRange(1, 1, lastRow, 1).getValues();
    for (var r = colA.length - 1; r >= 0; r--) {
      if (colA[r][0] === "Timestamp") {
        var lastHeader = historySheet.getRange(r + 1, 1, 1, headerRow.length).getValues()[0];
        needHeader = lastHeader.join('|') !== headerRow.join('|');
        break;
      }
    }
  }
  if (needHeader) {
    historySheet.getRange(lastRow + 1, 1, 1, headerRow.length).setValues([headerRow]);
    lastRow++;
  }

  // --- Write the data row ---
  historySheet.getRange(lastRow + 1, 1, 1, newData.length).setValues([newData]);
}

/**
 * SNAPSHOT UTILITY
 * Allows the user to select a specific model result and save it to a separate sheet 
 * for detailed offline analysis or presentation.
 */
function saveRoadmapToSheet(ss,saveSheet) {
  var ui = SpreadsheetApp.getUi();// Access Google Sheets UI for popups
  var sourceSheet = ss.getSheetByName(SHEET_YEAR_STATES_OUTPUT);

  var nextRow = saveSheet.getLastRow() + 1;

  var values = sourceSheet.getDataRange().getValues();
  var header = values[0];

  // Extract unique model names to present a clean list to the user
  var models = getUniqueModelsFromColumn(values, 0);

  var msg = "the models " + models.join(", ") + "\'write the exact model name:";
  var resp = ui.prompt(" choose the model to save ", msg, ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) {
    ui.alert("cancel.");
    return;
  }

  var modelInput = (resp.getResponseText() || "").trim();
  // Validation: Check if input is empty
  if (!modelInput) {
    ui.alert("there is no such model");
    return;
  }

  var nameresp = ui.prompt("enter the saving name", 'Choose your scenarion saved name', ui.ButtonSet.OK_CANCEL);
  if (nameresp.getSelectedButton() !== ui.Button.OK) {
    ui.alert("cancel.");
    return;
  }
  var nameInput = (nameresp.getResponseText() || "").trim();

  // --- Model Validation ---
  // Normalize strings (uppercase/trim) to ensure case-insensitive matching
  var norm = function(s){ return String(s).trim().toUpperCase(); };
  var chosen = models.find(m => norm(m) === norm(modelInput));
  if (!chosen) {
    ui.alert("the model '"+modelInput+"'  .  doesnt exist : " + models.join(", "));
    return;
  }

  var stamp = nameInput;

  // Optional free-text description (what was tried and why), saved with the roadmap.
  var descResp = ui.prompt("description (optional)", "What did you try, and why?", ui.ButtonSet.OK_CANCEL);
  if (descResp.getSelectedButton() !== ui.Button.OK) {
    ui.alert("cancel.");
    return;
  }
  var description = (descResp.getResponseText() || "").trim();

  // Run identity (step 6): who, code version, data version, data hash check.
  var runMeta = getRunMetadata();
  var metaNames = ['run_id', 'researcher', 'code_version', 'data_version', 'data_hash_match'];
  var prefix = [stamp].concat(metaNames.map(function(n) { return runMeta[n]; }), [description]);
  var headerRow = ["Saved at"].concat(metaNames, ["description"], header);

  // Add a header row when the sheet is empty or the last header differs from the new layout
  // (never inserted over existing rows).
  var needHeader = true;
  if (nextRow > 1) {
    var colA = saveSheet.getRange(1, 1, nextRow - 1, 1).getValues();
    for (var h = colA.length - 1; h >= 0; h--) {
      if (colA[h][0] === "Saved at") {
        var lastHeader = saveSheet.getRange(h + 1, 1, 1, headerRow.length).getValues()[0];
        needHeader = lastHeader.join('|') !== headerRow.join('|');
        break;
      }
    }
  }

  var out = [];
  if (needHeader) out.push(headerRow);
  values.forEach(function(row, i) {
    if (i === 0) return; // source header
    if (norm(row[0]) === norm(chosen)) out.push(prefix.concat(row));
  });

  saveSheet.getRange(nextRow, 1, out.length, out[0].length).setValues(out);

}


function getUniqueModelsFromColumn(values, colIndex) {
  var seen = {};
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var v = values[i][colIndex];
    if (v === "" || v == null) continue;
    var key = String(v).trim();
    if (key && !seen[key.toUpperCase()]) {
      seen[key.toUpperCase()] = true;
      out.push(key);
    }
  }
  return out;
}
