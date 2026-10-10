# NZO_removed_code.md — גיבוי קוד שנמחק

## 2026-10-04 — ניקיון ראשוני (שלב 1), קבוצות א, ב, ג
הפונקציות נמחקו אחרי אישור של David. כל פונקציה כאן עם המיקום המקורי (קובץ, שורות כולל תגובת התיעוד שלפניה).
שלוש הפונקציות שנקראו רק מפונקציות מתות נמחקו יחד איתן.
בנוסף: שורות התפריט המוערות בקובץ 1 (שורות 24–25) שהפנו ל-`sensitivityAnalysis` ול-`stochasticAnalysis` — ראו סעיף "הערות תפריט".

### הערות תפריט (קובץ 1, שורות 24–25) — לא נמחקו בשלב זה
```
// {name: 'sensitivity Analysis', functionName: 'sensitivityAnalysis'},
// {name: 'stochastic Analysis',functionName: 'stochasticAnalysis'}
```

---

## קבוצה ג — תחזית חלופית

### getInputDataAlternative — קובץ 3, שורות 22–41
```js
/**
 * Alternative Data Loader.
 * Ingests baseline data, applies scenario-specific demand mutations, 
 * and prepares the final payload for simulation.
 */
function getInputDataAlternative(){
  var params = getParameters();                 // Load baseline static parameters
  var futureForecast = futureDemandForecast();  // Load baseline demand forecast
  var hoursGen = _getHoursGeneration();         // Load hourly physical profiles
  
  // Mutate the baseline demand forecast with the alternative scenario logic
  alternateFutureForecast(futureForecast); 
  
  return {
    hoursGen,
    futureForecast,
    // Merge strategy: Update static parameters with dynamic values derived from the forecast
    parameters: update(params, forecastParameters(params, futureForecast))
  };
};
```

### alternateFutureForecast — קובץ 3, שורות 43–80
```js
/**
 * Demand Forecast Mutator (Linear Interpolation).
 * Calculates and applies an annualized, compounded growth/reduction factor to the 
 * baseline demand, smoothing out the multi-year shocks defined in the scenario.
 */
function alternateFutureForecast(futureForecast) {
  // Extract the vector of demand changes from the alternative scenario sheet
  var changes = readTableFromSheet(SHEET_SENSITIVITY, 2, CHANGES_HEADERS)[0];
  
  var i = 2; 
  var year = Number(CHANGES_HEADERS[i]); 
  year++; // Start applying changes from the following year

  var demandFactor = 0; // Running total of the demand shift
  var END_YEAR = 2050;

  // Iterate through the defined milestone periods (e.g., 2025 -> 2030)
  while (year < END_YEAR && (i + 1) < CHANGES_HEADERS.length) {   
    var targetYear = Number(CHANGES_HEADERS[i + 1]);
    var yearsRef = targetYear - year + 1; // Span length (e.g., 5 years)
    
    // Calculate the annualized step (linear slope between milestones)
    var demandFactorAdd = (Number(changes[i + 1]) - Number(changes[i])) / yearsRef;
    
    // Fill the gap between the years with the interpolated values
    while (year <= targetYear) {
      
      demandFactor += demandFactorAdd; // Accumulate the step
      
      // Null Safety: Verify the year exists before mutating its demand value
      if (futureForecast[year] && futureForecast[year].demand !== undefined) {
        futureForecast[year].demand *= (1 + demandFactor);
      }
      year++;
    }
    i++; // Move to the next milestone period
  }
}
```

---

## קבוצה א — Sensitivity

