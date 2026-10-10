/**
 * Reference test (regression test, reference scenario).
 *
 * Runs one fixed roadmap end to end (simulation + costs) WITHOUT writing to any sheet,
 * and compares the key results to values recorded earlier (REFERENCE_EXPECTED, in
 * reference_test_expected.js). Any unintended change in code or data shows up as a difference.
 *
 *  - recordReferenceTest(): runs the roadmap and shows the JSON to paste into reference_test_expected.js.
 *  - runReferenceTest():    runs the roadmap and prints PASS / FAIL with the differences.
 */

const REFERENCE_ROADMAP_NAME = 'Base';
const REFERENCE_TOLERANCE = 1e-6; // relative
const REFERENCE_YEARS = [2030, 2040, 2050]; // years whose details are compared

// Keyframes of the "Base" roadmap, copied from 30_roadmaps-keyframes (2026-10-10).
// Column order = KEYFRAME_HEADERS. Kept in code so edits in the sheet do not change the reference.
const REFERENCE_KEYFRAMES = [
  ['Base', 2026, 8000, 500, 6000, 0.9083333333333333, 0.81, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3],
  ['Base', 2030, 18000, 500, 10000, 0.9166666666666666, 0.82, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3],
  ['Base', 2035, 25000, 500, 20000, 0.925, 0.83, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3],
  ['Base', 2040, 32500, 500, 30000, 0.9333333333333333, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3],
  ['Base', 2045, 40000, 500, 50000, 0.9416666666666667, 0.87, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3],
  ['Base', 2050, 50000, 500, 80000, 0.95, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.3, 0.3]
];

// Parameters that are overridden per year by the roadmap; excluded from the input snapshot.
const REFERENCE_OVERRIDDEN_PARAMETERS = [
  'currentYear', 'solarCapacity', 'windCapacity', 'storageEnergy', 'storageCapacity',
  'storageEfficiency', 'storageEfficiencySqrt', 'storageDepthOfDischarge',
  'effectiveStorageEnergy', 'minStorageEnergy', 'v2gEnergy', 'nuclearCapacity',
  'wasteToEnergyCapacity', 'hydrogenProductionCapacity', 'hydrogenImportCapacity',
  'hydrogenStorage', 'dfsHoursPerYear', 'dfsReductionPerHour', 'totalEnergyDemandYearly',
  'futureDemandFactor', 'mustRun'
];

/** Builds the reference roadmap from the embedded keyframes (same logic as readRoadmapsFromKeyframes). */
function _buildReferenceRoadmap() {
  var years = [];
  var last = null;
  REFERENCE_KEYFRAMES.forEach(function(row) {
    var current = new YearState(row.slice(), KEYFRAME_HEADERS);
    current.interpolate(last).forEach(function(s) { years.push(s); });
    years.push(current);
    last = current;
  });
  return new Roadmap(years);
}

/** Runs the reference roadmap and returns {inputs, results}. Writes nothing to the sheet. */
function _computeReference() {
  var in_data = getInputData();
  var costsDb = getCostsDb();
  var roadmap = _buildReferenceRoadmap();
  // Snapshot the inputs before simulate(), which updates parameters.hydrogenStorage.
  var inputs = {};
  Object.keys(in_data.parameters).sort().forEach(function(k) {
    if (REFERENCE_OVERRIDDEN_PARAMETERS.indexOf(k) === -1) inputs[k] = in_data.parameters[k];
  });
  roadmap.simulate(in_data);
  roadmap.calculateCosts(costsDb, in_data.parameters);

  var results = {
    totalCost: roadmap.totalCost,
    solarCost: roadmap.solarCost,
    windCost: roadmap.windCost,
    storageCost: roadmap.storageCost,
    gasCost: roadmap.gasCost,
    externalities: roadmap.externalities,
    maxRenewableShare: roadmap.maxRenewableShare,
    maxFossilCapacity: roadmap.maxFossilCapacity
  };
  REFERENCE_YEARS.forEach(function(y) {
    var s = roadmap.yearStateByYear[y];
    results['renewableShare_' + y] = s.renewableShare;
    results['gasGeneration_' + y] = s.gasGeneration;
    results['maxGasCapacity_' + y] = s.maxGasCapacity;
    results['totalCost_' + y] = s.totalCost;
  });
  return {inputs: inputs, results: results};
}

function _relDiff(actual, expected) {
  if (typeof expected !== 'number' || typeof actual !== 'number') {
    return actual === expected ? 0 : Infinity;
  }
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9);
}

/** Returns lines describing differences between two flat objects (empty = identical). */
function _diffObjects(actual, expected) {
  var lines = [];
  var keys = Object.keys(expected);
  Object.keys(actual).forEach(function(k) { if (keys.indexOf(k) === -1) keys.push(k); });
  keys.forEach(function(k) {
    var d = _relDiff(actual[k], expected[k]);
    if (!(d <= REFERENCE_TOLERANCE)) {
      lines.push(k + ': expected=' + expected[k] + ' actual=' + actual[k] +
        (d === Infinity ? '' : ' (diff ' + (d * 100).toExponential(2) + '%)'));
    }
  });
  return lines;
}

function _showReferenceMessage(title, text) {
  Logger.log(title + '\n' + text);
  try {
    SpreadsheetApp.getUi().alert(title, text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // No UI in this context (e.g. run from the editor or a trigger): the result is in the log only.
  }
}

/** Records the current results. Paste the output into reference_test_expected.js. */
function recordReferenceTest() {
  var out = _computeReference();
  var json = JSON.stringify({roadmap: REFERENCE_ROADMAP_NAME, recorded: new Date().toISOString(),
    inputs: out.inputs, results: out.results}, null, 2);
  Logger.log(json);
  var html = HtmlService.createHtmlOutput(
    '<p>Copy into reference_test_expected.js as REFERENCE_EXPECTED:</p>' +
    '<textarea style="width:100%;height:340px" onclick="this.select()">' +
    json.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>')
    .setWidth(640).setHeight(440);
  SpreadsheetApp.getUi().showModalDialog(html, 'Reference test results');
}

/** Runs the reference roadmap and compares to the recorded values. Returns 'PASS' | 'FAIL' | 'INPUT CHANGED'. */
function runReferenceTest() {
  if (typeof REFERENCE_EXPECTED === 'undefined' || REFERENCE_EXPECTED === null) {
    _showReferenceMessage('Reference test: no expected values', 'Run recordReferenceTest() first and paste the result into reference_test_expected.js.');
    return 'NO EXPECTED';
  }
  var out = _computeReference();
  var inputDiffs = _diffObjects(out.inputs, REFERENCE_EXPECTED.inputs);
  var resultDiffs = _diffObjects(out.results, REFERENCE_EXPECTED.results);
  var status;
  var text;
  if (resultDiffs.length === 0) {
    status = 'PASS';
    text = 'All ' + Object.keys(out.results).length + ' values match (tolerance ' + REFERENCE_TOLERANCE + ').\n' +
      'NPV (totalCost) = ' + out.results.totalCost;
    if (inputDiffs.length) text += '\n\nNote: parameter inputs differ from the recorded ones:\n' + inputDiffs.join('\n');
  } else if (inputDiffs.length) {
    status = 'INPUT CHANGED';
    text = 'Parameters in 01_parameters differ from the recorded ones, so the comparison is not valid:\n' +
      inputDiffs.join('\n') + '\n\nResult differences:\n' + resultDiffs.join('\n');
  } else {
    status = 'FAIL';
    text = resultDiffs.join('\n');
  }
  _showReferenceMessage('Reference test: ' + status, text);
  return status;
}
