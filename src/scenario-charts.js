/**
 * Scenario charts (tab 32_scenarios-charts).
 *
 * One chart per metric (line or column), X axis = year, one series per scenario. Source: 31_scenarios-yearly.
 * Interaction: a checkbox per scenario (column A). Unchecking a scenario removes its line from ALL charts
 * (Sheets charts cannot toggle a series by clicking the legend, so the chart data are formulas that return #N/A
 * for unchecked scenarios). Checkbox states survive a rebuild.
 *
 * Layout: A4:B(4+n) scenario list with checkboxes; charts from D4, stacked; chart data in column D from row 5, under the charts.
 * To add a chart, add one entry to SCENARIO_CHART_METRICS (column = header name in 31_scenarios-yearly).
 */
const SHEET_SCENARIO_CHARTS = '32_scenarios-charts';
const SCENARIO_CHARTS_FIRST_ROW = 5;      // first scenario row (checkboxes)
const SCENARIO_CHARTS_MASTER_ROW = 3;     // 'all' checkbox: sets every scenario checkbox
const SCENARIO_CHARTS_DATA_COL = 4;       // chart data blocks start here (D), under the charts
const SCENARIO_CHARTS_MAX_SCENARIOS = 20;
const SCENARIO_CHARTS_CTRL_HEADER_ROW = SCENARIO_CHARTS_FIRST_ROW + SCENARIO_CHARTS_MAX_SCENARIOS + 1; // chart controls: show | chart | order
const SCENARIO_CHARTS_CTRL_MASTER_ROW = SCENARIO_CHARTS_CTRL_HEADER_ROW - 1; // 'all charts' checkbox
const SCENARIO_CHARTS_CTRL_FIRST_ROW = SCENARIO_CHARTS_CTRL_HEADER_ROW + 1;
const SCENARIO_CHART_ROWS_PER_CHART = 25; // sheet rows a chart occupies; row height is fixed below so charts never cover the data
const SCENARIO_CHART_ROW_PX = 21;
const SCENARIO_CHART_WIDTH = 1100;
const SCENARIO_CHART_HEIGHT = SCENARIO_CHART_ROWS_PER_CHART * SCENARIO_CHART_ROW_PX - 25;

const SCENARIO_CHART_METRICS = [
  {column: 'totalCostCummulativeNPV', title: 'Total discounted cost, cumulative (billion ILS)', divisor: 1e9, format: '#,##0'},
  // Stacked columns: one column per scenario (final year), one stack segment per resource. 'Other' = total minus the listed resources (DFS).
  {kind: 'stacked', total: 'totalCostCummulativeNPV', title: 'Cumulative discounted cost by resource (billion ILS)', divisor: 1e9, format: '#,##0',
   series: [['gasTotalCummulativeNPV', 'Gas'], ['externalitiesCummulativeNPV', 'External costs'], ['solarTotalCummulativeNPV', 'Solar'],
            ['windTotalCummulativeNPV', 'Wind'], ['storageTotalCummulativeNPV', 'Storage'], ['v2gTotalCummulativeNPV', 'V2G'],
            ['nuclearTotalCummulativeNPV', 'Nuclear'], ['wasteToEnergyTotalCummulativeNPV', 'Waste to energy'],
            ['hydrogenTotalCummulativeNPV', 'Hydrogen']]},
  {column: 'renewableShare', title: 'Renewable energy share', divisor: 1, format: '0%'},
  {column: 'gasCummulative', title: 'Total gas consumption, cumulative (BCM)', divisor: 1, format: '0.0'},
  // Column charts: one group of columns per year, one column per scenario.
  {column: 'maxGasCapacity', title: 'Fossil capacity (GW)', divisor: 1000, format: '0.0', type: 'column',
   refLines: [{label: 'הספק 2025 13,500 MW', value: 13.5, color: '#000000'}, {label: 'הספק 2030 19,000 MW', value: 19, color: '#000000'}]},
  {column: 'solarCapacity', title: 'Solar capacity (GW)', divisor: 1000, format: '0.0', type: 'column'},
  {column: 'storageEnergy', title: 'Storage capacity (GWh)', divisor: 1000, format: '0.0', type: 'column'},
  {column: 'gasConsumption', title: 'Annual gas consumption (BCM)', divisor: 1, format: '0.00', type: 'column'},
  // refLines: horizontal reference lines (value in chart units, constant over the years), shown as extra line series in the legend.
  {column: 'gasCo2', title: 'Greenhouse gas emissions (CO2), annual (million tons)', divisor: 1e6, format: '0.0', type: 'column',
   refLines: [{label: 'יעד 2030: 30% הפחתה (26.2)', value: 26.2, color: '#000000'}, {label: 'יעד 2050: 85% הפחתה (5.6)', value: 5.6, color: '#000000'}]},
  {column: 'newSolarCapacity', title: 'New solar installations, annual (GW)', divisor: 1000, format: '0.0', type: 'column'}
];

