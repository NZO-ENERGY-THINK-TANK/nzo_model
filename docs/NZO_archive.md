# NZO MODEL – ארכיון (לא בפרויקט)

## 2. באגים שנמצאו

### משפיעים על תוצאות
| # | בעיה | מיקום | סטטוס |
|---|---|---|---|
| 1 | עומק פריקה 101.25% ב-2050, ולכן הסוללה יורדת מתחת לאפס | `05_costs` N30 → `01_parameters` C26; parameters.gs | 🟢 תוקן |
| 2 | ~~`h.storageState += …`~~: התברר שזו **לא** בעיה בתוצאות. ההחלפה בין גז לסולארי היא שינוי תוויות בלבד ולא אמורה לשנות את מצב הסוללה. השורה כתבה לשדה מת, ולכן הוסרה כניקיון | yearly_model.gs | 🟢 נוקה |
| 3 | ניתוח סטוכסטי: `'var-Opex'` לא תואם אף פעם (השמות באותיות קטנות); `interest` לא מופעל (הפרמטר הוא `interestRate`); מהפליטות משתנה רק co2 | stochastic analysis.gs | 🟢 תוקן |
| 3א | ניתוח סטוכסטי: `solarKwToKwhYearly` ו-`windKwToKwhYearly` לא בשימוש בשום חישוב | stochastic / parameters | 🟢 הוחלט: לא לחבר; הוסרו מהפלט הסטוכסטי |
| 4 | ניתוח סטוכסטי: אין הגבלת זמן. מעל 6 דקות כל התוצאות אובדות. שם מודל שגוי מפיל את הריצה | main.gs, stochastic analysis.gs, scenarios.gs | 🟢 תוקן |
| 5 | Sensitivity Analysis שואל על שם המודל פעמיים | main.gs | 🟢 תוקן |
| 6 | המשך של Enumerate Roadmaps: ההמשך חישב מחדש את הצירוף האחרון (בזבוז זמן), וכשהמנה נחתכה כשהפרמטר האחרון במקסימום, ההמשך חזר אחורה, יצר שורות כפולות ולפעמים נתקע בלולאה. בנוסף, כשכל ערכי המינימום הם 0, ריצה חדשה לא נוקתה ולא קיבלה כותרות | roadmaps.gs, main.gs | 🟢 תוקן |
| 7 | `90_Run History`: סינון של תאים ריקים מזיז עמודות; אין שורת כותרות | history-save.gs | ✅ |

### ניקיון ותחזוקה
- `getSheet` קוראת ל-`Logger.severe` (לא קיים) ומציגה שם גליון שגוי בהודעה.
- משתנים גלובליים בלי `var`/`let` (`params`, `futureForecast`, `costs`, `summary`, `days`…).
- קוד מת: `ProductEnumeration.next/simulate`, `CostsCalculator`, `YearlyCosts`, בלוקים בהערה.
- ב-stochastic, השמות LB/UB הפוכים בפועל (הקוד הופך את הסימן של UB). LB = העלייה המקסימלית, UB = הירידה המקסימלית.
- פורמט תאים ב-`12_summary` לא מתאים לערכים (למשל 1700 מוצג כ-170000%).
- הערות שלא תואמות לקוד (V2G "10%" כשבפועל 0.2; "10 שניות" בניתוח הסטוכסטי).

---

## 3. יומן שינויים

