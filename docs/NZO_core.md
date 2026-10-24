# NZO MODEL – תיעוד עבודה

גליון: **NZO MODEL David1**
פרויקט Apps Script: **NZO Energy Model** (11 קבצים, כ-3,100 שורות)
התחלה: 2 באוקטובר 2026

---

## 1. מה המודל עושה

מודל לתכנון משק החשמל בישראל עד 2050. השאלה המרכזית: בהינתן תמהיל של סולארי, רוח, אגירה, גרעין, פסולת לאנרגיה, מימן, V2G וניהול ביקוש (DFS), מה יהיה נתח האנרגיה הנקייה, כמה גז עוד יידרש (אנרגיה והספק), ומה העלות הכוללת לאורך השנים (NPV).

### שני use cases ולשוניות לפי קוד (מאוקטובר 2026)
קידוד הלשוניות לפי use case: הספרה הראשונה קובעת את הקבוצה, ולכל use case יש דף קלט אחד.

| קוד | קבוצה | לשוניות |
|---|---|---|
| `0x`, `_` | מערכת | `00_documentation`, `_meta`, `_status` |
| `1x` | נתוני בסיס, משותף לשני ה-use cases | `10_demand-yearly`, `11_must-run-yearly`, `12_raw-data-hourly`, `13_tech-params` |
| `2x` | **Use case 1: Predict Year** (שנה בודדת) | `20_year-input` (קלט), `21_year-summary`, `22_year-daily`, `23_year-hourly`, `24_year-chart-day`, `25_year-chart-annual`, `29_year-run-history` |
| `3x` | **Use case 2: תרחישים** | `30_scenarios-input` (קלט: טבלת הגדרות + keyframes), `31_scenarios-yearly`, `32_scenarios-charts` (גרפים לכל Scenario, תיבת סימון להשמטה) |

**הפרדת הקלטים:** Predict Year קורא קלטים רק מ-`20_year-input`, ו-Run Scenarios קורא קלטים רק מ-`30_scenarios-input` (וממנו מגיעים גם תחזית הביקוש, הריבית וסט הפרמטרים של כל Scenario). פרמטרים טכנולוגיים שמשפיעים על הסימולציה (נצילות ועומק פריקה של אגירה, נצילות מימן) נקראים מ-`13_tech-params` בשני ה-use cases (Predict Year: סט `NZO`; Scenario: הסט שלו), דרך `techParamsForYear`. קבועים פיזיקליים (שעות אפקטיביות סולארי 1,700 ורוח 2,930, ב-`config.js`) וגורמי פליטה של CCGT (`13_tech-params`, שורות `ccgt-emissions`) אינם קלט של אף use case. ההספקים וסך הביקוש של שנת הייחוס מחושבים מ-`12_raw-data-hourly`.

### קלטים

| לשונית | תוכן |
|---|---|
| `20_year-input` | 14 שורות: תחזית ביקוש (`demand-forecast`, רשימה נפתחת), שנת היעד (`predicted year`), הספקי סולארי, רוח, גרעין, פסולת לאנרגיה, מימן (אחסון, ייצור, יבוא), אנרגיית אגירה, DFS ו-V2G. כל השורות קלט רגיל. נצילות מימן ונצילות ועומק פריקה של אגירה הוסרו ב-24.10.2026 ונקראים מ-`13_tech-params` |
| `30_scenarios-input` | שורות 1–20: טבלת הגדרות לכל Scenario (`name`, `demandForecast`, `interestRate`, `paramSet`; רשימות נפתחות). שורה 24: כותרת, שורה 25: כותרות keyframes (ללא נצילות ועומק פריקה של אגירה מאז 24.10.2026), ומשם מפות הדרכים (שנות מפתח לכל Scenario). שם ב-keyframes חייב להופיע בטבלת ההגדרות. מופעל בעותק ישן דרך Advanced → Set up scenario settings |
| `12_raw-data-hourly` | פרופיל שעתי של שנת ייחוס (8,760 שעות): ביקוש, סולארי, רוח. מקור לקבועי שנת הייחוס |
| `10_demand-yearly`, `11_must-run-yearly` | תחזיות ביקוש שנתיות לפי תרחיש (2023–2050) וקיבולת must-run לפי שנה |
| `13_tech-params` | עמודה A `param_set`: סט הפרמטרים של השורה. הסט `NZO` (ברירת המחדל) מכיל את כל השורות; סט אחר (למשל של רשות החשמל) מכיל רק את השורות השונות, ושורה חסרה נלקחת מ-`NZO`. כל Scenario בוחר סט בעמודה `paramSet` בטבלת ההגדרות. CAPEX, OPEX, דלק, אורך חיים, פליטות (כולל `ccgt-emissions`), ירידות מחירים (`change_2022`…`change_2050`, שברים: -0.162 = ירידה של 16.2%). הקוד משלים את השנים שביניהן |
| `06_sensitivity-analysis`, `40_stochastic-analysis-input` | (לא בשימוש בקוד מאז 4.10.2026) |

