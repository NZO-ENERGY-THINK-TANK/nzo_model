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

## 2026-10-10 — Demand scenarios removed from 03_future-yearly-demand (columns K–O)
David decided to keep only `Noga conservative` and `Noga BAU`. Removed scenarios (values backup, 03 columns K..O, rows 2..51 = years 2014..2050; N,O had formulas `='02_demand'!H20` / `!C20` etc. from 02 columns H and C):
```
year,demand-3,demand-3.5,demand-pua,demand-nzo,demand-Rashut hashmal
2014,61.4,61.4,61.4,,
2015,65.4,65.4,65.4,,
2016,67.3,67.3,67.3,,
2017,62.69,62.69,62.69,,
2018,64.5,64.5,64.5,,
2019,72.12,72.12,72.12,,
2020,74.2836,74.6442,74.53,,
2021,76.51210800000001,77.25674699999999,76.64,,
2022,78.80747124000001,79.96073314499998,78.79,,
2023,81.17169537720001,82.75935880507497,80.98,77.4,77.4
2024,83.60684623851601,85.65593636325258,83.21,80.16133347727201,79.56720000000001
2025,86.1150516256715,88.65389413596641,85.48,82.71063641205667,81.79508160000002
2026,88.69850317444164,91.75678043072523,87.78,84.73824860209531,84.08534388480003
2027,91.35945826967489,94.9682677458006,90.13,86.7797551909925,86.43973351357442
2028,94.10024201776514,98.29215711690361,92.52,88.83404237512968,88.86004605195451
2029,96.9232492782981,101.73238261599523,94.94,90.89990732611349,91.34812734140924
2030,99.83094675664705,105.29301600755505,97.41,92.97605357153085,93.9058749069687
2031,102.82587515934647,108.97827156781948,100.6,95.62503539595663,96.53523940436384
2032,105.91065141412686,112.79251107269315,103.9,98.72801532375541,99.23822610768603
2033,109.08797095655066,116.7402489602374,107.1,101.87089959965412,102.01689643870124
2034,112.36061008524719,120.8261576738457,110.3,105.05415787817815,104.87336953898487
2035,115.73142838780461,125.05507319243029,113.6,108.17042479020563,107.80982388607646
2036,119.20337123943875,129.43200075416533,116.86,111.32188903224583,110.8284989548866
2037,122.77947237662192,133.9621207805611,120.13,114.50868361565207,113.93169692562343
2038,126.46285654792058,138.65079500788073,123.41,117.73089915044802,117.12178443954089
2039,130.2567422443582,143.50357283315654,126.7,120.98858237561905,120.40119440384804
2040,134.16444451168897,148.526197882317,130,124.28173247128474,123.77242784715578
2041,138.18937784703965,153.72461480819808,133.21,127.10987100118514,127.23805582687615
2042,142.33505918245083,159.104976326485,136.42,130.1282975750908,130.80072139002868
2043,146.60511095792435,164.67365049791195,139.62,133.16414514384343,134.4631415889495
2044,151.00326428666207,170.43722826533886,142.82,136.217197776032,138.22810955344008
2045,155.53336221526195,176.4025312546257,146.02,139.00300157591556,142.0984966209364
2046,160.1993630817198,182.57661984853758,149.22,141.78953310742048,146.07725452632263
2047,165.0053439741714,188.9668015432364,152.42,144.57577303057604,150.16741765305966
2048,169.95550429339656,195.58063959724964,155.61,147.36062171248184,154.37210534734533
2049,175.05416942219847,202.42596198315337,158.8,150.14290491238808,158.69452429707098
2050,180.30579450486442,209.5108706525637,162,152.92136198252513,163.137970977389
```


## 2026-10-10 — removal of roadmap enumeration (sheets 20/21/22), save Roadmap, unused constant

