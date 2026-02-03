// Central configuration for WinCon
/**
 * Hard cutoff date - no data after this date is used.
 * This ensures consistent data for historical analysis.
 * Set to end of August 2025 to capture VCT 2025 season rosters.
 */
export const CUTOFF_DATE_UTC = new Date('2025-08-31T23:59:59Z');
/**
 * Default roster window in days.
 * When determining current roster, look at matches within this many days.
 */
export const ROSTER_WINDOW_DAYS = 365;
/**
 * Minimum matches required to consider a player on the roster.
 * Players must appear in at least this many matches within the window.
 */
export const MIN_MATCHES_FOR_ROSTER = 1;
/**
 * Cache TTLs (in seconds)
 */
export const CACHE_TTL = {
    TEAM_SEARCH: 60 * 5, // 5 min
    PLAYER_SEARCH: 60 * 5, // 5 min
    TEAM_ROSTER: 60 * 60 * 6, // 6 hours
    MATCH: 60 * 30, // 30 min
    ROSTER_INFERRED: 60 * 60 * 6, // 6 hours (inferred rosters are stable)
};
/**
 * Check if a date is before the cutoff.
 */
export function isBeforeCutoff(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d < CUTOFF_DATE_UTC;
}
/**
 * Get the effective date for queries (never after cutoff).
 */
export function getEffectiveDate(date) {
    const now = date ?? new Date();
    return now < CUTOFF_DATE_UTC ? now : new Date(CUTOFF_DATE_UTC.getTime() - 1);
}
/** Demo mode - runs offline using pre-cached data */
export function isDemoMode() {
    return process.env.WINCON_MODE === 'demo';
}
/** App root directory (for packaged distribution) */
export function getAppRoot() {
    return process.env.WINCON_APP_ROOT || process.cwd();
}
