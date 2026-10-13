# NZO MODEL – תיעוד עבודה

גליון: **NZO MODEL David1**
פרויקט Apps Script: **NZO Energy Model** (11 קבצים, כ-3,100 שורות)
התחלה: 2 באוקטובר 2026

---

## 1. מה המודל עושה

מודל לתכנון משק החשמל בישראל עד 2050. השאלה המרכזית: בהינתן תמהיל של סולארי, רוח, אגירה, גרעין, פסולת לאנרגיה, מימן, V2G וניהול ביקוש (DFS), מה יהיה נתח האנרגיה הנקייה, כמה גז עוד יידרש (אנרגיה והספק), ומה העלות הכוללת לאורך השנים (NPV).

### קלטים

| לשונית | תוכן |
|---|---|
| `20_parameters` | הנחות יסוד: שעות ייצור, הספקים, שנת יעד, אגירה, פליטות, ריבית. חלק מהתאים מחושבים מתוך `30_costs-forecast` (בנוסחת HLOOKUP לפי שנת היעד) |
| `12_raw-data-hourly` | פרופיל שעתי של שנת ייחוס (8,760 שעות): ביקוש, סולארי, רוח |
| `03_future-yearly-demand` | תחזית ביקוש שנתית ל-2023–2050 לפי התרחיש שנבחר |
| `13_costs` | CAPEX, OPEX, דלק, אורך חיים, פליטות, WACC. נקודות לשנים 2022/2025/…/2050, והקוד משלים את השנים שביניהן |
| `21_scenarios-keyframes` | מפות דרכים ידניות: שנות מפתח (keyframes) לכל Scenario |
| `20_scenarios-input` | טווחים לסריקה אוטומטית (min, max, interval) |
| `06_sensitivity-analysis` | (לא בשימוש בקוד מאז 4.10.2026) שינויים באחוזים לניתוח רגישות |
| `40_stochastic-analysis-input` | (לא בשימוש בקוד מאז 4.10.2026) גבולות לשינוי אקראי |

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
| Predict Year | סימולציה לשנה אחת לפי `20_parameters` | `42_hourly-predicted`, `41_daily-predicted`, `40_year-summary`, `90_run-history` |
| Calculate Costs | מחשבת ומייצאת את טבלת העלויות | `30_costs-forecast` |
| Calculate Scenarios and Costs (בונה את כל ה-Scenarios) | כל מפות הדרכים מ-`21_scenarios-keyframes`, שנה אחר שנה | `50_scenarios-yearly`, `30_costs-forecast` |
| Sync from master (בעותק של חוקר) | מעתיקה מהמאסטר את נתוני הבסיס (טווחי ה-hash של `10`–`13`) אחרי בדיקת hash המאסטר וכותרות, ומריצה Calculate Costs | `10_demand-yearly`, `11_must-run-yearly`, `12_raw-data-hourly`, `13_costs`, `30_costs-forecast`, `_meta`, `_status` |
| Advanced: Run / Record reference test | בדיקת תרחיש ייחוס מול ערכים שמורים ב-`reference_test_expected.js` | לא כותבות ללשוניות |
| Advanced: Update data hash / Check data status | רישום גרסת נתונים ו-hash ב-`_meta`, ובדיקה שהנתונים תואמים | `_meta`, `_status` |
| Advanced: Apply design scheme | צבעי לשוניות, הגנות באזהרה, סדר לשוניות, תיעוד התפריט, טבלת הגליונות והדיאגרמה | `00_documentation` |

> **ה-hash תלוי בשמות הלשוניות:** הוא כולל את שם הלשונית והטווח (`#שם!טווח`). אחרי שינוי שם של לשונית בסיס (10–13) צריך להריץ במאסטר Update data hash ולתייג גרסת נתונים חדשה (למשל `data-1.8`), אחרת Sync בעותקים ייעצר עם "המאסטר אינו תואם ל-hash הרשום".

> **חשוב:** Predict Year **לא** מרענן את `30_costs-forecast`. ערכים ב-`20_parameters` שמגיעים משם (למשל נצילות ועומק פריקה של אגירה) מתעדכנים רק אחרי Calculate Costs או Calculate Scenarios and Costs (בונה את כל ה-Scenarios).

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
- **Scenario** = מודל שלם (כמה שנות מפתח). **YearState** (בעבר `Scenario`) = מצב של שנה אחת. **keyframes** = שורות ב-`21_scenarios-keyframes`.
- מזהים עיקריים בקוד: `chooseScenario`, `readScenariosFromKeyframes`, `groupYearsIntoScenarios`, `saveScenario`, `class YearState`, `Scenario.years`, `generateYearStates`, `saveYearStatesOutput`, `YEAR_STATE_HEADERS`, `KEYFRAME_HEADERS`.
- שמות הלשוניות בקוד מוגדרים בקבועי `SHEET_*` (18 קבועים); אין עוד שמות לשוניות כמחרוזות בקוד.
- `saveCosts` כותבת את טבלת ההנחות המורחבת מ-`13_costs` אל `30_costs-forecast` (לא עלויות Scenario).
- שמות עמודות: שדות השעה אוחדו (`…Generation`, `hydrogenImported`, `solarToV2g`). נשארו: `Cummulative` (typo, נשאר בכוונה: פיבוטים וגרף תלויים בו), כותרות קלט (`Product`/`Parameter`/`Base Price`/`val_base`), `maxFossilCapacity`.

## 2. מצב נוכחי
- **4.10.2026 ו-10.10.2026:** הוסרו מהקוד הניתוחים sensitivity ו-stochastic וכל שרידיהם (הקובץ `stochastic analysis.gs` נמחק). הפרויקט: 11 קבצים, 3,102 שורות. הקוד ב-`NZO_removed_code.md`. בדיקת עשן אחרי הניקיון: Predict Year ו-Calculate Scenarios and Costs עברו ללא שגיאות.
- כל 7 הבאגים שנמצאו תוקנו ונשמרו, והיסטוריית השינויים המלאה נמצאת ב-`NZO_archive.md` (לא בפרויקט).
- לא נבדק על הגיליון: הגבלת הזמן בניתוח הסטוכסטי, שאלה יחידה ב-sensitivity, חידוש סריקת scenarios, וכתיבת שורת כותרות ב-`90_run-history`.
- פתוח: שאלות המודל שבסעיף "הנחות מידול שכדאי לאשר", איחוד פורמט ב-`40_year-summary`, ושתי שורות לא בשימוש ב-`40_stochastic-analysis-input`.
- פתוח בגליון: `312!B77:B79` מצביעים על 2024/2034/2044 במקום 2020/2030/2040; `310!A111` (FILTER) מחזיר #REF! (קיים מראש). `312!B80` תוקן ל-`='10_demand-yearly'!H47`.
- LB/UB בניתוח הסטוכסטי: "LB" בגיליון הוא העלייה המרבית ו-"UB" הירידה המרבית (r בין `1 - UB` ל-`1 + LB`).
- `40_year-summary`: שורה 1 "output results", שורה 2 ריקה, והנתונים מתחילים בשורה 3.