/** Menu action: rebuilds 32_scenarios-charts from the current 31_scenarios-yearly. */
function refreshScenarioCharts() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SHEET_YEAR_STATES_OUTPUT)) {
    SpreadsheetApp.getUi().alert('31_scenarios-yearly does not exist. Run "Run Scenarios" first.');
    return;
  }
  buildScenarioCharts();
  SpreadsheetApp.setActiveSheet(ss.getSheetByName(SHEET_SCENARIO_CHARTS));
}

function buildScenarioCharts() {
  var ss = SpreadsheetApp.getActive();
  var src = ss.getSheetByName(SHEET_YEAR_STATES_OUTPUT);
  if (!src) return;
  var values = src.getDataRange().getValues();
  var headers = values[0];
  var nameCol = headers.indexOf('name'), yearCol = headers.indexOf('year');
  if (nameCol < 0 || yearCol < 0) throw new Error('31_scenarios-yearly: missing name/year headers');

  // Scenario names in order of appearance, and the year range.
  var names = [], minYear = Infinity, maxYear = -Infinity;
  for (var r = 1; r < values.length; r++) {
    var nm = values[r][nameCol], yr = Number(values[r][yearCol]);
    if (nm === '' || isNaN(yr)) continue;
    if (names.indexOf(nm) < 0) names.push(nm);
    minYear = Math.min(minYear, yr);
    maxYear = Math.max(maxYear, yr);
  }
  if (names.length === 0) return;
  if (names.length > SCENARIO_CHARTS_MAX_SCENARIOS) {
    throw new Error('Too many scenarios for 32_scenarios-charts (' + names.length + ', max ' + SCENARIO_CHARTS_MAX_SCENARIOS + ')');
  }
  var metrics = SCENARIO_CHART_METRICS.filter(function(m) {
    if (m.kind === 'stacked') return headers.indexOf(m.total) >= 0 && m.series.every(function(x) { return headers.indexOf(x[0]) >= 0; });
    return headers.indexOf(m.column) >= 0;
  });

  var sheet = getOrCreateSheet(SHEET_SCENARIO_CHARTS);
  // Remember the checkbox choices (unchecked scenarios), then wipe the tab.
  var unchecked = {}, oldOrder = {};
  var old = sheet.getRange(SCENARIO_CHARTS_FIRST_ROW, 1, SCENARIO_CHARTS_MAX_SCENARIOS, 3).getValues();
  old.forEach(function(row) {
    if (row[1] === '') return;
    if (row[0] === false) unchecked[row[1]] = true;
    if (row[2] !== '') oldOrder[row[1]] = row[2];
  });
  // Remember the chart controls (show / order per chart title).
  var oldCtrl = {};
  sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW, 1, SCENARIO_CHARTS_MAX_SCENARIOS, 3).getValues().forEach(function(row) {
    if (row[1] !== '') oldCtrl[row[1]] = {show: row[0] !== false, order: row[2]};
  });
  sheet.getCharts().forEach(function(c) { sheet.removeChart(c); });
  sheet.clear();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).removeCheckboxes();

  // Controls.
  sheet.getRange('A1').setValue('Scenario charts').setFontSize(14).setFontWeight('bold');
  sheet.getRange('A2').setValue('Uncheck a scenario to hide it in all charts. Source: 31_scenarios-yearly (updated by Run Scenarios).')
    .setFontColor('#666666');
  sheet.getRange(SCENARIO_CHARTS_FIRST_ROW - 1, 1, 1, 3).setValues([['show', 'scenario', 'order']]).setFontWeight('bold').setBackground('#eeeeee');
  var first = SCENARIO_CHARTS_FIRST_ROW;
  sheet.getRange(first, 1, names.length, 3).setValues(names.map(function(n, i) { return [!unchecked[n], n, oldOrder[n] !== undefined ? oldOrder[n] : i + 1]; }));
  // Series order in all charts: by the order column (ties: order of appearance). 'ordered' = indices into names (= list rows).
  var ordered = names.map(function(n, i) { return {i: i, o: Number(sheet.getRange(first + i, 3).getValue())}; })
    .sort(function(a, b) { return (isNaN(a.o) ? a.i + 1 : a.o) - (isNaN(b.o) ? b.i + 1 : b.o) || a.i - b.i; })
    .map(function(x) { return x.i; });
  var snames = ordered.map(function(i) { return names[i]; });
  sheet.getRange(first, 1, names.length, 1).insertCheckboxes();
  // Master checkbox (A3): toggling it checks or clears all scenarios (see handleScenarioChartsEdit, called from onEdit).
  sheet.getRange(SCENARIO_CHARTS_MASTER_ROW, 1, 1, 2).setValues([[names.every(function(n) { return !unchecked[n]; }), 'all (check = show all, uncheck = hide all)']])
    .setFontWeight('bold');
  sheet.getRange(SCENARIO_CHARTS_MASTER_ROW, 1).insertCheckboxes();

  // Chart controls (below the scenario list): show checkbox and order number per chart. Charts appear stacked in order.
  sheet.getRange(SCENARIO_CHARTS_CTRL_HEADER_ROW, 1, 1, 3).setValues([['show', 'chart', 'order']]).setFontWeight('bold').setBackground('#eeeeee');
  sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW, 1, metrics.length, 3).setValues(metrics.map(function(m, i) {
    var o = oldCtrl[m.title];
    return [o ? o.show : true, m.title, o && o.order !== '' ? o.order : i + 1];
  }));
  sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW, 1, metrics.length, 1).insertCheckboxes();
  sheet.getRange(SCENARIO_CHARTS_CTRL_MASTER_ROW, 1, 1, 2).setValues([[metrics.every(function(m) { return !oldCtrl[m.title] || oldCtrl[m.title].show; }),
    'all charts (check = show all, uncheck = hide all)']]).setFontWeight('bold');
  sheet.getRange(SCENARIO_CHARTS_CTRL_MASTER_ROW, 1).insertCheckboxes();
  var ctrlMetrics = metrics; // control-table order (original), used below for the links
  metrics = metrics.map(function(m, i) { return {m: m, i: i, show: sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW + i, 1).getValue() === true,
      order: Number(sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW + i, 3).getValue())}; })
    .filter(function(x) { return x.show; })
    .sort(function(a, b) { return (isNaN(a.order) ? a.i + 1 : a.order) - (isNaN(b.order) ? b.i + 1 : b.order) || a.i - b.i; })
    .map(function(x) { return x.m; });

  // Chart data (under the charts): one block per metric, years down, scenarios across.
  var chartRows = metrics.length * SCENARIO_CHART_ROWS_PER_CHART;
  // Chart data sits under the charts (column D, from the first row): charts are allowed to cover it, so no space is wasted.
  var dataRow = SCENARIO_CHARTS_FIRST_ROW;
  var dataCol = SCENARIO_CHARTS_DATA_COL;
  var nYears = maxYear - minYear + 1;
  var srcName = "'" + SHEET_YEAR_STATES_OUTPUT + "'";
  var charts = [];
  metrics.forEach(function(m, k) {
    var titleRow = dataRow, hdrRow = dataRow + 1, firstYearRow = dataRow + 2;
    if (m.kind === 'stacked') {
      // Scenarios down, resources across; value = last year of each scenario.
      var labels = m.series.map(function(x) { return x[1]; }).concat(['Other (DFS)']);
      var title = m.title + ', up to ' + maxYear;
      sheet.getRange(titleRow, dataCol).setValue('Chart data: ' + title + ' (formulas, do not edit)').setFontWeight('bold').setFontColor('#666666');
      sheet.getRange(hdrRow, dataCol, 1, labels.length + 1).setValues([['scenario'].concat(labels)]).setFontWeight('bold').setBackground('#eeeeee');
      var nameRefCol = _columnLetter(dataCol);
      var rows = [], scen = [];
      for (var i = 0; i < names.length; i++) {
        var nameRef = '$' + nameRefCol + (firstYearRow + i);
        var piece = function(col) {
          return 'SUMIFS(INDEX(' + srcName + '!$A:$ZZ,0,MATCH("' + col + '",' + srcName + '!$1:$1,0)),'
            + srcName + '!$A:$A,' + nameRef + ',' + srcName + '!$B:$B,' + maxYear + ')';
        };
        var checkbox = '$A$' + (first + ordered[i]);
        var row = m.series.map(function(x) { return '=IF(' + checkbox + ',' + piece(x[0]) + '/' + m.divisor + ',NA())'; });
        row.push('=IF(' + checkbox + ',(' + piece(m.total) + '-' + m.series.map(function(x) { return piece(x[0]); }).join('-') + ')/' + m.divisor + ',NA())');
        rows.push(row);
        scen.push([snames[i]]);
      }
      sheet.getRange(firstYearRow, dataCol, names.length, 1).setValues(scen);
      sheet.getRange(firstYearRow, dataCol + 1, names.length, labels.length).setFormulas(rows).setNumberFormat(m.format);
      sheet.getRange(firstYearRow, dataCol, names.length, labels.length + 1).setFontColor('#666666');
      charts.push(sheet.newChart()
        .setChartType(Charts.ChartType.COLUMN)
        .addRange(sheet.getRange(hdrRow, dataCol, names.length + 1, labels.length + 1))
        .setNumHeaders(1)
        .setOption('isStacked', true)
        .setOption('useFirstColumnAsDomain', true)
        .setOption('title', title)
        .setOption('hAxis.title', 'scenario')
        .setOption('vAxis.format', m.format)
        .setOption('legend.position', 'bottom')
        .setOption('width', SCENARIO_CHART_WIDTH)
        .setOption('height', SCENARIO_CHART_HEIGHT)
        .setPosition(SCENARIO_CHARTS_FIRST_ROW - 1 + k * SCENARIO_CHART_ROWS_PER_CHART, 4, 0, 0)
        .build());
      dataRow = firstYearRow + names.length + 2;
      return;
    }
    sheet.getRange(titleRow, dataCol).setValue('Chart data: ' + m.title + ' (formulas, do not edit)').setFontWeight('bold').setFontColor('#666666');
    var refs = m.refLines || [];
    sheet.getRange(hdrRow, dataCol, 1, names.length + refs.length + 1).setValues([['year'].concat(snames, refs.map(function(r) { return r.label; }))]).setFontWeight('bold').setBackground('#eeeeee');
    var years = [], formulas = [];
    for (var i = 0; i < nYears; i++) {
      years.push([minYear + i]);
      var row = [];
      for (var j = 0; j < names.length; j++) {
        var colLetter = _columnLetter(dataCol + 1 + j);
        var checkbox = '$A$' + (first + ordered[j]);
        var sumifs = 'SUMIFS(INDEX(' + srcName + '!$A:$ZZ,0,MATCH("' + m.column + '",' + srcName + '!$1:$1,0)),'
          + srcName + '!$A:$A,' + colLetter + '$' + hdrRow + ',' + srcName + '!$B:$B,$' + _columnLetter(dataCol) + (firstYearRow + i) + ')';
        row.push('=IF(' + checkbox + ',' + sumifs + (m.divisor !== 1 ? '/' + m.divisor : '') + ',NA())');
      }
      refs.forEach(function(r) { row.push('=' + r.value); });
      formulas.push(row);
    }
    sheet.getRange(firstYearRow, dataCol, nYears, 1).setValues(years);
    var body = sheet.getRange(firstYearRow, dataCol + 1, nYears, names.length + refs.length);
    body.setFormulas(formulas).setNumberFormat(m.format);
    sheet.getRange(firstYearRow, dataCol, nYears, names.length + refs.length + 1).setFontColor('#666666');
    var seriesOpts = {};
    // In a combo chart Sheets draws only the first series as columns unless every series has an explicit type.
    if (refs.length) for (var si = 0; si < names.length; si++) seriesOpts[si] = {type: m.type === 'column' ? 'bars' : 'line'};
    refs.forEach(function(r, ri) { seriesOpts[names.length + ri] = {type: 'line', color: r.color, lineWidth: 2, lineDashStyle: [6, 4], pointSize: 0}; });

    var chart = sheet.newChart()
      .setChartType(refs.length ? Charts.ChartType.COMBO : (m.type === 'column' ? Charts.ChartType.COLUMN : Charts.ChartType.LINE))
      .addRange(sheet.getRange(hdrRow, dataCol, nYears + 1, names.length + refs.length + 1))
      .setNumHeaders(1)
      .setOption('useFirstColumnAsDomain', true)
      .setOption('title', m.title)
      .setOption('seriesType', m.type === 'column' ? 'bars' : 'line')
      .setOption('series', seriesOpts)
      .setOption('hAxis.title', 'year')
      .setOption('hAxis.format', '0')
      .setOption('vAxis.format', m.format)
      .setOption('legend.position', 'bottom')
      .setOption('width', SCENARIO_CHART_WIDTH)
      .setOption('height', SCENARIO_CHART_HEIGHT)
      .setPosition(SCENARIO_CHARTS_FIRST_ROW - 1 + k * SCENARIO_CHART_ROWS_PER_CHART, 4, 0, 0)
      .build();
    charts.push(chart);
    dataRow = firstYearRow + nYears + 2;
  });
  charts.forEach(function(c) { sheet.insertChart(c); });
  // Fixed row height over the chart area, so a chart never extends into the data below.
  sheet.setRowHeights(SCENARIO_CHARTS_FIRST_ROW - 1, chartRows + 1, SCENARIO_CHART_ROW_PX);
  sheet.setHiddenGridlines(true);
  // Chart names in the control table become links that scroll to the chart (visible charts only).
  metrics.forEach(function(m, vi) {
    var ci = ctrlMetrics.indexOf(m);
    var anchor = _columnLetter(4) + (SCENARIO_CHARTS_FIRST_ROW - 1 + vi * SCENARIO_CHART_ROWS_PER_CHART);
    sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW + ci, 2)
      .setFormula('=HYPERLINK("#gid=' + sheet.getSheetId() + '&range=' + anchor + '","' + m.title.replace(/"/g, '""') + '")');
  });

  sheet.setColumnWidth(1, 50);
  sheet.setColumnWidth(2, 160);
  // Row 1 is frozen and holds links back to the control tables, so they are always one click away while scrolling the charts.
  var gid = sheet.getSheetId();
  sheet.getRange('D1').setFormula('=HYPERLINK("#gid=' + gid + '&range=A3","↑ Scenario controls")');
  sheet.getRange('F1').setFormula('=HYPERLINK("#gid=' + gid + '&range=A' + SCENARIO_CHARTS_CTRL_MASTER_ROW + '","↑ Chart list")');
  sheet.getRange('D1:F1').setFontWeight('bold');
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
}