### sensitivityAnalysis — קובץ 1, שורות 84–131
```js
/**
 * Sensitivity Analysis Orchestrator (A/B Testing).
 * Compares a baseline scenario against an alternative reality where 
 * both physical parameters (demand) and financial parameters (costs) are mutated.
 */
function sensitivityAnalysis(){
  
  // --- 1. Baseline Execution (The Control Group) ---
  var in_data = getInputData(); // Standard physical constraints
  var costsDb = getCostsDb();   // Standard financial forecast
  var allYearStates = [];

  // Ask the user for the model name only once, then reuse it for the alternative run
  var baseRoadmap = chooseRoadmap();
  var modelName = baseRoadmap.name;
  baseRoadmap.simulate(in_data);
  baseRoadmap.calculateCosts(costsDb, in_data.parameters);
  
  // Tag baseline results for easy identification in the output sheet
  baseRoadmap.years.forEach(function (s){
    s.name += " - base scenario";
  });
  allYearStates = allYearStates.concat(baseRoadmap.years);

  // --- 2. Alternative Execution (The Test Group) ---
  // Load mutated datasets (applying both price shocks and demand shifts)
  costsDb = getCostsDbAlternative();
  in_data = getInputDataAlternative(); 
  
  var alternativeRoadmap = chooseRoadmap(modelName); // silent mode: no second prompt
  
  // Re-run the physics engine with the new demand forecast
  alternativeRoadmap.simulate(in_data); 
  
  // Re-run the financial engine with the new cost forecast
  alternativeRoadmap.calculateCosts(costsDb, in_data.parameters); 
  
  // Tag alternative results
  alternativeRoadmap.years.forEach(function (s){
    s.name += " - Alternative scenario";
  });
  allYearStates = allYearStates.concat(alternativeRoadmap.years);

  // --- 3. Output & Persistence ---
  // Dump both runs side-by-side into the database for comparative analysis
  saveYearStatesOutput(allYearStates); 
  SpreadsheetApp.flush(); // Force Google Sheets to render changes immediately
}
```

### getCostsDbAlternative — קובץ 2, שורות 178–191
```js
/**
 * Alternative Costs Database Loader.
 * Builds a modified cost database for sensitivity analysis by applying user-defined 
 * economic shocks (e.g., price drops/spikes) to the baseline data.
 */
function getCostsDbAlternative() {
  // Extract: Read raw rows, skipping the header line
  var rows = readTableFromSheet(SHEET_COSTS, 2, FORECASTED_PARAM_HEADERS);
  var changes=readTableFromSheet(SHEET_SENSITIVITY, 2, CHANGES_HEADERS)
  changeCostsBySensitivity(rows,changes);
  // Transform: Convert raw data rows into smart objects containing forecasting logic
  costs = rows.map(row => new ForecastedParam(row));
  return new CostsDb(costs);
}
```

### changeCostsBySensitivity — קובץ 2, שורות 193–213
```js
/**
 * Cost Mutator Function.
 * Applies user-defined economic shocks (% changes) directly to the cost database.
 */
function changeCostsBySensitivity(rows,changes){
rows.forEach(function (row){
  changes.forEach(function(change){
    if(row[0]==change[0]&&row[1]==change[1]){
      //changeing each relvent row in the cost section
      for (var i = 2; i < 9; i++) {
          var currentChange = Number(change[i]) || 0;
          var value1 = Number(row[i + 5]) || 0;
          var value2 = Number(row[i + 12]) || 0;

          row[i + 5] =  (1 + value1) * (1 + currentChange)-1;
          row[i + 12] = value2 * (1 + currentChange);
      }
    }
  })
})
}
```

---

## קבוצה ב — Stochastic

### stochasticAnalysis — קובץ 1, שורות 181–241
```js
function stochasticAnalysis() {
  var scriptStart = new Date();   // the 6-minute limit counts from here
  var in_data = getInputData(); // Standard physical constraints
  var costsDb = getCostsDb();   // Standard financial forecast
  var maxRuntimeMs = getSimulationRuntimeMs();
  var firstRoadmap = chooseRoadmap();

  var stochasticLimits = getstochasticLimits();
  var kpi = [];

  var start = new Date();       // Start the execution timer
  var lastIterationMs = 0;      // duration of the previous iteration, used to predict the next one
  var stoppedBySafeLimit = false;

  try {
    // Loop until the requested runtime is reached
    while (new Date() - start <= maxRuntimeMs) {
      // Safety: don't start an iteration that could cross the 6-minute cap
      if ((new Date() - scriptStart) + lastIterationMs > STOCHASTIC_SAFE_LIMIT_MS) {
        stoppedBySafeLimit = true;
        break;
      }
      var iterationStart = new Date();
      Logger.log('Starting new iteration...');

      // 1. Create a clean, independent deep copy of the data and costs for the current run
      // Using dateReviver to ensure Date objects are properly reconstructed from JSON
      var scen_data = JSON.parse(JSON.stringify(in_data), dateReviver);
      var scen_Costs = JSON.parse(JSON.stringify(costsDb));
      var changes = {};
      // Apply the stochastic variations to the cloned objects
      change(scen_data, scen_Costs, stochasticLimits, changes);

      // 2. Initialize a new simulation engine *inside the loop*
      // This guarantees each scenario starts from a completely blank state
      var baseRoadmap = chooseRoadmap(firstRoadmap.name);

      // Execute the simulation model
      baseRoadmap.simulate(scen_data);
      baseRoadmap.calculateCosts(scen_Costs, scen_data.parameters);

      // 3. Deep copy the results to decouple them completely from the engine's memory
      // Using dateReviver again to preserve any Date objects within the simulation output
      var cleanResults = JSON.parse(JSON.stringify(baseRoadmap.years, dateReviver));
      kpi.push(kpiFromYearStates(cleanResults, changes));

      lastIterationMs = new Date() - iterationStart;
    }
  } finally {
    // Always save what was calculated so far - also if an iteration failed
    writeToSheet(SHEET_STOCHASTIC_OUTPUT, Stochastic_OUTPUT_HEADERS, kpi, 1, true, true);
    saveCosts(costsDb);
    SpreadsheetApp.flush();
  }

  var msg = kpi.length + ' runs saved to ' + SHEET_STOCHASTIC_OUTPUT;
  if (stoppedBySafeLimit) {
    msg += ' (stopped early: Google 6-minute limit)';
  }
  SpreadsheetApp.getActive().toast(msg, 'Stochastic Analysis', 10);
}
```