> הערה: רשומות מלפני 2 באוקטובר 2026 (אחה"צ) משתמשות בשמות הישנים (`choosScenario`, `allScenarios`, `3_scenarios-input` וכד'). המיפוי לשמות החדשים נמצא בסעיף "איחוד מינוח" למטה.

### 4 באוקטובר 2026 – ניקיון ראשוני: הסרת קוד מת (הניתוחים sensitivity ו-stochastic)

**בוצע (באישור David, נשמר ב-Drive ואומת אחרי טעינה מחדש):**
- קובץ 1: נמחקו `sensitivityAnalysis` (שורות 84–131) ו-`stochasticAnalysis` (181–241). 249 → 139 שורות.
- קובץ 2: נמחקו `getCostsDbAlternative` ו-`changeCostsBySensitivity` (178–213). 230 → 193 שורות.
- קובץ 3: נמחקו `getInputDataAlternative` ו-`alternateFutureForecast` (22–80). 163 → 102 שורות.
- קובץ 11: נמחקו `kpiFromYearStates`, `getstochasticLimits`, `getSimulationRuntimeMs` (95–176). 186 → 103 שורות.
- הקוד שנמחק, עם מיקום מקורי, נשמר ב-`NZO_removed_code.md`.
- בדיקת תחביר על כל 12 הקבצים עברה לפני השמירה.
- שורות התפריט המוערות בקובץ 1 (שורות 24–25) לא שונו.
- לא נמחקו משתנים או שורות שמשפיעים על מבנה הגליון. לא שונתה אף לשונית.

**מועמדים לסבב הבא (נהיו ללא קורא אחרי המחיקה, לא נמחקו):**
`chooseRoadmap` (קובץ 7); `change`, `ProductEnumeration` ו-`SHEET_STOCHASTIC_INPUT`, `SHEET_STOCHASTIC_OUTPUT`, `Stochastic_INPUT_HEADERS`, `Stochastic_OUTPUT_HEADERS` (קובץ 11); `STOCHASTIC_SAFE_LIMIT_MS`, `dateReviver` (קובץ 1); `SHEET_SENSITIVITY`, `CHANGES_HEADERS` (קובץ 2).

**להשלמה:** אימות הרצה על תרחיש בדיקה (לפני/אחרי), עדכון `NZO_core.md` (הניתוחים הסטוכסטי וה-sensitivity הוסרו מהקוד; שאלה 7 נסגרה).

> **שמות הקבצים (לפי `CLAUDE.md`):** קובץ 1 = `main.gs`, קובץ 2 = `costs.gs`, קובץ 3 = `data-input.gs`, קובץ 11 = `stochastic analysis.gs`.
> **השפעה על התיעוד:** הניתוחים sensitivity ו-stochastic הוסרו מהקוד. הלשוניות `06_sensitivity-analysis`, `40_stochastic-analysis-input`, `41_stochastic-analysis-output` נשארו בגליון, אבל אין קוד שקורא להן. שאלה 7 במסמך העיצוב (האם הניתוחים חוזרים) נענתה בפועל: הוסרו, והקוד המלא שמור ב-`NZO_removed_code.md`.

### 10 באוקטובר 2026 – שלב 3: גיט ו-clasp (הושלם)
- נוצר שלד הריפו `nzo_model` (`src/`, `data/`, `reference/`, `charts/`, `docs/`) והועלה ל-`git@github.com:NZO-ENERGY-THINK-TANK/nzo_model.git` (ענף `main`, בלי הרשאות והגנות).
- `clasp clone` לתוך `src/`: 11 קבצים (מופיעים מקומית כ-`.js`), 3,102 שורות, כמו בעורך.
- commit ראשון באנגלית (`Initial commit: repository skeleton, Apps Script code and docs`). **מוסכמה: הודעות commit באנגלית.**
- `clasp push` הורץ, והסקריפט הורץ בגליון בהצלחה (David).
- תבניות Issue/PR הועברו ל-`.github/` (commit: `Add issue and pull request templates`).
- הפתוחים נפתחו כ-5 Issues ב-GitHub (באנגלית): `312!B77:B79`, `310!A111` (#REF!), פורמט `12_summary`, לשוניות `06_/40_/41_` שלא בשימוש, ושאלות המידול.
- **שלב 3 הושלם.**

### 10 באוקטובר 2026 – ניקיון ראשוני, סבבים 2–3 (הושלם)
- **סבב 2 (נמחק באישור, נשמר ב-Drive ואומת אחרי טעינה מחדש):** `chooseRoadmap` (קובץ 7, 625–670), `change` (קובץ 11, 33–93), `ProductEnumeration` (קובץ 11, 96–102), `dateReviver` ו-`STOCHASTIC_SAFE_LIMIT_MS` (קובץ 1, 128–138).
- **סבב 3:** `SHEET_SENSITIVITY` ו-`CHANGES_HEADERS` (קובץ 2: costs.gs, 180 שורות במקום 193), והקובץ `stochastic analysis.gs` נמחק כולו (קובץ 11, 33 שורות: שני קבועי `SHEET_STOCHASTIC_*`, שתי כותרות Stochastic, `STOCHASTIC_PARAM_ALIASES`, `STOCHASTIC_COST_TYPES`).
- **מצב סופי:** 11 קבצים, 3,102 שורות (במקום 12 קבצים וכ-3,900). סריקה אחרי הטעינה מחדש: אין פונקציות או קבועים ללא קורא, חוץ מ-`onOpen` ו-`onEdit` (טריגרים). `getUniqueModelsFromColumn` נשארת בשימוש (history-save.gs).
- כל הקוד שנמחק ב-`NZO_removed_code.md`. לא שונו לשוניות, ולא נמחקו משתנים שמשפיעים על שורות או עמודות.
- **בדיקת עשן (10 באוקטובר 2026, מהתפריט, על ידי David):** Predict Year ו-Calculate Scenarios and Costs הורצו ללא שגיאות. לא הורצו: save Roadmap, Enumerate/Summarize Roadmaps, Calculate Costs.

### 2 באוקטובר 2026 – איחוד מינוח (Roadmap / YearState / keyframes)
- **קוד (שלבים 1–2):** `choosScenario→chooseRoadmap`, `readRoadmapsFromScenariosInput→readRoadmapsFromKeyframes`, `roadmapsFromScenarios→groupYearsIntoRoadmaps`, `scenariosByRoadmap→yearsByRoadmap`, `saveScenarioToSheet→saveRoadmapToSheet`, `saveScenario→saveRoadmap` (גם תווית התפריט), `allScenarios→allYearStates`, `SCENARIO_INPUT_HEADERS→KEYFRAME_HEADERS`, `class Scenario→YearState`, `Roadmap.scenarios→Roadmap.years`, `ScenarioParams→YearStateParams`, `DEFAULT_SCENARIO_PARAMS→DEFAULT_YEAR_STATE_PARAMS`, `parametersFromScenario→parametersFromYearState`, `generateScenarios→generateYearStates`, `saveScenariosOutput→saveYearStatesOutput`, `SCENARIO_HEADERS→YEAR_STATE_HEADERS`, `changeCostByScenario→changeCostsBySensitivity`, `kpiFromscenario→kpiFromYearStates`, ועוד משתנים מקומיים. מחרוזות שמות לשוניות הוחלפו בקבועי `SHEET_*`.
- **גליון (שלב 3):** שונו שמות 28 לשוניות (לפי `NZO_sheet_rename_plan.md`) ו-21 תוויות קישור ב-`00_documentation`. 18 קבועי `SHEET_*` עודכנו. עיקריים: `3_scenarios-input→30_roadmaps-keyframes`, `2_roadmaps-input→20_roadmaps-input`, `31_scenarios-output→31_roadmaps-yearly-output`, `32_saved scenario→32_saved-roadmaps`, `90_Run History→90_run-history`, `06_sesitivity_analysis→06_sensitivity-analysis`, `4_stochastic_analysis-Input→40_stochastic-analysis-input`, `41_stochastic_analysis-Output→41_stochastic-analysis-output`, `10_hourly→10_hourly-predicted`, `11_daily→11_daily-predicted`.
- **אימות:** 0 שגיאות תחביר, מספר הנוסחאות ללא שינוי (92,472), 0 #REF! בגרפים, מקורות פיבוט עודכנו.
- **#REF! קיימים מראש (אומתו בגרסה הישנה):** `312!B80` תוקן ל-`='02_demand'!H47` (152.9); `310!A111` נשאר פתוח; `312!B77:B79` מצביעים על שנים שונות מהתוויות.
- **לא בוצע:** איחוד שמות עמודות. לא הורצו פעולות תפריט אחרי השינוי (מומלץ בדיקת עשן: Calculate Scenarios and Costs ואז save Roadmap).
- **שמות עמודות – שדות שעה (בוצע):** `nuclearGen→nuclearGeneration`, `windGen→windGeneration`, `wasteToEnergyGen→wasteToEnergyGeneration`, `hydrogenImport→hydrogenImported`, `solarTov2g→solarToV2g` (45 החלפות ב-yearly_model.gs ו-data-input.gs). נבדקה אי-התנגשות (שמות היעד קיימים רק באובייקטי summary/YearState, לא ב-hour/day). 0 שגיאות תחביר, נשמר ואומת אחרי טעינה. כותרות `10_hourly-predicted` ישתנו בהרצת Predict Year הבאה. לא שונה: `Cummulative` (46 מופעים; נבדק ונדחה: פיבוט על `31_roadmaps-yearly-output` מכיל שדה Cummulative (1), פיבוט נוסף על `roadmaps-data` מכיל 15 שדות כאלה, וגרף 25 ולשונית 32 מפנים לטקסט. שינוי יישבר אותם; ה-typo לא משפיע על חישוב), כותרות קלט (Product/Parameter/Base Price/val_base), `maxFossilCapacity`.
- **בדיקת עשן (2 באוקטובר 2026, מהתפריט):** Predict Year עבר: כותרות `10_hourly-predicted` בשמות החדשים, נוספה שורה ל-`90_run-history`. Calculate Scenarios and Costs עבר: `31_roadmaps-yearly-output` מכיל 6 roadmaps × 25 שנים (150 שורות), 0 שגיאות. נבדק סטטית ש-8 ה-`functionName` בתפריט קיימים כפונקציות. **לא הורץ:** save Roadmap (כותב ל-`32_saved-roadmaps`), Enumerate/Summarize Roadmaps, Calculate Costs.
- **ארגון קבצים (2 באוקטובר 2026):** `scenarios.gs` שונה ל-`year-state.gs`. אליו הועברו `DEFAULT_YEAR_STATE_PARAMS`, `class YearStateParams` (בראש הקובץ, לפני `YEAR_STATE_HEADERS`) ו-`generateYearStates` (בסוף). קובץ חדש `roadmaps-enumeration.gs` (411 שורות) מכיל את הסריקה האוטומטית: `SHEET_ROADMAP_INPUT/OUTPUT/SUMMARY`, `ROADMAPS_OUTPUT_HEADERS`, `ROADMAPS_INPUT_HEADERS`, `getRoadmapsEnumInput`, `RoadmapsEnumeration`, `ParameterEnumeration`, `enumerateRoadmaps`, `summarizeRoadmapsOutput`, `readRoadmapsOutput`, `saveRoadmaps*`. `roadmaps.gs` נשאר עם `class Roadmap` ו-`groupYearsIntoRoadmaps` (184 שורות). טקסט הקוד לא שונה, רק מיקומו. אומת: 0 שגיאות תחביר, אין הגדרות כפולות, אותם שמות לא מוגדרים כמו קודם. בדיקת עשן: calculateScenariosAndCosts ו-enumerateAndCompareRoadmaps עברו (`21_roadmaps-output` 108 צירופים ללא שינוי, 0 שגיאות).
- **גיבוי:** `NZO_code_backup_2026-10-02.txt` (קוד לפני השינוי).


### 2 באוקטובר 2026
- **`05_costs` תא N30** (Storage / Depth of Discharge, שינוי ב-2050): **13% → 5.5%**. כתוצאה מכך, הערך ל-2050 ב-U30 יורד מ-101.25% ל-94.95%.
  - יש להריץ **Calculate Costs** כדי שהשינוי יגיע ל-`15_costs-output` ומשם ל-`01_parameters` C26.
- **parameters.gs, הפונקציה `internalParameters`:** נוספה שמירה שמגבילה את עומק הפריקה לטווח 0–1 (`var dod = Math.min(1, Math.max(0, …))`), עם `console.warn` כשהערך חורג. `effectiveStorageEnergy` ו-`minStorageEnergy` מחושבים עכשיו לפי `dod`. השינוי נשמר ואומת אחרי טעינה מחדש של העורך.
- הורץ Calculate Costs. `01_parameters` C26 מציג עכשיו 95%. ✅
- **yearly_model.gs (באג 2):** בבלוק "Swap gas for solar" הוסרה השורה `h.storageState+=shiftSolarUsageToStorage`, ונוספה הערה שמסבירה שההחלפה היא שינוי תוויות בלבד. אין השפעה על המספרים.
- **stochastic analysis.gs (באג 3):** הפונקציה `change()` נכתבה מחדש:
  - `'var-Opex'` הוחלף ב-`'var-opex'`, כך ש-var-opex משתנה עכשיו (למשל ccgt).
  - נוספו `nox`, `sox` ו-`pmx`, כך שכל עלויות הפליטה משתנות, לא רק co2.
  - נוסף `STOCHASTIC_PARAM_ALIASES`: `interest` → `interestRate`. ריבית ההיוון ל-NPV משתנה עכשיו בפועל.
  - מבנה if/else ברור עם 3 מקרים: ביקוש, פרמטר, עלות. `lifetime` לא משתנה.
  - שם לא מוכר יוצר `console.warn`, במקום שהשינוי יידלג בשקט.
  - נבדק בבדיקת לוגיקה על נתוני דמה, ונשמר ואומת אחרי טעינה מחדש.
  - ⚠️ **ריצות סטוכסטיות מעכשיו לא ניתנות להשוואה לריצות קודמות.** עכשיו גם var-opex של ccgt משתנה ב-±80%.
- **ניקוי משתנים שלא בשימוש** (בלי שינוי בלוגיקה; כל הקבצים עברו בדיקת תחביר, ונשמרו ואומתו):
  - data-input.gs: הוסר `HOURS_IN_YEAR`.
  - yearly_model.gs: הוסרו `HOURLY_PREDICTED_HEADERS_DEBUG` ו-`leftToGenerateFromGas`.
  - roadmaps.gs: הוסרו `const self = this` (פעמיים) ו-`var debug = this`.
  - scenarios.gs: הוסרו `const self = this` והטבלה `hydrogenUsageCapacityReplacements` (נכתבה ולא נקראה), יחד עם `hydrogenUsageLifeTime`.
  - main.gs: הוסר `Logger.log(…solarKwToKwhYearly)`. הכתיבה לפלט הסטוכסטי משתמשת עכשיו בקבוע `SHEET_stochastic_OUTPUT` במקום בשם הלשונית כמחרוזת.
  - stochastic analysis.gs: הוסרו `solarKwToKwhYearly` ו-`windKwToKwhYearly` מכותרות הפלט, וגם `const self` בתוך `ProductEnumeration.next`.
  - **נשאר בכוונה:** `solarKwToKwhYearly` ו-`windKwToKwhYearly` נשארים במיפוי של `01_parameters`, כי הם מוצגים ב-`12_summary` וב-Run History. אם יימחקו, השורות והעמודות שם יזוזו.
  - **בגליון:** שתי השורות האלה עדיין קיימות ב-`4_stochastic_analysis-Input`. אין להן השפעה, ואפשר למחוק אותן.
- **מחיקת קוד מת** (3,865 → 3,536 שורות; בדיקת תחביר עברה; נשמר ואומת). גיבוי של הקוד הפעיל שנמחק נמצא בקובץ `NZO_removed_code.md`:
  - `calculateCostChangeScenario` (לא היה בתפריט), `CostsCalculator` ו-`YearlyCosts` (מודול עתידי שלא הושלם), `setLastProcessed` (בשתי מחלקות), ומתודות שבורות שהועתקו לתוך `ProductEnumeration`.
  - כל הקוד שבהערות: `capacityExpansionPlanning`, `INITIAL_2020_SCENARIO_PARAMS`, בלוק `hydrogenUsageCapex`, שורות `Logger` ושורות debug.
  - שורה כפולה (`predictedDaily = []`) ונקודה-פסיק מיותרת.
  - לא נגעתי במשתנים שמחיקה שלהם הייתה מזיזה שורות או עמודות בפלט.
- **באג 4 (ניתוח סטוכסטי):**
  - main.gs: נוסף `STOCHASTIC_SAFE_LIMIT_MS = 5 דקות`, שנמדד מתחילת הריצה (כולל זמן המענה על השאלות). איטרציה חדשה לא מתחילה אם צפוי שהיא תחצה את הגבול, לפי משך האיטרציה הקודמת.
  - הכתיבה לגליון עטופה ב-`try/finally`, כך שהתוצאות נשמרות גם אם איטרציה נכשלת.
  - בסוף מופיעה הודעה קצרה (toast) עם מספר הריצות שנשמרו, ואם הריצה נעצרה בגלל המגבלה.
  - הוסר `allScenarios`, שצבר את כל התוצאות בזיכרון ולא היה בשימוש. הוסר גם `keepgoing`, שלא היה בשימוש.
  - stochastic analysis.gs: אם מבקשים יותר מ-5 דקות, מופיעה אזהרה.
  - scenarios.gs, `choosScenario`: שם מודל שגוי מציג עכשיו הודעה עם רשימת המודלים ועוצר, במקום לקרוס בהמשך. זה חל גם על Sensitivity Analysis.
  - נבדק עם שעון מדומה: בקשה של 60 שניות → 2 ריצות; בקשה של 1000 שניות → נעצר אחרי 300 שניות ו-7 ריצות נשמרו; כשל באיטרציה השלישית → 2 ריצות נשמרו.
- **באג 6 (Enumerate Roadmaps):**
  - **תיקון לתיאור המקורי:** כתבתי שבכל המשך נוצרות שורות כפולות, וזה לא מדויק. כשהפרמטר האחרון לא במקסימום, החישוב החוזר דורס את אותה שורה, ולכן אין כפילות (רק בזבוז של צירוף אחד). הבעיה האמיתית מופיעה כשהמנה נחתכת בדיוק כשהפרמטר האחרון במקסימום: ההמשך חוזר לתחילת אותה "שורה" של צירופים, יוצר כפילויות, ובמקרים מסוימים נתקע בלולאה ולא מסיים.
  - **סיבה:** `RoadmapsEnumeration.started` התחיל תמיד כ-false, ולכן ה-`next()` הראשון בהמשך לא קידם את הצירוף. שתי טעויות קיזזו זו את זו בדרך כלל: `startingRow = startingIndex + 1` דרס את שורת הצירוף האחרון.
  - **roadmaps.gs, constructor של `RoadmapsEnumeration`:** `started` הוא עכשיו true כשלכל הפרמטרים כבר יש ערך ב-`evaluated` (המשך), ו-false בסריקה חדשה. ב-`next()` הראשון של המשך, הצירוף מקודם כמו שצריך.
  - **main.gs, `enumerateAndCompareRoadmaps`:** `startingIndex` הוא האינדקס של הצירוף הראשון שעדיין לא נשמר (המשך), או 0 (סריקה חדשה). כך סריקה חדשה מזוהה לפי המצב ולא לפי הערך של האינדקס.
  - **roadmaps.gs, `saveRoadmaps`:** `startingRow = startingIndex + 2` (שורת כותרות ועוד אינדקס מבוסס-1).
  - **בדיקה:** סימולציה של כל התהליך (מנות בגדלים 1–50, חמש תצורות, כולל תצורה דומה לגליון האמיתי) הראתה שהקוד הקודם נכשל בהרבה גדלי מנה, והקוד החדש נותן תמיד פלט זהה לריצה אחת רצופה. אחרי סריקה שהסתיימה, הרצה נוספת לא עושה כלום.
  - **הפלט הקיים בגליון תקין:** ב-`21_roadmaps-output` יש 108 שורות בלי כפילויות, שזה בדיוק מספר הצירופים (3×3×3×2×2).
  - **הערות לשימוש:** כדי להתחיל סריקה חדשה, מרוקנים את עמודת `evaluated` (עמודה F) ב-`2_roadmaps-input`. הקוד מניח ש-`min` הוא כפולה של `interval`; בגליון הנוכחי זה מתקיים.
- **באג 5 (main.gs, `sensitivityAnalysis`):** שם המודל נשאל פעם אחת בלבד. הפונקציה שומרת אותו ב-`modelName`, והריצה החלופית קוראת ל-`choosScenario(modelName)` במצב השקט הקיים, בלי חלון נוסף. כך הבסיס והחלופה מבוססים תמיד על אותו מודל. נשמר ואומת אחרי טעינה מחדש.

---

### באג 7 – `90_Run History`
- **הבעיה:** `filter(String)` נעשה בנפרד על שמות ועל ערכים, ולכן תא ריק הזיז את כל העמודות שאחריו. לא היתה שורת כותרות בלשונית (62 שורות, בלי כותרת). שורת התווית "Last Calculation Parameter Values" נפלה מהערכים אבל לא מהכותרות, ולכן 32 העמודות האחרונות היו זזות בעמודה.
- **התיקון:** פונקציה חדשה `getNameValuePairs` קוראת שם, יחידה וערך יחד. הכותרות והנתונים נבנים מאותם זוגות ולכן תמיד מיושרים. שורת תווית (בלי יחידה ובלי ערך) מדולגת. שורה עם יחידה וערך ריק נשמרת כתא ריק. נמחקו `getParameterNames` ו-`getValues`, שלא היו בשימוש במקום אחר.
- **כותרות:** `logRunToHistory` מחפשת את שורת ה-"Timestamp" האחרונה. אם אין כזו, או שהפריסה השתנתה, נכתבת שורת כותרות חדשה לפני השורה הבאה. היסטוריה קיימת לא זזה ולא נמחקת.
- **פריסה:** נשארת 99 עמודות, כמו בשורות 40–62.
- **12_summary:** הנתונים מתחילים בשורה 3 והקוד קורא משם. אין בעיה (gviz מדלג על שורה 1 הריקה).
- **לא נבדק על הגיליון:** לא הרצתי logRunToHistory בפועל כדי לא להוסיף שורה להיסטוריה. הבדיקה הראשונה תהיה בהרצה הבאה של Predict Year.

### ניקיון – `getSheet`
- `Logger.severe` לא קיים ב-Apps Script, והמשתנה `sheet` היה גלובלי, וההודעה הזכירה גיליון שגוי (`SHEET_REF_YEAR_HOURLY`).
- עכשיו: משתנה מקומי, ושגיאה ברורה `Sheet "<שם>" not found!` שעוצרת את הריצה. אף קורא לא בדק ערך מוחזר ריק, ולכן ההתנהגות בנתיב התקין לא השתנתה.

### ניקיון – משתנים גלובליים בלי הצהרה
- נוספו `var` ל: `predictions` (predictYear), `params`/`futureForecast`/`hoursGen` (getInputData, getInputDataAlternative), `futureForecast` (futureDemandForecast), `params` (parametersFromScenario), `yearlySummary` (calculateYear), `days` (_calculateDailyFixedGen), ומשתני הלולאות `k`, `v`, `parameterName` ב-savePredictions/saveSummary.
- נבדק שכל משתנה משמש רק בתוך הפונקציה שבה הוא מוגדר ושום קוד אחר לא נשען עליו כגלובלי. הלוגיקה לא השתנתה. `pmt` ו-`pvif` כבר היו מוצהרים.

### ניקיון – הערות ו-LB/UB
- הערת V2G תוקנה: זמינים 20% מאנרגיית ה-V2G (הקוד משתמש ב-0.2), לא 10%.
- אין הערת "10 שניות" שגויה בקוד. ברירת המחדל של הניתוח הסטוכסטי היא אכן 10 שניות.
- **LB/UB בניתוח הסטוכסטי:** העמודה "LB" בגיליון היא העלייה המרבית ו-"UB" הירידה המרבית: r אחיד בין `1 - UB` ל-`1 + LB` (למשל LB=UB=0.8 נותן 0.2–1.8). השמות מבלבלים, ולכן עודכנו רק הערות. השמות והלוגיקה לא שונו.
- נמחק סעיף 4 (שימוש לבדיקת השפעת V2G) לפי בקשה.

### ניקיון – פורמט `12_summary`
- שלושה תאים הוגדרו כאחוזים בטעות: C35 (solar average yearly production hours), C36 (solar capacity in reference year), C52 (predicted storage capacity limit). הוחלף ל-Number (1,000.12). הערכים לא השתנו, רק התצוגה: 1,700.00, 4,844.89, 70,000.00.
- מספור השורות: שורה 1 היא "output results", שורה 2 ריקה, ו-maxGasCapacity בשורה 3 (תואם ל-`saveSummary` ול-`logRunToHistory`).
- לא בוצע איחוד פורמט לכל העמודה (פיסוק אלפים לא אחיד). נשאר כאופציה.

## 2026-10-10 — שלב 4 (נתוני בסיס ב-git): yearly_demand.csv
**בוצע (באישור David):**
- נוצר `nzo_model/data/yearly_demand.csv`: עמודות `year, noga23_conservative_twh, noga23_bau_twh`; 28 שורות (2023–2050) + כותרת; מקור: `02_demand` עמודות L, M (שורות 20–47); ערכים בלבד, כ-10 ספרות משמעותיות. אומת: 2050 = 183.7075142 / 162.9970913.
- `data/README.md`: עודכנה הטבלה והוסף תיאור סכמה (הקובץ מחליף את `03_future-yearly-demand.csv` המתוכנן).
- `02_demand!L19` ו-`M19`: נוסחאות ה-IMPORTRANGE כטקסט רגיל (תיעוד בלבד; לא מחושב). נתוני L20:M47 לא השתנו.
- `03_future-yearly-demand` לא שונתה (עמודה B נשארה ערכים מודבקים).
**הערה:** בניסיון ראשון ההקלדה לא נקלטה בגליון ולא שונה אף תא (נבדק: אין טקסט שנחת ב-02/03).
**קומיט מוצע:** `Add yearly_demand.csv base data (Noga 2023 conservative/BAU demand)`

## 2026-10-10 — שלב 4: hourly_demand23.csv
- נוצר `nzo_model/data/hourly_demand23.csv` מלשונית `04_raw-data-hourly`: 8,760 שורות + כותרת, 14 עמודות (סכמה ב-`data/README.md`). הומרו מספרים עם פסיקים וגם אחוזים לשבר. הועבר ואומת בצ'קסאם (אורך 535,661 תווים) מול הנתונים שנשלפו.
- לא שונה דבר בגיליון. לא יוצאו עמודות A, E, I, J (ראו README).
- ההערה: תוויות היום בשעון קיץ מוזזות בשעה (אין מקבילה פשוטה לקלנדר UTC); נשמר כפי שבגיליון.
- קומיט מוצע: `Add hourly_demand23.csv base data (2023 hourly generation profile)`
- (2026-10-10) `data/README.md`: נוסף מקור לשני הקבצים (נוגה 2023; דו"ח מצב משק החשמל). קישור/תאריך הורדה/יחידות של הדו"ח: להשלמה.

## 2026-10-10 — שלב 4: costs.csv
- נוצר `nzo_model/data/costs.csv` מ-`05_costs` עמודות A–H, שורות 2–66 (כותרת + 64 שורות), ערכים בלבד בדיוק מלא. G13, G26, G35 הוחלפו בערכים (נוסחאות `=G7`, `=125*C75`, `=C78`).
- לא יוצאו I–U. שורות מחושבות (PV-Average 19–22, emissions combined 41) נשמרו כערכים. סכמה ב-`data/README.md`.
- לא שונה דבר בגיליון (הופעל תצוגת "הצג נוסחאות" בדפדפן בלבד, ללא שינוי בתוכן).
- קומיט מוצע: `Add costs.csv base data (05_costs columns A-H)`
- (2026-10-10) `costs.csv` שורות 15–18 (`share-of-deployment`): `base_price` = ערך 2025 (0.2, 0.2, 0.3, 0.3). בדיקת שימוש: `pv-average` capex/opex/lifetime (שורות 20–22) נקראים בקוד; שורה 41 (`emissions combined`) לא נקראת בקוד.
- (2026-10-10) הוסרו מ-`costs.csv` שורות `PV-Average` (4) ו-`emissions combined` (1): 59 שורות נתונים. **משימה פתוחה:** לכתוב פונקציה לחישוב `pv-average` (capex, opex, lifetime) במקום נוסחאות הגיליון. נרשם גם ב-`data/README.md`.
- (2026-10-10) שלב 4 הושלם לפי החלטת David: 3 קבצים ב-`data/` (yearly_demand, hourly_demand23, costs). `01_parameters` ו-`20_roadmaps-input` לא יוצאו. **לבדוק:** `03_future-yearly-demand` עמודות must-run (`mustRun = row[6]` ב-`data-input.js`) עדיין רק בגיליון ולא ב-git.
- (2026-10-10) הבהרת David: `01_parameters` הוא קלט ספציפי להרצה ולא הנחות בסיס, לכן אינו חלק מנתוני הבסיס ב-git. נרשם ב-`data/README.md`.

## 2026-10-10 — שלב 5 (תרחיש ייחוס), חלק 1: קוד
- נוסף `src/reference_test.js` (150 שורות) ו-`src/reference_test_expected.js` (placeholder: `REFERENCE_EXPECTED = null`). הפרויקט: 13 קבצים (11 + 2), 3,242 שורות. בדיקת תחביר על כל הקבצים עברה. עדיין לא הועלה ל-Apps Script.
- `runReferenceTest()`: מריצה Roadmap `Base` (keyframes מוטמעים בקוד, 2026–2050) בסימולציה ועלויות, בלי לכתוב ללשוניות, ומשווה ל-`REFERENCE_EXPECTED` (סבילות יחסית 1e-6). סטטוס: PASS / FAIL / INPUT CHANGED (פרמטרים מ-01_parameters שונים מהמוקלטים) / NO EXPECTED.
- `recordReferenceTest()`: מריצה ומציגה JSON להדבקה ב-`reference_test_expected.js`.
- נשאר: clasp push, הרצת record, הדבקת הערכים, הרצה ל-PASS, בדיקת כישלון מכוון, חיבור לתפריט, `reference/README.md`, נוהל PR.
- (2026-10-10) שונו שמות לפי בקשת David: `reference_test.js`, `reference_test_expected.js`, הפונקציות `runReferenceTest()` ו-`recordReferenceTest()`.
- (2026-10-10) הוקלטו ערכי הייחוס ב-`src/reference_test_expected.js` (Base 2026–2050: NPV = 607,632,321,064; נתח מתחדשות מרבי 45.4%; שיא הספק גז 2050 = 25,436 MW). נשאר: clasp push, הרצת `runReferenceTest` ל-PASS, בדיקת כישלון מכוון, חיבור לתפריט.
- (2026-10-10) `runReferenceTest()` הורצה בעורך: PASS (20 ערכים). תוקן: `_showReferenceMessage` זרקה חריגה כשאין UI (הרצה מהעורך); עכשיו עטופה ב-try/catch והתוצאה נשארת ביומן. דורש `clasp push`.
- (2026-10-10) אומת שהמבחן רגיש: שינוי סולארי 2026 מ-8000 ל-8100 (בקובץ מקומי + clasp push) נתן FAIL (NPV שונה ב-0.0044%, solarCost ב-0.105%). `PASS` קודם אחרי עריכה ישירות בעורך נבע ככל הנראה מגרסה לא מעודכנת בעורך. **נוהל: עורכים רק בקבצים המקומיים ו-clasp push, לא בעורך.** הוסרה פונקציית האבחון הזמנית. הערך הוחזר ל-8000 (דורש clasp push).
- (2026-10-10) שלב 5 הושלם בקוד: נוסף תת-תפריט `NZO Model ← Advanced` (Run / Record reference test) ב-`main.js` (`buildMenu` עבר מ-`addMenu` ל-`createMenu`, ו-`onEdit` עטוף ב-try/catch). נכתב `reference/README.md` (נוהל PR) ועודכן `NZO_core.md`. דורש `clasp push` ובדיקת תפריט בגיליון (רענון).
- קומיט מוצע: `Add reference test (regression) with Advanced menu and docs`

## 2026-10-10 — שלב 6 (מטא-דאטה בהרצות), 6א: גרסת קוד
- נוסף `src/version.js` עם `const CODE_VERSION = '1.0.0'` (14 קבצים). בדיקת תחביר עברה. ההחלטה: שורות היסטוריה ישנות ב-`90_run-history` אפשר להסיר (בגיבוי ובאישור לפני המחיקה). תוכנית שלב 6 אושרה: 6א גרסת קוד, 6ב `_meta`/`_status`/hash, 6ג עמודות ב-`90_run-history`, 6ד תיאור ב-`save Roadmap`.

## 2026-10-10 — שלב 6ב: `_meta`, `_status`, hash
- נוסף `src/data-meta.js` (135 שורות; 15 קבצים, 3,438 שורות): `computeDataHash()` (SHA-256 על הטווחים שיוצאו ל-git: `05_costs` A2:H66, `02_demand` L20:M47, `04_raw-data-hourly` עמודות B,C,D,F,G,H,K–R שורות 2–8761; נרמול: מספרים ל-10 ספרות משמעותיות, זמן H:MM:SS), `getDataMeta()`, `updateDataHash()` ו-`checkDataStatus()`. הלשוניות `_meta` ו-`_status` נוצרות בסוף הגיליון בהרצה הראשונה.
- `main.js`: נוספו לתת-תפריט Advanced "Update data hash" ו-"Check data status".
- בדיקת תחביר על כל הפרויקט עברה. לא הועלה לשרת.
- (נסגר 2026-10-10) `gas_share` ב-`hourly_demand23.csv`: יוצאה מחדש מהגיליון בערך מלא ונבדקה: כל 8,760 הערכים בגיליון הם בדיוק 2 ספרות אחרי הנקודה, וה-hash (SHA-256) של העמודה ב-CSV זהה לזה של הגיליון. לא נדרש שינוי בקובץ.

## 2026-10-10 — שלב 6ב אומת, 6ג: מטא-דאטה ב-`90_run-history`
- 6ב אומת בגיליון: `code_version 1.0.0`, `data_version data-1.0`, התאמת hash: true.
- נוסף `getRunMetadata()` ב-`data-meta.js` (`run_id`, `researcher`, `code_version`, `data_version`, `data_hash_match`; ה-hash מחושב חי בכל הרצה, `researcher` ריק אם אין הרשאה).
- `logRunToHistory` (`history-save.js`): חמש העמודות נוספו אחרי `Timestamp`, לפני הפרמטרים והתוצאות. הכותרת הקיימת מזוהה כשונה ונוספת כותרת חדשה בלי לפגוע בשורות הקודמות. בדיקת תחביר עברה. לא הועלה לשרת.
- נשאר: הסרת שורות ישנות מ-`90_run-history` (בגיבוי ובאישור לפני המחיקה), 6ד (תיאור ב-`save Roadmap`).

## 2026-10-10 — שלב 6ד: תיאור ומטא-דאטה ב-`save Roadmap`
- `saveRoadmapToSheet` (`history-save.js`): נוספה שאלת "description (optional)" אחרי שם השמירה, והעמודות `run_id`, `researcher`, `code_version`, `data_version`, `data_hash_match`, `description` נוספו אחרי `Saved at`. כותרת חדשה נוספת (בלי להחליף שורות קיימות) כשהכותרת האחרונה שונה מהמבנה החדש; בעבר נכתבה כותרת רק בגיליון ריק. בדיקת תחביר עברה. לא הועלה לשרת.
- אחרי אימות 6ג-6ד נותרו: הסרת שורות ישנות ב-`90_run-history` (בגיבוי ובאישור לפני המחיקה), עדכון `NZO_core.md`, ותג `data-1.0` ב-git.
- (2026-10-10) אומת 6ג: שורה חדשה ב-`90_run-history` עם `run_id`, `researcher`, `1.0.0`, `data-1.0`, `TRUE`. ב-`90_run-history` אין שורות ישנות (כותרת ושורה אחת בלבד), ולכן לא נדרשה הסרה. עודכן `NZO_core.md` (סעיף מצב נוכחי ופריטי תפריט).

## 2026-10-10 — `costs.csv`: נוספו עמודות I–N
- ב-`costs.csv` נוספו `pct_change_2025` עד `pct_change_2050` (עמודות I–N בגיליון): 59 שורות, 14 עמודות. נמצא שבלעדיהן אי אפשר לשחזר את `05_costs`. ערכים מלאים, כולל תאים שהיו נוסחאות (`=J3`). `data/README.md` עודכן.
- `data-meta.js`: טווח ה-hash של `05_costs` הורחב ל-A2:N66 (14 עמודות). **ה-hash ב-`_meta` ישן, ולכן צריך `clasp push` ו-"Update data hash" מחדש (אותה גרסה `data-1.0` אם עוד לא נוצר תג, אחרת `data-1.1`).** הערה: ה-hash כולל גם את שורות `PV-Average` ו-`emissions combined` המחושבות (לא ב-CSV), ולכן אינו ניתן לשחזור מה-CSV בלבד.

### 2026-10-10 — `_readRefYearHoursData` supports data layout (step 7 prep)
- `src/data-input.js`: reads 04_raw-data-hourly ONLY in data layout (14 columns as in `data/hourly_demand23.csv`, A1 == 'day'); throws a clear error otherwise. Legacy layout support removed at David's request. Output shape unchanged.
- Decision (David): 02_demand master tab is loaded entirely from `yearly_demand.csv`; 04 columns A,E,I,J not needed; 05_costs unused rows kept blank and marked "לא בשימוש" (import by product+parameter).
- Pending: references from 03 to 02_demand L20:M47 must be redirected when 02 is loaded from CSV (A1:C29); hash range for 02/04 to be updated then.
- Verification: syntax OK on all src files. Order: backup copy of sheet → import CSV into 04 (replace sheet) → clasp push → reference test PASS.
- data-meta.js: hash range of 04 = A2:N8761 (14 cols, no pick) after sheet is in data layout; Update data hash needed.

### 2026-10-10 — 04 in data layout; 01_parameters formulas migrated (step A) — reference test PASS (20 values)
- 01_parameters C4/C5/C7 now: `=SUM('04_raw-data-hourly'!H2:H8760)/C3`, `...L2:L8760)/C6`, `...F2:F8760)` (same row span as before: rows 2..8760).
- OPEN BUG: these ranges exclude the last hour (row 8761, hour 8760). Fix later as a separate change (range to row 8761) + re-record reference.
- Step B (done in code): removed 'max/min ramp rate gas' from parameters.js mapping and reference_test_expected.js (unused by model; backup in NZO_removed_code.md). Sheet: clear 01_parameters rows 27-28 (keep rows). Step C pending: 91_ramp-rates tab to be deleted after backup + approval.

### 2026-10-10 — 91_ramp-rates deleted; demand scenarios reduced to Noga conservative + Noga BAU
- `91_ramp-rates` deleted by David (formulas backed up in NZO_removed_code.md); reference test to be re-run.
- 03_future-yearly-demand: columns K–O (demand-3, demand-3.5, demand-pua, demand-nzo, demand-Rashut hashmal) cleared (columns kept, values backed up in NZO_removed_code.md). Dropdown at 01_parameters!C2 now lists only Noga conservative / Noga BAU (verified). Code reads 03 columns A–H only; no scenario names in code.
- Next: load 02_demand from yearly_demand.csv (A1:C29) then replace 03!P11:Q38 formulas with year lookups into 02; update hash range for 02 (A2:C29).
- data-meta.js: hash range of 02_demand = A2:C29 (after 02 loaded from CSV).

### 2026-10-10 — 02_demand loaded from CSV; data-1.2
- `02_demand` = `data/yearly_demand.csv` entirely (A1:C29). 03!P11:Q38 use year lookups into 02 (verified: 28 years, 0 mismatches vs 02).
- Update data hash → data_version `data-1.2`, hash f6c10b4a…9159; Check data status: true (code 1.0.0).
- Pending: Run reference test after push (expected PASS); tag `data-1.2`; commits. Open: last-hour exclusion bug in 01_parameters C4/C5/C7.