/** Called from onEdit: the master checkbox (A3) sets all scenario checkboxes to its own value; the chart controls (show/order) rebuild the layout. */
function handleScenarioChartsEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== SHEET_SCENARIO_CHARTS) return;
  // Scenario order number (column C of the scenario list): rebuild so the series follow the new order.
  if (range.getRow() >= SCENARIO_CHARTS_FIRST_ROW && range.getRow() < SCENARIO_CHARTS_FIRST_ROW + SCENARIO_CHARTS_MAX_SCENARIOS
      && range.getColumn() === 3 && range.getNumRows() === 1 && range.getNumColumns() === 1) {
    buildScenarioCharts();
    return;
  }
  // 'All charts' checkbox: set every chart's show checkbox, then rebuild.
  if (range.getRow() === SCENARIO_CHARTS_CTRL_MASTER_ROW && range.getColumn() === 1 && range.getNumRows() === 1 && range.getNumColumns() === 1) {
    var showAll = range.getValue() === true;
    var ctrl = sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW, 1, SCENARIO_CHARTS_MAX_SCENARIOS, 2);
    var cv = ctrl.getValues();
    sheet.getRange(SCENARIO_CHARTS_CTRL_FIRST_ROW, 1, SCENARIO_CHARTS_MAX_SCENARIOS, 1)
      .setValues(cv.map(function(row) { return [row[1] === '' ? row[0] : showAll]; }));
    buildScenarioCharts();
    return;
  }
  // Chart controls (show checkbox in A, order number in C): rebuild so the charts appear in the chosen order.
  var r0 = range.getRow(), c0 = range.getColumn();
  if (r0 >= SCENARIO_CHARTS_CTRL_FIRST_ROW && r0 < SCENARIO_CHARTS_CTRL_FIRST_ROW + SCENARIO_CHARTS_MAX_SCENARIOS
      && range.getNumRows() === 1 && range.getNumColumns() === 1 && (c0 === 1 || c0 === 3)) {
    buildScenarioCharts();
    return;
  }
  if (range.getRow() !== SCENARIO_CHARTS_MASTER_ROW || range.getColumn() !== 1 || range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
  var value = range.getValue() === true;
  var block = sheet.getRange(SCENARIO_CHARTS_FIRST_ROW, 1, SCENARIO_CHARTS_MAX_SCENARIOS, 2);
  var cur = block.getValues();
  block.offset(0, 0, SCENARIO_CHARTS_MAX_SCENARIOS, 1).setValues(cur.map(function(row) { return [row[1] === '' ? row[0] : value]; }));
}

/** 1 -> A, 27 -> AA. */
function _columnLetter(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