### getstochasticLimits — קובץ 11, שורות 129–145
```js
function getstochasticLimits() {

  var rows = readTableFromSheet(SHEET_STOCHASTIC_INPUT, 1, Stochastic_INPUT_HEADERS);
  var products = [];

  rows.forEach(function(row) {
    products.push(new ProductEnumeration(
      row[0], // product
      row[1], // "LB" column: maximal increase
      row[2] // "UB" column: maximal decrease

    ));
  });
  // 3. Encapsulation
  // Returns a high-level object that encapsulates the logic for generating permutations based on these parameters.
  return products;
};
```

### kpiFromYearStates — קובץ 11, שורות 95–127
```js
function kpiFromYearStates(cleanResults, changes) {
  var kpiRow = [];
  
  // Safety check: ensure cleanResults is valid and contains data
  if (!cleanResults || cleanResults.length === 0) {
    Logger.log("Warning: cleanResults is empty or undefined.");
    return kpiRow;
  }
  var lastyear = cleanResults[cleanResults.length - 1];
  
  // Iterate through the global headers to build the row in the exact correct order
  Stochastic_OUTPUT_HEADERS.forEach(function(header) {
    var cleanHeader = header.trim();
    
    if (cleanHeader === "totalCost") {
      kpiRow.push(lastyear.totalCostCummulativeNPV || 0);
    } 
    else if (cleanHeader === "maxRenewbleShare") {
      kpiRow.push(lastyear.renewableShare || 0);
    } 
    else {
      // If the header exists in our changes dictionary, push the multiplier.
      // Otherwise, push an empty string to maintain proper column alignment.
      if (changes[cleanHeader] !== undefined) {
        kpiRow.push(changes[cleanHeader]);
      } else {
        kpiRow.push(""); 
      }
    }
  });

  return kpiRow;
}
```

### getSimulationRuntimeMs — קובץ 11, שורות 147–176
```js
function getSimulationRuntimeMs() {
  var ui = SpreadsheetApp.getUi();
  var defaultSeconds = 10;
  
  var response = ui.prompt(
    'Simulation Runtime',
    'How many seconds should the simulation run?\n(Default: ' + defaultSeconds + ')',
    ui.ButtonSet.OK_CANCEL
  );

  // אם המשתמש לחץ על OK ויש טקסט
  if (response.getSelectedButton() === ui.Button.OK) {
    var inputText = response.getResponseText().trim();
    var seconds = parseInt(inputText, 10);
    
    // בודקים שהוזן מספר תקין ושהוא גדול מ-0
    if (!isNaN(seconds) && seconds > 0) {
      if (seconds * 1000 > STOCHASTIC_SAFE_LIMIT_MS) {
        ui.alert('Google limits a run to 6 minutes. The analysis will stop after about ' +
          (STOCHASTIC_SAFE_LIMIT_MS / 1000) + ' seconds and save the results.');
      }
      return seconds * 1000; // ממירים לאלפיות שנייה
    } else {
      ui.alert('Invalid input. Using the default time of ' + defaultSeconds + ' seconds.');
    }
  }
  
  // במקרה של ביטול או קלט לא תקין, נחזיר את ברירת המחדל באלפיות שנייה
  return defaultSeconds * 1000;
}
```