### פלט והתנהגות
- אחרי Predict Year הגיליון עובר ל-`21_year-summary` (שורה 1: `output results - year <שנה>`, נתונים משורה 3). אחרי Run Scenarios הוא עובר ל-`31_scenarios-yearly`.
- `25_year-chart-annual`: שורה 24 כותרות, ושורה 25 נוסחאות `INDEX`+`MATCH` ששולפות עמודות מ-`22_year-daily` לפי הכותרת. הגרף דורש טווח רציף, ולכן היא עותק של נתוני 22. `maxgasgen*10` הוא `maxGasGen×10` לקנה מידה.

### ליבת הסימולציה – `calculateYear` (בקובץ yearly_model.gs)
1. הביקוש השעתי מוכפל במקדם הגידול לשנת היעד.
2. סולארי ורוח מחושבים לפי ההספק החדש, בצורה של שנת הייחוס.
3. ביקוש נטו = ביקוש פחות גרעין, פסולת, סולארי, רוח ו-must-run.
4. DFS: הורדת ביקוש בשעות השיא והעברתו לשעה ירוקה באותו יום.
5. שיבוץ: עודף נכנס ל-V2G, אחר כך לסוללה ואחר כך למימן. שיאים מכוסים מסוללה, V2G, מימן ובסוף גז. לפעמים מתוכננת טעינה מגז בלילה.
6. סיכום יומי ושנתי: נתח מתחדשות, ייצור גז, שיא הספק גז (ועוד 20% מרווח), קיצוץ ייצור, אנרגיה חסרה.

### שכבת הכלכלה
לכל שנה: הספק חדש שנבנה (כולל החלפה בסוף אורך החיים), CAPEX לפי PMT לאורך חיי הנכס, OPEX, דלק ועלויות זיהום. בסוף NPV מצטבר.

### פריטי התפריט (NZO Model)
| פעולה | מה עושה | פלט |
|---|---|---|
| Predict Year | סימולציה לשנה אחת לפי `20_year-input` | `23_year-hourly`, `22_year-daily`, `21_year-summary`, `29_year-run-history` |
| Run Scenarios (בונה את כל ה-Scenarios) | כל מפות הדרכים מ-`30_scenarios-input`, שנה אחר שנה | `31_scenarios-yearly` |
| Sync from master (בעותק של חוקר) | מעתיקה מהמאסטר את נתוני הבסיס (טווחי ה-hash של `10`–`13`) אחרי בדיקת hash המאסטר וכותרות | `10_demand-yearly`, `11_must-run-yearly`, `12_raw-data-hourly`, `13_tech-params`, `_meta`, `_status` |
| Advanced: Run / Record reference test | בדיקת תרחיש ייחוס מול ערכים שמורים ב-`reference_test_expected.js` | לא כותבות ללשוניות |
| Advanced: Update data hash / Check data status | רישום גרסת נתונים ו-hash ב-`_meta`, ובדיקה שהנתונים תואמים | `_meta`, `_status` |
| Advanced: Apply design scheme | צבעי לשוניות, הגנות באזהרה, סדר לשוניות, תיעוד התפריט, טבלת הגליונות והדיאגרמה | `00_documentation` |

> **ה-hash תלוי בשמות הלשוניות:** הוא כולל את שם הלשונית והטווח (`#שם!טווח`). אחרי שינוי שם של לשונית בסיס (10–13) צריך להריץ במאסטר Update data hash ולתייג גרסת נתונים חדשה (למשל `data-1.8`), אחרת Sync בעותקים ייעצר עם "המאסטר אינו תואם ל-hash הרשום".

> **הוסר 17.10.2026:** הלשונית `14_assumptions-yearly` (עותק מחושב של `13_tech-params` לפי שנה), הפונקציה `saveCosts` והפעולה Calculate Costs. הקוד בונה את אותה טבלה בזיכרון (`getCostsDb`) ואף לשונית לא תלויה בה. הקוד שנמחק נשמר ב-`NZO_removed_code.md`.

### הנחות מידול שכדאי לאשר
- גרעין ומימן מיובא נספרים בתוך `renewableConsumption`.
- `windUsage = min(windGen, demand)`: הרוח נספרת במלואה גם כשיש קיצוץ, כך שייתכן שנתח המתחדשות מנופח.
- סוללות מוגדרות תמיד ל-4 שעות (`storageCapacity = storageEnergy / 4`). הערך שבגליון בשורה "predicted storage capacity limit" לא בשימוש.
- V2G נפרק רק כשהסוללה הנייחת מתחת ל-70%, בקצב של עד 5% מ-V2GEnergy בשעה.
- לשימוש במימן אין מגבלת הספק לשעה.

