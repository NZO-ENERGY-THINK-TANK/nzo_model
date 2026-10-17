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

### 17 באוקטובר 2026 – הפרדת שני ה-use cases וקידוד לשוניות

**בוצע (באישור David, צעד אחר צעד; אומת ב-Run reference test = PASS אחרי כל שלב):**
- שלב 1: קבועי שנת הייחוס (`solarKwToKwhYearly`, `windKwToKwhYearly`, הספקי שנת הייחוס וסך הביקוש) מחושבים מ-`12_raw-data-hourly` (`referenceYearParameters` ב-`data-input.js`). שעות אפקטיביות: סולארי 1,700, רוח 2,930 (`config.js`).
- שלב 2: טבלת הגדרות לכל Scenario בראש `30_scenarios-input` (`scenario-settings.js`): תחזית ביקוש, ריבית, נצילות מימן. ה-keyframes מתחילים בשורה 25. `Scenario.settings`; `Set up scenario settings` בתפריט.
- שלב 3: גורמי פליטה של CCGT הועברו ל-`13_assumptions` (שורות `ccgt-emissions`). הלשונית `13_costs` שונתה ל-`13_assumptions`, `costs.js` ל-`assumptions.js`, ועמודות `pct_change_*` ל-`change_*` (פורמט אחוזים).
- שלב 4: ניקוי `20_parameters`: נשארו 17 שורות. הוסרו שורות שהועברו להגדרות התרחיש או לקבועים. רשימות נפתחות לתחזית ביקוש ולשנה (`_applyParameterDropdowns`).
- שלב 5: שינוי שמות לשוניות לפי use case: `20_parameters`→`20_year-input`, `40_year-summary`→`21_year-summary`, `41_daily-predicted`→`22_year-daily`, `42_hourly-predicted`→`23_year-hourly`, `421_daily-chart`→`24_year-chart-day`, `61_yearly-chart`→`25_year-chart-annual`, `90_run-history`→`29_year-run-history`, `21_scenarios-keyframes`→`30_scenarios-input`, `50_scenarios-yearly`→`31_scenarios-yearly`, `30_costs-forecast`→`14_assumptions-yearly`.
- `25_year-chart-annual`: תוקנו כותרות `nuclearGeneration` ו-`wasteToEnergyGeneration` (היו `#N/A`), הוחלף `OFFSET` ב-`INDEX`, נוקו עמודות M ו-O.
- `21_year-summary`: שורת כותרת עם השנה (A1). Predict Year עובר ל-`21_year-summary` בסיום, ו-Calculate Scenarios and Costs ל-`31_scenarios-yearly`.
- שלב 6: `00_documentation` נכתבת עכשיו לפי use case (תוכן עניינים, מדריך הרצה, תיעוד תפריט) ובפריסה דינמית: כל בלוק מונח אחרי הקודם, ושורת הקישור לתחזית נוגה נשמרת. עודכנו `NZO_core.md`, `README`, `NZO_collaboration_design.md` ודיאגרמת התלויות.

- **הוסרו (באישור David, 17.10.2026):** הלשונית `14_assumptions-yearly`, `saveCosts` (`assumptions.js`), הפעולה והפונקציה Calculate Costs (`main.js`), `SHEET_COSTS_OUTPUT` (`yearly_model.js`), וצעד הרענון בסוף Sync. הסיבה: הקוד בונה את הטבלה בזיכרון (`getCostsDb`) ואף קוד או נוסחה לא קראו ממנה. הקוד שנמחק נשמר ב-`NZO_removed_code.md`. הדיאגרמות והתיעוד עודכנו.
- `20_year-input` שורות 16–17 (נצילות ועומק פריקה של אגירה) הפכו מנוסחאות מ-`14_assumptions-yearly` לקלט רגיל (ברירת מחדל 0.93 ו-0.9), בהתאם ל-use case 2 שבו הם עמודות ב-keyframes. `14_assumptions-yearly` היא עכשיו פלט להצגה בלבד, ללא תלות של use case כלשהו. סכמת העיצוב מאפסת את הצבע והרקע האפורים של C16:C17 (`DESIGN_FORMER_CALCULATED_CELLS`).
- `21_year-summary`: שורת כותרות `name | units | value` (שורה 2), כותרת ביניים `run details` (שורה 32), וניקוי שארית של הרצות קודמות מתחת לרשימת הפרמטרים (`saveSummary`).
- דיאגרמת התלויות פוצלה לשתיים, אחת לכל use case: `docs/dependency-diagram-use-case-1/2.svg/.png`, ובקוד `dependency-diagram-data.js` (שתי תמונות) ו-`_writeDependencyDiagram` (כותרת ותמונה לכל use case). הגנרטור `dependency-diagram.make.py` מייצר את הכול (נדרש ImageMagick `convert`).