---

## 2026-10-10 — ניקיון ראשוני, סבב שני (קבוצה ד + `STOCHASTIC_SAFE_LIMIT_MS`)
הקוד נשאר ללא קורא אחרי הסרת הניתוחים sensitivity ו-stochastic (סבב 4.10.2026). נמחק באישור David.

### chooseRoadmap — קובץ 7 (year-state.gs), שורות 625–670
```js
/**
 * Interactive Roadmap Selector.
 * Prompts the user via Google Sheets UI to select a specific scenario (roadmap) to process.
 */
function chooseRoadmap(name = null) {
  var roadmaps = readRoadmapsFromKeyframes();

  // 1. Silent Mode (Used inside the loop)
  // If a name was provided, skip the UI and just return the matching engine
  
  if (name !== null) {
    return roadmaps.find(function(roadmap) {
      return roadmap.name === name;
    });
  }

  // 2. Interactive Mode (Used once before the loop)
  // If name is null, prompt the user via the UI
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sourceSheet = ss.getSheetByName(SHEET_ROADMAP_KEYFRAMES);
  var values = sourceSheet.getDataRange().getValues();

  // Extract unique model names to present a clean list to the user
  var models = getUniqueModelsFromColumn(values, 0);

  var msg = "The available models are: " + models.join(", ") + ".\nWrite the exact model name:";
  var resp = ui.prompt("Choose the model to simulate", msg, ui.ButtonSet.OK_CANCEL);
  
  if (resp.getSelectedButton() !== ui.Button.OK) {
    ui.alert("Simulation canceled.");
    throw new Error("User canceled the scenario selection."); // עוצר את הסקריפט לגמרי
  }
  
  var chosenName = resp.getResponseText().trim();
  
  var chosen = roadmaps.find(function(roadmap) {
    return roadmap.name === chosenName;
  });
  // Validation: stop with a clear message instead of crashing later on 'undefined'
  if (!chosen) {
    ui.alert('Model "' + chosenName + '" was not found.\nAvailable models: ' + models.join(', '));
    throw new Error('Unknown model: ' + chosenName);
  }
  return chosen;
}
```

### change — קובץ 11 (stochastic analysis.gs), שורות 33–93
```js
/**
 * Applies stochastic variations to model parameters and costs.
 * @param {Object} scen_data - Object containing general model parameters.
 * @param {Object} scen_Costs - The costs database object (costsDb).
 * @param {Array} stochasticLimits - Array of objects with product, lb, and ub.
 */
function change(scen_data, scen_Costs, stochasticLimits, changes) {

  // Re-attach CostsDb.get after the JSON deep copy (class methods are lost in JSON)
  if (typeof scen_Costs.get !== 'function') {
    scen_Costs.get = function(product, parameter, year) {
      if (!(product in this.db)) {
        throw "Missing product from CostsDb: " + product;
      }
      if (!(parameter in this.db[product])) {
        throw "Missing parameter from CostsDb: " + parameter;
      }
      return this.db[product][parameter].valuesByYear[year];
    };
  }

  stochasticLimits.forEach(function (p) {
    // NOTE: despite the names, the sheet column "LB" is the UPSIDE and "UB" is the DOWNSIDE:
    // ub is stored negated (see ProductEnumeration), so r is uniform in [1 - UB_sheet, 1 + LB_sheet]
    // (e.g. LB=UB=0.8 -> r between 0.2 and 1.8).
    let r = 1 + (Math.random() * (p.ub - p.lb) + p.lb);
    changes[p.product] = r;
    if (r === 1) return;

    var paramName = STOCHASTIC_PARAM_ALIASES[p.product] || p.product;

    if (p.product === 'futureDemandFactor') {
      // Case 1: scale the yearly demand forecast
      // (parameters.futureDemandFactor itself is recomputed per year from the forecast)
      for (let year = 2025; year <= 2050; year++) {
        if (scen_data.futureForecast[year]) {
          scen_data.futureForecast[year].demand *= r;
        }
      }
    } else if (scen_data.parameters[paramName] != null) {
      // Case 2: a model parameter (e.g. interestRate, solarCapacityRefYear)
      scen_data.parameters[paramName] *= r;
    } else {
      // Case 3: a cost product in the costs DB (e.g. ccgt, storage, emissions)
      var productDb = scen_Costs.db && scen_Costs.db[String(p.product).toLowerCase()];
      if (!productDb) {
        console.warn('stochastic: unknown product/parameter "' + p.product + '" - not applied');
        return;
      }
      STOCHASTIC_COST_TYPES.forEach(function (type) {
        var fp = productDb[type];
        if (!fp || !fp.valuesByYear) return;
        for (let year = 2025; year <= 2050; year++) {
          if (fp.valuesByYear[year] != null) {
            fp.valuesByYear[year] *= r;
          }
        }
      });
    }
  });
}
```