### src/roadmaps-enumeration.js (whole file: enumeration sweep over sheets 20_/21_/22_)
```js
// Roadmap enumeration: automatic scan of parameter combinations (sheets 20_/21_/22_)
const SHEET_ROADMAP_INPUT = "20_roadmaps-input"
const SHEET_ROADMAP_OUTPUT = "21_roadmaps-output"
const SHEET_ROADMAP_SUMMARY = "22_roadmaps-summary"

var ROADMAPS_OUTPUT_HEADERS = ['name', 'solarCapacity', 'windCapacity', 'storageEnergy','v2gEnergy','nuclearCapacity','wasteToEnergyCapacity','hydrogenImportCapacity','hydrogenProductionCapacity','dfsHoursPerYear','dfsReductionPerHour',  'maxFossilCapacity', 
   'maxRenewableShare', 'solarCost', 'windCost', 'storageCost','v2gCost', 'gasCost','nuclearCost','wasteToEnergyCost','hydrogenCost','dfsCost', 'externalities', 'totalCost']//new************
var ROADMAPS_INPUT_HEADERS = ['parameter', 'val_base', 'min2050', 'max2050', 'interval', 'evaluated'];

/**
 * Data Ingestion Module.
 * Serves as the interface layer between the Spreadsheet UI and the Simulation Engine.
 * * Responsibilities:
 * 1. I/O Extraction: Fetches raw tabular data from the designated input sheet.
 * 2. Data Marshalling: Converts raw row arrays into structured 'ParameterEnumeration' objects.
 * 3. Aggregation: Packages the parsed parameters into a master 'RoadmapsEnumeration' container for sensitivity analysis.
 * * @returns {RoadmapsEnumeration} - The structured input object ready for scenario generation.
 */
function getRoadmapsEnumInput() {
  // 1. Raw Data Retrieval
  // Reads the table based on constant headers definition (SHEET_ROADMAP_INPUT).
  var rows = readTableFromSheet(SHEET_ROADMAP_INPUT, 1, ROADMAPS_INPUT_HEADERS);
  var paramEnums = [];
  // 2. Object Mapping (Marshalling)
  // Iterates through the raw spreadsheet rows and maps columns to object properties.
  rows.forEach(function(row) {
    paramEnums.push(new ParameterEnumeration(
      row[0], // Parameter Name / ID
      row[1], // Start Value (val_base)
      row[2], // min205
      row[3], // max2050
      row[4], // interval
      row[5]  // evaluted
    ));
  });
  // 3. Encapsulation
  // Returns a high-level object that encapsulates the logic for generating permutations based on these parameters.
  return new RoadmapsEnumeration(paramEnums);
};

/**
 * Sensitivity Analysis Iterator.
 * Implements the "Cartesian Product" logic to generate every possible combination of input parameters.
 * * Functionality:
 * Acts as an iterator/cursor that moves through the multi-dimensional parameter space.
 * For each step, it generates a full 'Roadmap' object representing that specific future scenario.
 */
class RoadmapsEnumeration{
  constructor(paramEnums) {
    this.params = paramEnums
    // Mapping: Allows accessing parameters by name (e.g., this['solarCapacity'])
    this.params.forEach(p => this[p.name] = p);// now parameters can be called by  paramEnums.(name of parameter)
    // True when resuming a saved sweep (every parameter already has an 'evaluated' value):
    // the first next() must then advance to the following combination instead of repeating the last one.
    // False on a fresh sweep, where the first next() must return the first combination.
    this.started = paramEnums.length > 0 && paramEnums.every(function(p) { return !isNull(p.evaluated); });
  }

  /**
   * Look-ahead check.
   * Recursive method to determine if there are more combinations left to generate.
   * @param {number} paramIdx - The current parameter dimension being checked.
   * @returns {boolean} - True if more permutations exist.
   */
  hasNext(paramIdx) {
    // Default to the first parameter (index 0)
    if (paramIdx === undefined) {
      paramIdx = 0;
    }
    // Base case: If we passed the last parameter, we are done.
    if (paramIdx === this.params.length) {
      return false;
    }
    // Recursive step: Check if current param has next, or if any subsequent param has next.
    if (this.params[paramIdx].hasNext()) {
      return true;
    }
    return this.hasNext(paramIdx + 1);
  };
  
  /**
   * THE GENERATOR CORE.
   * Advances the internal state to the next combination and constructs the corresponding Roadmap.
   * * Logic: "Odometer Algorithm"
   * Iterates from the right-most parameter to the left.
   * 1. Finds the first parameter that can be incremented.
   * 2. Increments it.
   * 3. Resets all parameters to its right back to their start value.
   * * @returns {Roadmap} - A fully initialized Roadmap object for the new scenario.
   */
  next() {
    // 1. Odometer Logic: Find the "right-most" parameter to advance
    for (var i = this.params.length - 1; i >= 0 ; --i) {
      if (this.params[i].hasNext()) {
        // Advance the specific parameter
        if (this.started){this.params[i].next();}
        // First run special case
        else {this.started=true;}
        // 2. Reset Logic: Reset all "digits" to the right of the changed parameter
        // (Like when a clock changes hour, the minutes reset to 00)
        for (var j = i + 1; j < this.params.length ; ++j) {
          this.params[j].reset();
        }
        // 3. YearState Construction: Extract values and build the Roadmap
        // Defines the target year (2050) and base year (2025)
        var targetParams = {year: 2050};
        var baseParams = {year: 2025};
        // Collect current values from the iterator state
        for (var k = 0; k < this.params.length ; ++k) {
          targetParams[this.params[k].name] = this.params[k].current();
          baseParams[this.params[k].name] = this.params[k].val_base;
        }
        // Instantiate YearState Objects
        var targetYearStateParams = new YearStateParams(targetParams);
        baseParams.name = targetYearStateParams.name;// Ensure consistent naming
        
        var baseYearStateParams = new YearStateParams(baseParams);
        // Generate the interpolation (Timeline) and wrap in a Roadmap object
        return new Roadmap(generateYearStates(baseYearStateParams, targetYearStateParams));
      }
    }
    
    // none of the params have a next value in line, throw exception
    throw new Error('RoadmapsEnumeration index out of bounds error');
  };
  
  /**
   * Progress Tracking.
   * Calculates a unique index representing the current position in the permutation space.
   * Useful for progress bars (e.g., "Scenario 50 of 5000").
   */
  lastIndex() {
    var sum = 0;
    for (var i = 0; i < this.params.length; ++i) {
      if (i > 0) {
        sum *= this.params[i].numValues();
      }
      sum += this.params[i].lastIndex();
    }
    return sum;
  };
  
  toRows() {
    var rows = [];
    this.params.forEach(function(p) { rows.push(p.toRow()); });
    return rows;
  };
};

/**
 * Single Parameter Range Iterator.
 * Manages the state and iteration logic for a specific variable dimension (e.g., Solar Capacity).
 * * Functionality:
 * Converts a continuous numerical range [min, max] into a discrete set of steps based on the defined interval.
 * It maintains its own state ('evaluated') to track progress during the sensitivity analysis loop.
 */
class ParameterEnumeration{
  constructor(name, val_base, min, max, interval, evaluated) {
    this.name = name
    this.val_base = val_base; // Baseline value (starting point for interpolation)
    this.min = min;             // Lower bound of the sensitivity range
    this.max = max;             // Upper bound
    this.interval = Math.max(1,interval);   // Step size

    // The current value in the iteration process. 
    // If null, the iteration hasn't started yet.
    this.evaluated = evaluated;
  };
  
  /**
   * Boundary Check.
   * Determines if the iterator has reached the upper limit of its range.
   * @returns {boolean} - True if there are more steps remaining.
   */
  hasNext() {
    return (this.evaluated !== this.max);
  };
  
  /**
   * State Transition.
   * Advances the parameter to the next discrete value.
   * Includes logic for initialization, incrementing, and boundary clamping.
   */
  next() {
    // 1. Initialization Case: First run
    if (isNull(this.evaluated)) {
      this.evaluated = this.min;

      // 2. Overflow Guard: Prevent stepping beyond max
    } else if (this.evaluated >= this.max) {
      throw new Error('ParameterEnumeration ' + this.name + ' index out of bounds error');
      // 3. Increment Logic
    } else {
      // Use a helper function (increaseAndRound) to handle Floating Point precision errors.
      // (e.g., ensures 0.1 + 0.2 equals 0.3, not 0.30000000004)
      this.evaluated = increaseAndRound(this.evaluated, this.interval, this.interval);
      // 4. Clamping: Ensure we don't overshoot the max due to uneven intervals
      if (this.evaluated > this.max) {
        this.evaluated = this.max
      }
    }
    return this.evaluated;
  };
  
  /**
   * Current Value Accessor.
   * Returns the current state. Initializes to 'min' if called before iteration started.
   */
  current() {
    if (isNull(this.evaluated)) {
      return this.next();
    }
    return this.evaluated;
  };
  
  /**
   * Rewind Mechanism.
   * Resets the iterator back to the start (Min).
   * Crucial for the "Odometer" logic in the parent class (when a higher-order param changes).
   */
  reset() {
    this.evaluated = null;
    this.next();// Immediately set to min
  };
  
  // Serialization for debugging/logging
  toRow(){
    return [this.name, this.val_base, this.min, this.max, this.interval, this.evaluated];
  };
  
  /**
   * Combinatorics Helper.
   * Calculates the total number of steps in this range.
   * Formula: Ceiling((Max - Min) / Interval) + 1
   */
  numValues() {
    return Math.ceil((this.max - this.min)/this.interval + 1);
  };
  
  /**
   * Progress Helper.
   * Returns the current step index (0-based).
   * Used to calculate the global progress percentage of the simulation.
   */
  lastIndex() {
    return Math.ceil((this.evaluated - this.min)/this.interval);
  };
};

/**
 * Simulation Batch Executor.
 * The main driver function that iterates through the generated scenarios and triggers the simulation pipeline.
 * * Engineering Highlight: "Time-Boxing"
 * Implements a safety mechanism to pause execution before hitting the server's hard timeout limit (Google Apps Script ~6 min limit).
 * This allows the simulation to run in "chunks" and resume later (Scalability).
 * * @param {RoadmapsEnumeration} roadmapsEnumState - The iterator holding the state of generated permutations.
 * @param {Object} in_data - Global input data (weather, demand profiles).
 * @param {Object} costsDb - Financial database.
 * @returns {Array<Roadmap>} - A batch of simulated roadmaps completed in this run.
 */
function enumerateRoadmaps(roadmapsEnumState, in_data, costsDb) {
  var roadmaps = [];
  var start = new Date();// Start the execution timer
  
  // TERMINATION CONDITION:
  // Continue ONLY if:
  // 1. There are more scenarios to run (.hasNext)
  // 2. We are still within the safe time window (Time Boxing)
  while (roadmapsEnumState.hasNext() && new Date() - start <= 340000) {//while i havnt cleared all the scenarios
    // 1. Generation: Create the next specific scenario configuration
    roadmap = roadmapsEnumState.next()
    // 2. Physics Simulation: Run the hourly energy balance model (2020-2050)
    roadmap.simulate(in_data);
    // 3. Financial Analysis: Apply costs and calculate NPV based on simulation results
    roadmap.calculateCosts(costsDb, in_data.parameters);
    // 4. Aggregation: Add the completed result to the batch
    roadmaps.push(roadmap);
  }
  return roadmaps;
};

/**
 * Result Aggregator & Filter.
 * Processes the raw simulation output to construct the "Optimal Cost Curve" (Pareto Frontier).
 * * Functionality:
 * 1. Discretization: Groups scenarios into 5% buckets of Renewable Share (e.g., 80-85%, 85-90%).
 * 2. Cost Minimization: Within each bucket, identifies the single scenario with the lowest Total Cost.
 * 3. Secondary Optimization: Uses 'Externalities' as a tie-breaker for scenarios with identical costs.
 * * @param {Array<Roadmap>} roadmapsOutput - The unsorted list of all simulated scenarios.
 * @returns {Array<Roadmap>} - A refined list containing only the most efficient roadmap for each 5% interval.
 */
function summarizeRoadmapsOutput(roadmapsOutput) {
  // Hash Map to store the "Champion" of each category.
  // Key = Renewable Share (e.g., "85"), Value = Best Roadmap Object.
  var cheapestByRenewableShare = {}
  roadmapsOutput.forEach(function(roadmap) {
    // 1. Binning Logic (Histogram Grouping)
    // Formula: Floor(Share * 20) / 20 -> Rounds down to nearest 5%.
    // Example: 87.3% -> 85% bin.
    var renewableShareCategory = Math.trunc(roadmap.maxRenewableShare * 100 / 5) * 5;
    // 2. Selection Logic (King of the Hill)
    // Case A: First entry for this category -> Take it.
    if (!cheapestByRenewableShare.hasOwnProperty(renewableShareCategory)) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
      // Case B: Found a cheaper alternative -> Replace the current champion.
    } else if (roadmap.totalCost < cheapestByRenewableShare[renewableShareCategory].totalCost) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
      // Case C: Costs are identical -> Use Externalities (Pollution Cost) as tie-breaker.
    } else if (roadmap.totalCost == cheapestByRenewableShare[renewableShareCategory].totalCost 
               && roadmap.externalities < cheapestByRenewableShare[renewableShareCategory].externalities) {
      cheapestByRenewableShare[renewableShareCategory] = roadmap;
    }
  });
  // 3. Flattening
  // Convert the Hash Map back into an ordered Array for plotting.
  var roadmapsSummary = [];
  for (var k in cheapestByRenewableShare) {
    if (cheapestByRenewableShare.hasOwnProperty(k)) {
      roadmapsSummary.push(cheapestByRenewableShare[k]);
    }
  }
  // Reverse to order from High Renewables to Low (or vice versa depending on chart needs)
  return roadmapsSummary.reverse();
};
  
  
/**
 * Results Retrieval Module (Data Access Object).
 * Reads the stored simulation results from the persistence layer (Spreadsheet).
 * * Functionality:
 * Performs "Deserialization" - converts raw table rows back into structured JavaScript objects.
 * This allows the application to visualize or analyze previous runs without re-executing the heavy simulation.
 * * @returns {Array<Object>} - A list of result objects mapped by their header names.
 */
function readRoadmapsOutput() {
  // 1. Raw Data Fetch
  // Retrieves the data grid starting from row 1 (skipping headers if needed, depending on implementation).
  var rows = readTableFromSheet(SHEET_ROADMAP_OUTPUT, 1, ROADMAPS_OUTPUT_HEADERS);
  // 2. Data Transformation (Map Operation)
  // Iterates over every row to transform it from an Array [v1, v2, ...] to an Object {key1: v1, key2: v2}.
  return rows.map(function(r) {
    var roadmap = {}
    // 3. Dynamic Property Mapping
    // Uses the defined constants (ROADMAPS_OUTPUT_HEADERS) to map columns to properties.
    // This makes the code robust: if column order changes in the constants, the mapping adapts automatically.
    ROADMAPS_OUTPUT_HEADERS.forEach(function(h, idx) {
      roadmap[h] = r[idx];
    });
    return roadmap;
  });
}


/**
 * Output Persistence Module.
 * Saves the simulation results to the spreadsheet.
 * * Engineering Highlight: "Append vs. Overwrite" Strategy
 * This function supports the Batch Processing architecture.
 * - If starting from scratch: It clears the sheet and writes headers.
 * - If resuming (startingIndex > 0): It appends data to the bottom without deleting previous results.
 * * @param {Array} roadmaps - The batch of calculated results to save.
 * @param {number} startingIndex - The cursor position. If null/0, implies a fresh run.
 */
function saveRoadmaps(roadmaps, startingIndex) {
  // Default State: "Fresh Start" Mode
  // Assume we are writing from the very beginning (Overwrite everything).
  var startingRow = null;
  var includeHeaders = true;
  var clearContents = true;
  if (!(isNull(startingIndex)) && startingIndex > 0) {
    // Offset Adjustment:
    // Spreadsheets are 1-based, Arrays are 0-based (+1), and row 1 holds the headers (+1).
    startingRow = startingIndex + 2;
    // Optimization:
    // Do not write headers again (they already exist from the first batch).
    includeHeaders = false;
    // Safety:
    // Do NOT clear the sheet, otherwise we lose the previous batches.
    clearContents = false;
  }
  // I/O Operation
  // Delegates the actual API call to a utility function using the configured flags.
  writeToSheet(SHEET_ROADMAP_OUTPUT, ROADMAPS_OUTPUT_HEADERS, roadmaps, startingRow, includeHeaders, clearContents);
}

/**
 * State Persistence Module (Checkpointing).
 * Saves the current progress of the simulation iterator back to the input sheet.
 * * Engineering Purpose: "Checkpointing"
 * Updates the 'evaluated' column in the configuration table.
 * If the simulation crashes or times out, this ensures the next run will skip 
 * the scenarios that were already calculated (Resume capability).
 * * @param {RoadmapsEnumeration} roadmapsEnumState - The iterator object containing current cursor positions.
 */
function saveRoadmapsCalcProgress(roadmapsEnumState) {
  // Serializes the complex iterator state into simple table rows and updates the DB.
  writeToSheet(SHEET_ROADMAP_INPUT, ROADMAPS_INPUT_HEADERS, roadmapsEnumState.toRows(),1,true,false);
}

/**
 * Executive Summary Publisher.
 * Writes the filtered, optimal results (Pareto Frontier) to a dedicated summary sheet.
 * * Engineering Purpose: "Decision Support"
 * Separates the "Raw Data" (thousands of rows) from the "Insights" (best scenario per category).
 * This sheet is likely the data source for the final charts presented to the user.
 * * @param {Array} roadmapsSummary - The list of optimal scenarios (Cheapest per Renewable Share).
 */
function saveRoadmapsSummary(roadmapsSummary) {
  writeToSheet(SHEET_ROADMAP_SUMMARY, ROADMAPS_OUTPUT_HEADERS, roadmapsSummary);
}

```

