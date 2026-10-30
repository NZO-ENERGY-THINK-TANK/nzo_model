# NZO Model

מודל לתכנון משק החשמל בישראל עד 2050: נתח אנרגיה נקייה, גז נדרש ועלות כוללת (NPV). ממומש כגיליון Google Sheets עם פרויקט Apps Script.

> **סטטוס:** שלד. המבנה מוכן, והתוכן (קוד, נתונים, תרחיש ייחוס) יועבר בשלבים 3–5 של תוכנית המימוש (`docs/NZO_collaboration_design.md`).

## קישורים

| מה | קישור |
|---|---|
| תיקיית Google Drive (גליון המאסטר) | https://drive.google.com/drive/folders/1M1PJZQZEi3Pe3Ft-BUBu12FP52pNOw_k |
| פרויקט Apps Script (יעד `clasp push`) | https://script.google.com/home/projects/108jUS5eOI2F3Gl0KfffnqaTiY6hyluz-RWXs9qqJjsiPbuvboAa2baOA/edit |
| ריפו GitHub | https://github.com/NZO-ENERGY-THINK-TANK/nzo_model |

הקוד נערך בריפו ונדחף לגליון עם `clasp push` מתוך `src/`. לא עורכים קוד ישירות בעורך של Apps Script.

## מבנה

| תיקייה | תוכן |
|---|---|
| `src/` | קוד Apps Script (בהמשך: `clasp clone`) |
| `data/` | נתוני בסיס בקבצי CSV (`13_tech-params`, `03_future-yearly-demand`, `12_raw-data-hourly`) |
| `reference/` | תרחיש ייחוס ותוצאותיו הצפויות |
| `charts/` | קטלוג תבניות גרפים |
| `docs/` | תיעוד: מסמך העיצוב, `NZO_core.md`, `NZO_archive.md`, `NZO_removed_code.md` |
| `.github/` | Issue and pull request templates |

## עקרונות עבודה

- **קוד ונתוני בסיס משתנים רק דרך Pull Request.** קבצי `data/` הם מקור האמת להנחות. הגליון המאסטר נגזר מהם.
- **תוצאות לא נשמרות בריפו.** הן נשארות בעותק האישי של כל חוקר.
- **הצעת שינוי בהנחה:** פותחים Issue לפי התבנית `assumption-change`.
- לא מוסיפים שורות או עמודות ללשוניות קיימות ולא משנים שמות לשוניות (הקוד והפיבוטים מפנים אליהן).

## הרשאות ואכיפה

עדיין לא הוגדרו (branch protection, CODEOWNERS, הרשאות Drive). ראו שלב 7 בתוכנית.
