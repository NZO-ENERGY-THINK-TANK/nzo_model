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
- **נשאר:** העברת תבניות Issue/PR מ-`docs/github-templates/` ל-`.github/`, והוספת הפתוחים כ-Issues.

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