### src/main.js: enumerateAndCompareRoadmaps, summarizeRoadmaps, saveRoadmap
```js
/**Optimization
 * Sensitivity Analysis Engine: Generates and evaluates roadmaps based on parameter ranges (Min/Max/Interval).
 * Supports 'resumable execution' to handle long runs exceeding Google's 6-minute limit.
 */
function enumerateAndCompareRoadmaps() {
  var in_data = getInputData();

  // Fetch configuration object defining the search space (e.g., Solar: 60k-130k, steps of 10k)
  var roadmapsEnumState = getRoadmapsEnumInput();

  // Resume Logic: when resuming a saved sweep, startingIndex is the 0-based index of the first
  // combination that is NOT yet in the output sheet. A fresh sweep starts from 0.
  var startingIndex = roadmapsEnumState.started ? roadmapsEnumState.lastIndex() + 1 : 0;
  var costsDb = getCostsDb();

  // Generate the specific batch of roadmaps for this iteration
  var roadmaps = enumerateRoadmaps(roadmapsEnumState, in_data, costsDb);
  saveRoadmaps(roadmaps, startingIndex);

  // Checkpoint: Save the progress index so the next run knows where to start
  saveRoadmapsCalcProgress(roadmapsEnumState);
  SpreadsheetApp.flush();
};

/**
 * Post-Processing: Aggregates raw roadmap data into high-level KPIs.
 * Transforms detailed simulation outputs into a summary table for easier comparison.
 */
function summarizeRoadmaps() {
  var roadmaps = readRoadmapsOutput();

  var roadmapsSummary = summarizeRoadmapsOutput(roadmaps);

  saveRoadmapsSummary(roadmapsSummary);
};

function saveRoadmap(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var saveSheet = getOrCreateSheet(SHEET_SAVED_ROADMAPS);
  saveRoadmapToSheet(ss,saveSheet)

}

```