**מעקב והערות:**
- ב-hash נכללות רק לשוניות 10–13 (שמותיהן לא השתנו, למעט `13_costs`→`13_assumptions` בשלב 3 עם גרסת נתונים חדשה).
- בעותקים של חוקרים: לשנות את שמות הלשוניות ידנית (Sync לא עושה זאת) ולהריץ Set up scenario settings.
- פתוח: פרופיל הרוח של 2023 מעוות (Genesis Wind, 207 MW חובר באמצע השנה); `CODE_VERSION` (מומלץ 2.0.0 בשחרור); שינוי שם `getCostsDb`/`saveCosts`/"Calculate Costs" לא אושר.

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
- data/README.md updated: 02 and 04 are loaded whole from CSV.

### 2026-10-10 — futureDemandForecast reads 02_demand + 03_must_run_yearly directly (03_future-yearly-demand no longer needed by code)
- Decision (David): must-run gets its own CSV, not mixed with demand. `data/yearly_demand.csv` stays 3 columns. New `data/must_run_yearly.csv` (`year,must_run_mw`: 600 for 2023–2039, 0 from 2040; equals old 03!G = SUM(C:F)) → new tab `03_must_run_yearly`.
- `src/data-input.js`: new `_readYearlyTable(sheet, columns)` (by header name); `futureDemandForecast()` reads demand from `02_demand` (scenario from `01_parameters` 'demand-scenario' via `DEMAND_SCENARIO_COLUMNS`: Noga conservative → noga23_conservative_twh, Noga BAU → noga23_bau_twh) and mustRun from `03_must_run_yearly`. Clear errors for unknown scenario, missing column or missing year. Removed `SHEET_FUTURE_YEARLY_DEMAND` and the fixed-row logic.
- `data-meta.js`: `SHEET_MUST_RUN_INPUT='03_must_run_yearly'`; hash ranges: 02 A2:C29, 03_must_run_yearly A2:B29.
- Order to apply: create tab `03_must_run_yearly` and import must_run_yearly.csv → clasp push → reference test (expect PASS) → Update data hash (data-1.3) → then delete old 03_future-yearly-demand (backup first, approval; also fix 01!C2 scenario mapping is by name so no change needed).

### 2026-10-10 — 03_future-yearly-demand deleted (by David); data-1.3
- Tab deleted after the code moved to `02_demand` + `03_must_run_yearly`. Backup: sheet copy made earlier today; scenario values in NZO_removed_code.md. `_meta`: data-1.3, hash 87dc6d93…2848, status TRUE.
- Pending: reference test after deletion; tag data-1.3 (git tag shows only data-1.0).