### ProductEnumeration — קובץ 11, שורות 96–102
```js
class ProductEnumeration{
  constructor(product, lb, ub) {
    this.product = product
    this.lb = lb;             // Sheet column "LB": maximal increase (r goes up to 1 + lb)
    this.ub = -ub;            // Sheet column "UB": maximal decrease, stored negated (r goes down to 1 + ub)
  };
};
```

### dateReviver + STOCHASTIC_SAFE_LIMIT_MS — קובץ 1 (main.gs), שורות 128–138
```js
// Google Apps Script stops any run after 6 minutes - and the clock includes the time
// spent answering the prompts. New iterations are not started past this point,
// leaving a margin to write the results to the sheet.
var STOCHASTIC_SAFE_LIMIT_MS = 5 * 60 * 1000;

function dateReviver(key, value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }
  return value;
}
```

---

## 2026-10-10 — ניקיון ראשוני, סבב שלישי (קבועים ללא קורא + הקובץ `stochastic analysis.gs` כולו)

### קובץ 2 (costs.gs)
שורה 2:
```js
const SHEET_SENSITIVITY='06_sensitivity-analysis'
```
שורות 27–37:
```js
var CHANGES_HEADERS = [
  'Product',
  'Parameter',
  '2022',
  '2025',
  '2030',
  '2035',
  '2040',
  '2045',
  '2050'
]
```

### קובץ 11 — `stochastic analysis.gs`, כל התוכן שנשאר (33 שורות)
```js
const SHEET_STOCHASTIC_INPUT = "40_stochastic-analysis-input"
const SHEET_STOCHASTIC_OUTPUT = "41_stochastic-analysis-output"

var Stochastic_OUTPUT_HEADERS = [
  "totalCost",
  "maxRenewbleShare",
  "pv-average",
  "wind",
  "storage",
  "ccgt",
  "emissions",
  "nuclear",
  "wastetoenergy",
  "v2g",
  "hydrogen-production",
  "hydrogen-reuse",
  "hydrogen-usage",
  "hydrogen",
  "solarCapacityRefYear",
  "windCapacityRefYear",
  "futureDemandFactor",
  "interest"
];
var Stochastic_INPUT_HEADERS = ['product', 'LB', 'UB'];
// Stochastic input names that differ from the internal parameter names (01_parameters mapping)
var STOCHASTIC_PARAM_ALIASES = {
  'interest': 'interestRate'
};

// Cost parameters varied for each cost product. Must be lower-case, as stored in CostsDb.
var STOCHASTIC_COST_TYPES = ['capex', 'opex', 'var-opex', 'fuel', 'co2', 'nox', 'sox', 'pmx'];
```

## 2026-10-10 — max/min ramp rate gas (not used by the model)
Removed from `PARAMETER_TO_VARIABLE_NAME` (parameters.js) and from `reference_test_expected.js` inputs:
```js
  'max ramp rate gas': 'maxRampRateGas',
  'min ramp rate gas': 'minRampRateGas',
```
Sheet: `01_parameters` rows 27-28 had `=MAX('91_ramp-rates'!E...)` / `=MIN('91_ramp-rates'!E...)` (cleared, rows kept blank). Old `91_ramp-rates` formulas (row n, data layout of old 04): A=`'04_raw-data-hourly'!E(n-1)` date, B=`F(n-1)`, C=`G(n-1)` hour of year, D=`K(n)-K(n-1)` change in must-run, E=`M(n)-M(n-1)` change in gas.
Old 01_parameters formulas: C4 `=SUM('04_raw-data-hourly'!L1:L8760)/C3`, C5 `=SUM('04_raw-data-hourly'!P1:P8760)/C6`, C7 `=sum('04_raw-data-hourly'!H1:H8760)`; replaced by H2:H8760, L2:L8760, F2:F8760 (same rows, new layout).