### src/history-save.js: saveRoadmapToSheet, getUniqueModelsFromColumn, SHEET_SAVED_ROADMAPS
```js
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

const SHEET_SAVED_ROADMAPS = '32_saved-roadmaps';

```

### src/data-meta.js: HOURLY_EXPORTED_COLUMNS
```js
const HOURLY_EXPORTED_COLUMNS = [2, 3, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18];

```


## 2026-10-11 — _README tab writer (replaced by the run guide in 00_documentation)

### src/design-scheme.js: _writeReadme
```js
/** The _README tab: how to run, first-run checklist, color legend. Rewritten on every apply (do not edit it by hand). */
function _writeReadme(ss) {
  var sheet = getOrCreateSheet('_README');
  sheet.clear();
  var rows = [
    ['NZO Model – קרא אותי', ''],
    ['', ''],
    ['ארבעה שלבים להרצה', ''],
    ['1. קלט', 'ערוך רק לשוניות כחולות: 01_parameters ו-30_roadmaps-keyframes'],
    ['2. הרצה', 'תפריט NZO Model: Predict Year לשנה אחת, או Calculate Scenarios and Costs לכל ה-roadmaps'],
    ['3. תוצאות', 'לשוניות ירוקות (10, 11, 12, 15, 31) נכתבות מחדש בכל הרצה. ההיסטוריה נשמרת ב-90_run-history (כתום)'],
    ['4. בדיקה', 'Advanced → Check data status: גרסת קוד וגרסת נתונים צריכות להיות תואמות למאסטר'],
    ['', ''],
    ['בדיקה להרצה ראשונה', ''],
    ['א.', 'בחר תרחיש ב-01_parameters!C2 ושנה ב-C8'],
    ['ב.', 'הרץ Calculate Costs ואז Predict Year'],
    ['ג.', 'ודא ש-Advanced → Run reference test מחזיר PASS'],
    ['', ''],
    ['מקרא צבעי הלשוניות', 'ראה גם 00_documentation, תא A1']
  ];
  Object.keys(DESIGN_ROLES).forEach(function(k) { rows.push([DESIGN_ROLES[k].label, DESIGN_ROLES[k].note]); });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  [3, 9, 14].forEach(function(r) { sheet.getRange(r, 1).setFontWeight('bold'); });
  var firstRoleRow = 15;
  Object.keys(DESIGN_ROLES).forEach(function(k, i) {
    sheet.getRange(firstRoleRow + i, 1).setBackground(DESIGN_ROLES[k].color).setFontColor('#ffffff').setFontWeight('bold');
  });
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 640);
}


```

