/**
 * Project-wide configuration.
 * MASTER_SPREADSHEET_ID: the master sheet that researcher copies sync from (Sync from master, step 10).
 * Not a secret: access is controlled by Drive permissions (researchers are viewers only).
 */
const MASTER_SPREADSHEET_ID = '1Jt5JOLmbDQKUwqXYmxYCN9RaK641yBoiplJZKN8O_xY';

/**
 * Effective full-load hours per year of 1 MW of new capacity in Israel (physical assumptions, shared by Predict Year and scenario runs).
 * The reference-year (2023) capacity is derived from them: capacity = annual generation in 12_raw-data-hourly / hours.
 * A change here changes every result, so it goes through a PR and a reference-test re-record.
 */
const SOLAR_EFFECTIVE_HOURS_PER_YEAR = 1700;
const WIND_EFFECTIVE_HOURS_PER_YEAR = 2930;