### 2026-10-10 — PV deployment shares moved to roadmap inputs (30_roadmaps-keyframes); pv-average computed in code (code only, step 1)
- Decision (David): the split between PV types is a scenario input, not a cost assumption. Sum != 1 → error. Existing keyframe rows get 0.2/0.2/0.3/0.3. `32_saved-roadmaps` to be deleted (old layout). Column names: pvShareResidential, pvShareCommercial, pvShareUtility, pvShareDualUse.
- `year-state.js`: 4 new keyframe columns appended to `KEYFRAME_HEADERS` (O–R in sheet 30), defaults in `DEFAULT_YEAR_STATE_PARAMS`, included in `YearStateParams.toList()`; new `YearState.pvAverage(costsDb, 'capex'|'opex'|'lifetime')` = Σ share × cost of pv-residential/commercial/utility/dual-use for that year; throws on shares not summing to 1 (1e-6) or invalid. The four `costsDb.get('pv-average', …)` calls replaced. `YearStateParams` now keeps an explicit 0 (isNull instead of `||`; side effect: storageEfficiency/DoD of 0 no longer fall back to defaults).
- `reference_test.js`: REFERENCE_KEYFRAMES rows extended with 0.2,0.2,0.3,0.3 (expected results unchanged).
- Sheet steps: add O1:R1 headers + values to 30_roadmaps-keyframes (rows 2–61) → clasp push → reference test (expect PASS).
- Next: remove PV-Average rows 19–22 and share-of-deployment rows 15–18 from 05_costs/costs.csv (code no longer reads them), delete 32_saved-roadmaps (backup + approval), update README.
- Sheet step done (by Claude, at David's request): 30_roadmaps-keyframes O1:R1 headers + O2:R61 = 0.2/0.2/0.3/0.3 (60 rows verified). Next: clasp push → reference test.

### 2026-10-10 — PV shares and pv-average rows out of costs data; reference PASS after pvAverage
- Reference test PASS after the pvAverage / pvShare change (results identical).
- `data/costs.csv`: removed the 4 `share-of-deployment` rows → 55 data rows. README updated.
- Pending in sheet 05_costs: delete rows 15–22 (share-of-deployment 15–18, PV-Average 19–22; code no longer reads them) and `emissions, combined` (old row 41); then hash range `05_costs` rows must equal CSV rows (55) → update data-meta.js; Update data hash (data-1.4). NOTE: readTableFromSheet stops at the first blank product cell, so rows must be deleted, not cleared.
- DONE (by Claude, at David's request): 05_costs rows deleted — `emissions, combined` and rows 15–22 (shares + PV-Average). Sheet now has 55 data rows (sheet rows 3–57), keys and order identical to costs.csv (verified). data-meta.js: hash range 05_costs = A2:N57 (56 rows incl. header row). Next: clasp push → reference test → Update data hash (data-1.4) → commit + tag.

### 2026-10-10 — costs.js reads CSV layout; values computed in code; PV-Dual-Use capex rule in code (code only, not pushed)
- `costs.js`: `FORECASTED_PARAM_HEADERS` = costs.csv headers (product,parameter,source,units,comments,increase,base_price,pct_change_2022…2050); header row is now row 1 of `05_costs`. Values = `base_price × (1+pct)` computed in code (replaces sheet columns O–U). `increase` mode 'none' removed (only linear/yoy; otherwise error).
- `year-state.js` `pvAverage`: pv-dual-use capex = its own (construction) capex + pv-commercial capex (rule previously in the sheet's cost row). Side effect: `15_costs-output` will show dual-use capex as construction only (1250).
- `data-meta.js`: 05_costs hash range = A1:N56 (header + 55 rows).
- 05_costs lower "Parameters" section (gas price etc.) not used by code — removed by re-import.
- Order: search sheets for formulas referencing `05_costs` → import data/costs.csv into 05_costs ("Replace current sheet") → clasp push → Run reference test (expect PASS) → Update data hash (data-1.5) → Check data status → commit + tag.

### 2026-10-10 — Bug 3 fixed: last hour (row 8761) included in 01_parameters C4/C5/C7; reference re-recorded (intentional change)
- David changed ranges in 01_parameters C4/C5/C7 to H2:H8761, L2:L8761, F2:F8761 (previously ended at row 8760, excluding the last hour of the reference year).
- `reference_test_expected.js` re-recorded (2026-10-10T15:55Z). Before → after: totalEnergyDemandYearlyRefYear 76,997,689 → 77,005,378 (+0.010%); windCapacityRefYear 158.4259 → 158.4321; totalCost 607,632,321,064 → 607,560,837,756 (−0.012%); gasCost 323,403,469,890 → 323,360,171,860; maxRenewableShare 0.454393 → 0.454387; totalCost_2050 75,987,810,935 → 75,977,684,335. solarCapacityRefYear, solarKwToKwhYearly, storageCost, solarCost unchanged.
- Next: clasp push → reference test (expect PASS) → Update data hash (data-1.6) → commit + tag.

### 2026-10-10 — Step 7 (master + copies): decisions (David: choose the simplest options)
- One Apps Script project bound to both master and personal copies (clasp push to the master; copies inherit via "Make a copy").
- `MASTER_SPREADSHEET_ID` as a constant in git (`src/config.js`); not a secret — access is controlled by Drive permissions.
- Researcher results are saved via the existing `90_run-history` (32_saved-roadmaps was deleted); a dedicated save tab is deferred to step 8.
- Master = copy of the current sheet (data already equals git data-1.5), with personal input and outputs cleared.
- Note: `00_documentation` still lists deleted tabs (03_future-yearly-demand, 91_ramp-rates) and lacks 03_must_run_yearly — to update.

### 2026-10-10 — Step 7: master sheet created; config.js
- David created "NZO MODEL – MASTER" (ID 1Jt5JOLmbDQKUwqXYmxYCN9RaK641yBoiplJZKN8O_xY) from the current sheet. New `src/config.js` with `MASTER_SPREADSHEET_ID` (not used by code yet; for Sync, step 10).
- Findings while cleaning the master: (1) `12_summary` — clear only A3:C (code writes from row 3; A1 title stays, row 2 reserved for banner). (2) `15_costs-output` must NOT be cleared: 01_parameters C24/C26 (storage efficiency / depth of discharge) read it by HLOOKUP; after clearing → #N/A → "storageDepthOfDischarge out of range". Run Calculate cost after any 05_costs change. (3) C24/C26 used fixed row indexes 28/29 into 15_costs-output; rows shifted to 20/21 after removing share/pv-average rows → replaced with name-based SUMIFS/INDEX/MATCH (storage/efficiency, storage/depth of discharge). 2050 check: 95%/95%. (4) C2 data validation pointed to the deleted `03_future-yearly-demand` → replaced with a manual list (Noga conservative, Noga BAU). (5) C9/C29 now read 02_demand / 03_must_run_yearly.
- 00_documentation: add 03_must_run_yearly (link + text), remove deleted tabs rows.
- Predict year in master: no warnings.

### 2026-10-10 — Apps Script project switched to the master
- David no longer maintains the original sheet; only the master. `src/.clasp.json` scriptId now = master's script ID 108jUS5eOI2F3Gl0KfffnqaTiY6hyluz-RWXs9qqJjsiPbuvboAa2baOA (previous: 1oJyM7zSttsEcdr2fy4CrNEesJi3gYN70-_cLG8LvMc0rQxSg7P_JUWbq, the original sheet). A second file `.clasp-master.json` with `clasp push --project` failed ("srcDir escapes project root"); it is redundant and to be deleted by David.
- `clasp push` updates code only, never sheet data.

### 2026-10-10 — Removed roadmap enumeration (20_/21_/22_), "save Roadmap", unused constant (approved by David)
- Removed: whole `roadmaps-enumeration.js` content (sweep over 20_roadmaps-input → 21_roadmaps-output → 22_roadmaps-summary; classes RoadmapsEnumeration/ParameterEnumeration); menu items `Enumerate Roadmaps`, `Summarize Roadmaps`, `save Roadmap` and their functions in `main.js`; `saveRoadmapToSheet`, `getUniqueModelsFromColumn`, `SHEET_SAVED_ROADMAPS` in `history-save.js` (the target tab 32_saved-roadmaps was already deleted); `HOURLY_EXPORTED_COLUMNS` in `data-meta.js`. All backed up in `NZO_removed_code.md`.
- Dry check: no other file referenced any removed name; syntax check OK on all remaining files (concatenated too). Sensitivity/stochastic commented menu lines kept (open question 7).
- The sandbox cannot delete `src/roadmaps-enumeration.js` — David deletes it (`rm`), then `clasp push` (clasp removes it from the project only if the file is gone locally; otherwise delete it in the editor).
- Sheet steps (David): after backup, delete tabs 20_roadmaps-input, 21_roadmaps-output, 22_roadmaps-summary in the master; remove their rows from 00_documentation; Run reference test (expect PASS); run one roadmap.

### 2026-10-11 — Step 8 (design scheme) — code written, not yet pushed/run
- Decisions (David): delete tabs `99_dictionary` and `313_compare-models` from the master (not used by code); color legend goes into `00_documentation`; `_README` tab and menu-by-role with overwrite confirmation (Calculate Scenarios only) are next sub-steps.
- New `src/design-scheme.js`: `DESIGN_ROLES` (6 roles + colors), `DESIGN_SCHEME` (tab → role; 17 tabs), `DESIGN_CALCULATED_CELLS` (01_parameters C4,C5,C7,C9,C10,C24:C26,C29: grey text + warning-only protection), `designSchemeDryRun()` (logs only), `applyDesignScheme()` (idempotent: tab colors, warning-only protections tagged "NZO design scheme", calculated-cell look, legend written to 00_documentation I2:J8). Menu: Advanced → Apply design scheme. No rows/columns added, no tab renamed. Syntax check OK on all files.
- Notes: 00_documentation D:G still describes the removed menu items/tabs (21_roadmaps-output, 22_roadmaps-summary) — to update. Warning-only protection does not block script writes.

### 2026-10-11 — Step 8: design scheme verified in the master; `_README` tab and overwrite confirmation (code, not yet pushed)
- Verified by David: tab colors, calculated-cell protection and legend OK in the master.
- `design-scheme.js`: `_writeReadme()` creates/rewrites `_README` (4 run steps, first-run checklist, color legend; role `status`); called from `applyDesignScheme()`.
- `main.js`: `confirmOverwrite(sheetNames)` (YES/NO dialog; without UI it continues, so editor/unattended runs are not blocked) used by `calculateScenariosAndCosts` (overwrites 31_roadmaps-yearly-output and 15_costs-output). Predict Year has no confirmation (by decision). Menu is already grouped (run items, then Advanced submenu); no further menu change until Sync (step 10) adds its items.
- Next: clasp push → Advanced → Apply design scheme (creates `_README`) → run Calculate Scenarios (confirm dialog appears) → reference test → commit.
- (2026-10-11) Per David: legend anchor moved to `00_documentation!A1` (A1:B7, 7 rows × 2 columns, overwritten on every apply; David clears that area first). `_README` points to A1.
- (2026-10-11) Per David: menu documentation written by `applyDesignScheme()` to `00_documentation!A9:C17` (table: menu item / what it does / tabs updated), below the legend (A1:B7). Source of truth: `DESIGN_MENU_DOCS` in design-scheme.js (keep in sync with `buildMenu()` when menu items change, e.g., Sync in step 10).
- (2026-10-11) Per David (option 1): `_README` tab dropped. `_writeReadme` removed (backup in NZO_removed_code.md); the 4-step run guide and first-run checklist are written to `00_documentation!A19:B28` (`DESIGN_RUN_GUIDE`). If `_README` was already created in the master, delete it manually (it is no longer in DESIGN_SCHEME).

### 2026-10-11 — Terminology: roadmap → scenario (levels 1+2+3, approved by David)
- Code: class `Roadmap` → `Scenario` (file `roadmaps.js` → `scenarios.js`), `readRoadmapsFromKeyframes` → `readScenariosFromKeyframes`, `groupYearsIntoRoadmaps` → `groupYearsIntoScenarios`, `SHEET_ROADMAP_KEYFRAMES` → `SHEET_SCENARIO_KEYFRAMES`, `REFERENCE_ROADMAP_NAME` → `REFERENCE_SCENARIO_NAME`, `_buildReferenceRoadmap` → `_buildReferenceScenario`; reference JSON key `roadmap` → `scenario` (values unchanged).
- To avoid a name clash, the old yearly meaning of "scenario" (a single YearState) was renamed first: `scenario(s)` → `yearState(s)` in scenarios.js, parameters.js, year-state.js. `demand-scenario` (01_parameters, DEMAND_SCENARIO_COLUMNS) left unchanged for now — open question (proposed: `demand-forecast`).
- Tabs: `30_roadmaps-keyframes` → `30_scenarios-keyframes`, `31_roadmaps-yearly-output` → `31_scenarios-yearly-output` (DESIGN_SCHEME and constants updated). Tab headers contain no "roadmap" text.
- Docs updated: data/README.md, reference/README.md, NZO_core.md, NZO_collaboration_design.md. History files (this archive, NZO_removed_code.md) keep the old term. Stale copies under `sim/` (outside the repo) not touched.
- Order: rename the two tabs in the master, then `clasp push` right away (code and tab names must match); delete the old `roadmaps.js` file from the Apps Script project in the editor (clasp does not remove it when the local file is renamed? it does not exist locally any more — delete in editor if it remains). Then Apply design scheme, Calculate Scenarios and Costs, Run reference test (expect PASS).

### 2026-10-11 — Tab prefixes renumbered by workflow stage (approved by David: full proposal)
- Scheme: 00 documentation; 1x base data (synced, purple): `10_demand`, `11_must_run_yearly`, `12_raw-data-hourly`, `13_costs`; 2x inputs (blue): `20_parameters`, `21_scenarios-keyframes`; 3x costs (green): `30_costs-output`; 4x single-year results (green): `40_summary`, `41_daily-predicted`, `42_hourly-predicted`; 5x scenario results (green): `50_scenarios-yearly-output`; 6x charts (turquoise): `60_daily-chart-dynamic`, `61_yearly-chart-dynamic`; 90 `90_run-history` (orange); `_meta`, `_status` unchanged.
- Old → new: 01→20, 02→10, 03→11, 04→12, 05→13, 10→42, 11→41, 12→40, 15→30, 100→60, 110→61, 30→21, 31→50.
- Code: all `SHEET_*` constants, `DESIGN_SCHEME`, `DESIGN_CALCULATED_CELLS`, `DATA_HASH_RANGES`, comments; docs (README, NZO_core, NZO_collaboration_design, data/README, reference/README) updated by full-name replacement. History files (archive, removed_code) keep the old names. Syntax check OK. Backup of src before the change: /tmp/src_before_prefix (sandbox only).
- Design doc note: its future-step tab names (`50_charts`, `51_chart-data`, `59_my-charts`, `07_local-overrides`, `32_saved-roadmaps`, `41_`, `06_`, `40_`) were planned under the old numbering and now collide with the new scheme (e.g. 50 = scenario results, 6x = charts) — to renumber when steps 9–12 are designed.
- Order: rename the 13 tabs in the master → `clasp push` → Apply design scheme → Calculate Costs → Calculate Scenarios and Costs → Run reference test (expect PASS) → Update data hash (the hash range names changed) → commit + tag.

## 2026-10-11 — Tab order + demand-forecast
- `src/design-scheme.js`: new `DESIGN_TAB_ORDER` and `_applyTabOrder()` (called at the end of `applyDesignScheme()`): 00 documentation → 20, 21 (researcher inputs) → 30, 40, 41, 42, 50, 60, 61, 90 (outputs, charts, run history) → 10–13 (base data) → `_meta`, `_status`. Tabs not in the list stay after them.
- `src/data-input.js`: `'demand-scenario'` → `'demand-forecast'` (matches the label already renamed in 20_parameters A2); `DEMAND_SCENARIO_COLUMNS` → `DEMAND_FORECAST_COLUMNS`. Run-history logging adds a new header row automatically for the renamed label.
- `src/design-scheme.js`: stale tab numbers in the text written to 00_documentation fixed (Update data hash: 10–13; run guide green tabs: 30, 40, 41, 42, 50).
- `src/design-scheme.js`: new `_writeSheetsTable()` (called by `applyDesignScheme()`): rewrites the tab list in 00_documentation (found by the header cell 'גליונות' in column A; the Noga forecast link row is kept; the next 20 rows are cleared and rewritten) with current tab names, internal links (#gid), role-colored name cells and descriptions. Replaces the stale list (01_parameters … 92_charts-static, incl. 310/311/92 that no longer exist).

## 2026-10-11 — Tab name review (second renaming)
- Renamed: `10_demand`→`10_demand-yearly`, `11_must_run_yearly`→`11_must-run-yearly` (data file `data/must_run_yearly.csv` unchanged), `30_costs-output`→`30_costs-forecast`, `40_summary`→`40_year-summary`, `50_scenarios-yearly-output`→`50_scenarios-yearly`, `60_daily-chart-dynamic`→`60_daily-chart`, `61_yearly-chart-dynamic`→`61_yearly-chart`. Not renamed: 41/42 order (kept), 90_run-history.
- Code: `SHEET_*` constants (yearly_model.js, data-meta.js, data-input.js, year-state.js), DESIGN_SCHEME, DESIGN_TAB_ORDER, DESIGN_SHEETS_TABLE and comments; docs: data/README, NZO_core, NZO_collaboration_design. Older archive entries keep the names of their time. Syntax check passed on all src files.
- Needs after pushing: rename the 7 tabs in the master (sheet formulas follow automatically, but 20_parameters C24/C26 look up the costs tab by name — verify), Apply design scheme, Update data hash (hash ranges keyed by tab name), Run reference test.

## 2026-10-11 — Cell color audit
- New menu item Advanced → `Audit cell colors` (`auditCellColors()` in design-scheme.js, read-only): groups every tab's used range by (background, font color) and writes the groups to a temporary tab `_color-audit` (tab, role, background, font color, cells, first/last cell, cells with value, bold). Delete the tab after reviewing.
- Cell colors: all manual cell colors in the master had no meaning (per David). New menu item Advanced → `Reset cell colors` (`resetCellColors()`, confirmation dialog): clears background and font color over each tab's data range, except `00_documentation` (legend and tab list written by Apply design scheme), `_status` (status cell colored by checkDataStatus) and `_color-audit`. Calculated cells in 20_parameters now also get background `#efefef` (`DESIGN_CALCULATED_BACKGROUND`) in applyDesignScheme, so they stay visible after the reset. Order: Reset cell colors → Apply design scheme.
- Removed the one-off helpers `auditCellColors()`, `resetCellColors()`, `_colLetter()`, `DESIGN_AUDIT_SHEET`, `DESIGN_RESET_SKIP` and their two Advanced menu items (backup in NZO_removed_code.md). Delete the `_color-audit` tab manually if it still exists.

## 2026-10-11 — color legend merged into the tab list
- `00_documentation`: the separate legend (A1:B7) is gone. The tab list (found by the header 'גליונות') is now grouped; each group starts with a header row in the role color showing the role label and note (e.g. "קלט אישי — עריכה חופשית. Sync לא נוגע"), followed by its tabs (internal links + description). Table structure: `DESIGN_SHEETS_TABLE` = list of `{role, tabs}`; cleared area `DESIGN_SHEETS_OLD_ROWS` = 34 rows.
- Menu docs moved to A1 (was A9) and run guide to A11 (was A19). `_migrateLegendLayout()` clears the old legend/menu docs/run guide areas once (detected by the old title in A1). `_writeDesignLegend()` removed (backup in NZO_removed_code.md).

## 2026-10-11 — tab dependency diagram in 00_documentation
- New `docs/dependency-diagram.svg` / `.png` (+ generator `docs/dependency-diagram.make.py`, needs Playwright for the PNG): inputs/base data → menu action → output tabs → charts, the `30_costs-forecast` → `20_parameters` formula link (C24/C26, HLOOKUP by year), and the data-hash flow to `_meta` / `_status`. Chart sources (60/61) are dashed: taken from the tab descriptions, not verified in the chart ranges.
- `src/dependency-diagram-data.js` (generated, base64 of the PNG) + `_writeDependencyDiagram()` in design-scheme.js: `applyDesignScheme()` inserts the image below the tab list in 00_documentation (title row `tableEnd + 2`, image below it, alt text 'NZO tab dependency diagram' used to replace the previous copy on re-run; 40 rows below the title are cleared). `_writeSheetsTable()` now returns the next free row.
- To update the diagram: edit the make script, regenerate the PNG, regenerate `dependency-diagram-data.js`, push, Apply design scheme.

## 2026-10-11 — Step 10a: Sync from master (no local overrides yet)
- New `src/sync.js`: `syncFromMaster()` (menu item `Sync from master`, below Calculate Scenarios and Costs). Flow: refuse in the master itself → open master by `MASTER_SPREADSHEET_ID` → read master `_meta` (version + hash required) → "already up to date" if same version and local hash equals master hash → recompute master hash and stop if it differs from `_meta` (master edited by hand) → header check of both spreadsheets (`SYNC_REQUIRED_HEADERS`: costs and hourly by exact position, demand and must-run by name) → confirmation dialog (old → new version, tab list) → copy values + number formats for exactly the `DATA_HASH_RANGES` ranges (nothing outside them is touched) → recompute local hash and require equality with the master hash, else do not write `_meta` → `_writeMeta`, `last_sync` document property → `calculateCosts()`, `applyDesignScheme()`, `_writeStatus()` → summary dialog. Everything is validated before the first cell is written.
- `src/data-meta.js`: `computeDataHash(spreadsheet?)` and `getDataMeta(spreadsheet?)` take an optional spreadsheet (default: active), so the master can be hashed/read from a copy. `_status` has a new row `last_sync` (document property, survives Check data status).
- `src/main.js`: removed `@OnlyCurrentDoc` (it limited the script to the current spreadsheet; opening the master by ID needs the full spreadsheets scope). The first run after the push asks for authorization again. Menu: `Sync from master` added.
- `src/design-scheme.js`: menu docs row for Sync from master; run guide moved from row 11 to row 12.
- Not done (step 10b): `07_local-overrides`, "set/cancel override" menu items, conflict handling, `overrides` column in run history.

## 2026-10-13 — docs: hash depends on tab names; core menu table refreshed
- Found while testing Sync: renaming base tabs changes `data_hash` (the hash text contains `#sheet!range`), so the master's data-1.7 hash no longer matched and Sync correctly stopped. Fix: Update data hash in the master with a new version (data-1.8) and tag it.
- `NZO_collaboration_design.md` (section 7) and `NZO_core.md`: rule added. `NZO_core.md`: menu table now lists Sync from master and the Advanced items; removed Enumerate/Summarize/save Scenario rows and the `scenarios-enumeration.gs` entry (code removed earlier); file list mentions sync.js, data-meta.js, design-scheme.js, config.js.

## 2026-10-13 — Step 10b-1: local overrides (sheet, menu, hash)
- New `src/overrides.js`, tab `22_local-overrides` (renamed from the design doc's `07_local-overrides` to fit the prefix scheme; role input, created by `applyDesignScheme` via `ensureOverridesSheet`). Columns: tab, cell, header, base_value, local_value, note, created, status. `cell` = A1 (one row per cell) or `*` for a whole local tab.
- Menu `Local overrides`: `Register selected cells as override` (the researcher edits cells in a base tab first, then selects them; only cells that differ from the master are registered, within the DATA_HASH_RANGES ranges, max 500 cells, reason required; the master value is read via `openById`; the cell gets a yellow background and a note), `Mark current tab as local`, `Cancel override` (writes the master value back and deletes the rows, or removes a tab mark). Not available in the master itself.
- `data-meta.js`: `computeDataHash(spreadsheet?, reverts?)` can replace given cells before hashing; new `computeLiveHashState()` = hash with override cells replaced by `base_value`, plus `partialTabs` (whole local tabs, cannot be compared) and the cell count. `_writeStatus(state)` now takes that state; `_status` shows `data_hash_match` (true/false, or `n/a (local tab: ...)`, yellow) and a new row `local_overrides`. `getRunMetadata` and `checkDataStatus` use the same state.
- `applyDesignScheme` re-applies the override look (`applyOverrideMarks`) and creates the tab; tab order, tab list and menu docs updated; run guide moved to row 13.
- Guard in `syncFromMaster`: stops when overrides exist (Sync does not respect them until step 10b-2).
- Verified offline with a stubbed Node test: changing a cell changes the hash, and replacing it by base_value restores the master hash. Not yet tested in the sheet.

## 2026-10-17 — Step 10a verified in Worker1; docs top area cleanup
- Sync from master tested end to end in the copy `NZO MODEL – Worker1`: master changed (`13_costs!E2` = `sync-test`, Update data hash → `data-1.9`), Sync showed `data-1.8 → data-1.9`, copied, `_status` = data-1.9, `data_hash_match` TRUE, `last_sync` 2026-10-17T08:58, 30_costs-forecast recalculated, `13_costs!E2` copied. Duration about 2 minutes (limit is 6). The path "master hash does not match `_meta`" was verified earlier (renamed tabs).
- Cleanup of the test: clear `13_costs!E2` in the master and run Update data hash with `data-1.10`, then Sync in Worker1.
- `src/design-scheme.js`: `_migrateLegendLayout()` replaced by `_clearDocsTopArea()`: rows 1..end of run guide (A:C) of 00_documentation are always cleared before writing (fixes the duplicate "ארבעה שלבים להרצה" row left from the earlier anchor move).

## 2026-10-17 — Step 10b deferred (known issue); Sync shows what will change
- Decision: local overrides of base data (step 10b) are deferred. Known issue: manual edits in tabs 10-13 of a researcher copy are overwritten by Sync. Documented in `NZO_core.md` (section 2) and `NZO_collaboration_design.md` (step 10, item 5 marked deferred).
- Removed the unpushed 10b-1 code: `src/overrides.js` deleted; `data-meta.js` back to `computeDataHash(spreadsheet?)` and `_writeStatus(liveHash)` (no `computeLiveHashState`, no reverts); `sync.js` guard removed; `main.js` submenu `Local overrides` removed; `design-scheme.js`: `22_local-overrides` removed from scheme, tab order, tab list and menu docs, run guide anchor back to row 12. Backup of all of it is in `NZO_removed_code.md`.
- `src/sync.js`: new `_syncCountDifferences(master, local)`. The confirmation dialog now lists, per tab, how many cells change, the first 5 changed cells (A1), and a WARNING when the local hash differs from the local recorded hash (base data edited by hand since the last sync).
- Syntax check passed on all `src/*.js`. Not yet tested in the sheet: push, then run Sync in Worker1 (with and without a hand edit in `13_costs`).