## 2026-10-11 — one-off cell color tools (design-scheme.js, main.js)
Removed after the cell colors were reset; menu items "Audit cell colors" and "Reset cell colors" removed from Advanced.

```js
const DESIGN_AUDIT_SHEET = '_color-audit';

/**
 * Read-only audit of cell colors: for every tab, groups the used range by (background, font color) and writes
 * one row per group to a temporary tab '_color-audit' (overwritten on each run; delete it when done).
 * Columns: tab, tab role, background, font color, cells, first cell, last cell (or the full list of cells when a group has up to 40), bold cells, cells with a value.
 */
function auditCellColors() {
  var ss = SpreadsheetApp.getActive();
  var out = [['tab', 'role', 'background', 'font color', 'cells', 'first cell', 'last cell / cell list', 'with value', 'bold']];
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name === DESIGN_AUDIT_SHEET) return;
    var rows = sheet.getLastRow(), cols = sheet.getLastColumn();
    if (rows < 1 || cols < 1) return;
    var range = sheet.getRange(1, 1, rows, cols);
    var bgs = range.getBackgrounds(), fonts = range.getFontColors(), vals = range.getValues(), weights = range.getFontWeights();
    var groups = {}, order = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var key = bgs[r][c] + '|' + fonts[r][c];
        var g = groups[key];
        if (!g) { g = groups[key] = {bg: bgs[r][c], font: fonts[r][c], n: 0, first: null, last: null, val: 0, bold: 0, list: []}; order.push(key); }
        var a1 = _colLetter(c + 1) + (r + 1);
        g.n++;
        if (!g.first) g.first = a1;
        g.last = a1;
        if (g.list.length < 40) g.list.push(a1);
        if (vals[r][c] !== '') g.val++;
        if (weights[r][c] === 'bold') g.bold++;
      }
    }
    order.forEach(function(key) {
      var g = groups[key];
      out.push([name, DESIGN_SCHEME[name] || '', g.bg, g.font, g.n, g.first, g.n <= 40 ? g.list.join(' ') : g.last, g.val, g.bold]);
    });
  });
  var report = ss.getSheetByName(DESIGN_AUDIT_SHEET) || ss.insertSheet(DESIGN_AUDIT_SHEET);
  report.clear();
  report.getRange(1, 1, out.length, out[0].length).setValues(out);
  report.getRange(1, 1, 1, out[0].length).setFontWeight('bold');
  console.log('auditCellColors: ' + (out.length - 1) + ' color groups written to ' + DESIGN_AUDIT_SHEET);
  return out;
}

function _colLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Tabs whose cell colors are managed elsewhere: the documentation tab (legend and tab list are written by
// applyDesignScheme), _status (status cell is colored by checkDataStatus) and the audit report.
const DESIGN_RESET_SKIP = ['00_documentation', '_status', DESIGN_AUDIT_SHEET];

/**
 * Clears all manual cell colors (background -> none, font color -> default) in every tab except DESIGN_RESET_SKIP.
 * Values, bold, borders, conditional formats and protections are untouched. Afterwards run Apply design scheme,
 * which re-applies the calculated-cell look in 20_parameters.
 */
function resetCellColors() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets().filter(function(s) { return DESIGN_RESET_SKIP.indexOf(s.getName()) < 0; });
  var answer = ui.alert('Reset cell colors',
    'All manual cell background and font colors will be cleared in ' + sheets.length + ' tabs (not 00_documentation, _status). Continue?',
    ui.ButtonSet.OK_CANCEL);
  if (answer !== ui.Button.OK) return;
  sheets.forEach(function(sheet) {
    var range = sheet.getDataRange();
    range.setBackground(null).setFontColor(null);
  });
  SpreadsheetApp.flush();
  console.log('resetCellColors: cleared ' + sheets.length + ' tabs');
}
```