---

### קבצי הקוד (מאוקטובר 2026)
- `year-state.gs`: `YearState` (שנה אחת + עלויות), `YearStateParams`, `generateYearStates`, כותרות פלט וקלט (keyframes), `readScenariosFromKeyframes`, `chooseScenario`, `saveYearStatesOutput`.
- `scenarios.gs`: `Scenario` (סימולציה ועלויות לכל השנים) ו-`groupYearsIntoScenarios`.
- `sync.js`: `syncFromMaster` (שלב 10א). `data-meta.js`: גרסת נתונים ו-hash (`computeDataHash`, `getDataMeta` מקבלות גיליון אופציונלי). `design-scheme.js`: סכמת עיצוב, סדר לשוניות, תיעוד ב-`00_documentation`. `config.js`: `MASTER_SPREADSHEET_ID`.

### מינוח (מאוקטובר 2026)
- **Scenario** = מודל שלם (כמה שנות מפתח). **YearState** (בעבר `Scenario`) = מצב של שנה אחת. **keyframes** = שורות ב-`30_scenarios-input`.
- מזהים עיקריים בקוד: `chooseScenario`, `readScenariosFromKeyframes`, `groupYearsIntoScenarios`, `saveScenario`, `class YearState`, `Scenario.years`, `generateYearStates`, `saveYearStatesOutput`, `YEAR_STATE_HEADERS`, `KEYFRAME_HEADERS`.
- שמות הלשוניות בקוד מוגדרים בקבועי `SHEET_*` (18 קבועים); אין עוד שמות לשוניות כמחרוזות בקוד.
- `getCostsDb` (ב-`tech-params.js`) בונה בזיכרון את טבלת ההנחות המורחבת מ-`13_tech-params` (מחיר בסיס כפול 1+`change_YYYY` לכל שנה), לפי `param_set`. `CostsDb.forSet(name)` מחזיר תצוגה של סט אחד עם נפילה ל-`NZO`; `Scenario.calculateCosts` משתמש בסט של התרחיש, והסט נרשם בעמודה `paramSet` (האחרונה) ב-`31_scenarios-yearly`. Predict Year לא מחשב עלויות ולכן לא בוחר סט. `saveCosts` והלשונית `14` הוסרו.
- שמות עמודות: שדות השעה אוחדו (`…Generation`, `hydrogenImported`, `solarToV2g`). נשארו: `Cummulative` (typo, נשאר בכוונה: פיבוטים וגרף תלויים בו), כותרות קלט (`Product`/`Parameter`/`Base Price`/`val_base`), `maxFossilCapacity`.

## 2. מצב נוכחי
- **בעיה ידועה (Sync):** אין התאמות מקומיות לנתוני בסיס. עריכה ידנית בלשוניות `10`–`13` בעותק נדרסת בסנכרון הבא. חלון האישור של Sync מציג כמה תאים ישתנו, ומזהיר אם נתוני הבסיס בעותק נערכו ידנית. לשינוי קבוע: משנים בגיט ובמאסטר. מנגנון התאמות מקומיות (שלב 10ב) נדחה.
- **4.10.2026 ו-10.10.2026:** הוסרו מהקוד הניתוחים sensitivity ו-stochastic וכל שרידיהם (הקובץ `stochastic analysis.gs` נמחק). הפרויקט: 11 קבצים, 3,102 שורות. הקוד ב-`NZO_removed_code.md`. בדיקת עשן אחרי הניקיון: Predict Year ו-Run Scenarios עברו ללא שגיאות.
- כל 7 הבאגים שנמצאו תוקנו ונשמרו, והיסטוריית השינויים המלאה נמצאת ב-`NZO_archive.md` (לא בפרויקט).
- לא נבדק על הגיליון: הגבלת הזמן בניתוח הסטוכסטי, שאלה יחידה ב-sensitivity, חידוש סריקת scenarios, וכתיבת שורת כותרות ב-`29_year-run-history`.
- פתוח: שאלות המודל שבסעיף "הנחות מידול שכדאי לאשר", איחוד פורמט ב-`21_year-summary`, ושתי שורות לא בשימוש ב-`40_stochastic-analysis-input`.
- פתוח בגליון: `312!B77:B79` מצביעים על 2024/2034/2044 במקום 2020/2030/2040; `310!A111` (FILTER) מחזיר #REF! (קיים מראש). `312!B80` תוקן ל-`='10_demand-yearly'!H47`.
- LB/UB בניתוח הסטוכסטי: "LB" בגיליון הוא העלייה המרבית ו-"UB" הירידה המרבית (r בין `1 - UB` ל-`1 + LB`).
- `21_year-summary`: שורה 1 כותרת עם השנה, שורה 2 ריקה, והנתונים מתחילים בשורה 3.
