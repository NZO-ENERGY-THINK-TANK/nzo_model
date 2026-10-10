/**
 * Robust Data Ingestion Module.
 * Reads data from a specified spreadsheet with built-in validation and memory optimization.
 * * Engineering Highlights:
 * 1. Schema Validation: Verifies that input columns match the expected code structure to prevent data misalignment.
 * 2. Pagination (Batching): Reads data in chunks (50 rows) to manage memory usage and avoid timeouts on large datasets.
 * 3. Dynamic Termination: Automatically detects the end of the data stream.
 * * @param {string} sheetName - The target sheet to read from.
 * @param {number} startingRow - The row index to begin reading (1-based).
 * @param {Array} expectedHeaders - A list of column names to validate data integrity.
 * @returns {Array} - The parsed data rows.
 */
function readTableFromSheet(sheetName, startingRow, expectedHeaders) {
  var rows = [];
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var firstRow = startingRow;
  // Optimization: Read in chunks of 50 to prevent hitting Google Apps Script memory limits
  var numRows = 50;
  var readHeaders = true;
  var finished = false;
  // PAGINATION LOOP
  while (!finished) {
    // Bulk read operation (I/O is expensive, so we do it in batches)
    var rawData = sheet.getRange(firstRow, 1, numRows, expectedHeaders.length).getValues();
    if (readHeaders) {// VALIDATION LOGIC (Runs once at the start)
      var headers = rawData.shift();// Extract the first row
      for (var j = 0; j < expectedHeaders.length; ++j) {
        // Integrity Check: Compare actual sheet header with expected code header
        if (headers[j] != expectedHeaders[j]) {
          throw "expectedHeaders changed and don't match the code: col=" + j + " found=" + headers[j] + " expected=" + expectedHeaders[j];
        }
      }
      readHeaders = false;
    }
    // PROCESSING LOOP
    for (var i = 0; i < rawData.length ; ++i) {
      row = rawData[i];
      // Stop Condition: If the primary key (first column) is empty, assume end of table.
      if (row[0] == '') {
        finished = true;
        break;
      }
      rows.push(row);
    }
    // Advance cursor for next batch
    firstRow += numRows;
  }
  return rows;
}

/**
 * Generic Data Persistence Utility.
 * Writes large datasets to a Spreadsheet with high performance and flexibility.
 * * Engineering Highlights:
 * 1. Polymorphism: Handles both raw Arrays (simple rows) and Structured Objects (dictionaries).
 * 2. Performance: Uses 'Batch Write' (setValues) to minimize expensive API calls to Google servers.
 * 3. Schema Alignment: Automatically maps Object keys to the correct columns based on the 'headers' definition.
 * * @param {string} sheetName - Target destination.
 * @param {Array} headers - Column definitions (Schema).
 * @param {Array} rowsList - The data payload (can be Array of Arrays OR Array of Objects).
 * @param {number} startingRow - Cursor position (for appending data).
 * @param {boolean} includeHeaders - Flag to write the schema row.
 * @param {boolean} clearContents - Flag to wipe previous data (Overwrite vs. Append mode).
 */
function writeToSheet(sheetName, headers, rowsList, startingRow, includeHeaders, clearContents) {
  // 1. Parameter Normalization (Default Values)
  startingRow = isNull(startingRow) ? 1 : startingRow;
  includeHeaders = isNull(includeHeaders) ? true : includeHeaders;
  clearContents = isNull(clearContents) ? true : clearContents;
  var outputSheet = getOrCreateSheet(sheetName);
  // 2. State Preparation
  // If in "Overwrite" mode, clean the slate first.
  if (clearContents) {
    outputSheet.clearContents();
  }
  var rows = []
  // Add Schema Definition if requested
  if (includeHeaders) {
    rows.push(headers);
  }
  // 3. Data Transformation Loop (The Polymorphic Engine)
  rowsList.forEach(function(rowObj) {
    var row;
    // Case A: Input is already a flat list (Array)
    // Direct pass-through.
    if (rowObj instanceof Array) {
      row = rowObj;
    // Case B: Input is a structured entity (Object)
    // Need to serialize: Map keys to values in the specific order of 'headers'.
    } else if (rowObj instanceof Object) {
      row = []
      headers.forEach(function(k) {
        row.push(rowObj[k]);// Extracts value by key name
      });
    }
    rows.push(row);
  });
  // 4. Batch Write Operation (I/O Optimization)
  // Writes thousands of cells in a single API call instead of thousands of small calls.
  if(rows.length){
    outputSheet.getRange(startingRow, 1, rows.length, headers.length).setValues(rows);
  }
  // UX Enhancement: Freeze the top row for better readability
  outputSheet.setFrozenRows(1);
}

/**
 * Sheet Management Utility.
 * Retrieves a reference to a spreadsheet tab, creating it dynamically if it does not exist.
 * * Engineering Highlight: "Idempotent Operation" / "Self-Healing"
 * This function allows the system to be robust against user error (e.g., accidentally deleting a tab).
 * It ensures the required infrastructure exists before any read/write operation is attempted.
 * * @param {string} sheetName - The unique identifier of the target sheet.
 * @returns {Sheet} - The Google Sheet object ready for I/O operations.
 */
function getOrCreateSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActive();
  // 1. Existence Check (Lookup)
  var sheet = spreadsheet.getSheetByName(sheetName);
  // 2. Conditional Creation (Lazy Initialization)
  // If the sheet is missing (null), create it immediately.
  if (!sheet) {
    // Insert the new sheet at the very end of the tab list (index = getNumSheets) 
    // to maintain a clean workspace organization.
    sheet = spreadsheet.insertSheet(sheetName, spreadsheet.getNumSheets());
  }  
  return sheet
}
 
/**
 * Strict Data Accessor.
 * Retrieves a reference to a required spreadsheet tab with validation.
 * * Engineering Principle: "Defensive Programming" / "Fail-Safe"
 * Unlike the 'Lazy Initialization' approach, this function assumes that the absence 
 * of a sheet is a critical system configuration error that requires human intervention.
 * * @param {string} sheetName - The identifier of the required resource.
 * @returns {Sheet|undefined} - The sheet object if found, otherwise returns undefined to signal failure.
 */
function getSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActive();
  // 1. Resource Lookup
  var sheet = spreadsheet.getSheetByName(sheetName);
  // 2. Critical Validation: a missing sheet stops the run with a clear message
  // (returning undefined would only cause a confusing error later).
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" not found!');
  }
  return sheet;
}
