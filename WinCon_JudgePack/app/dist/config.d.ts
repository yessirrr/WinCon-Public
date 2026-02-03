/**
 * Hard cutoff date - no data after this date is used.
 * This ensures consistent data for historical analysis.
 * Set to end of August 2025 to capture VCT 2025 season rosters.
 */
export declare const CUTOFF_DATE_UTC: Date;
/**
 * Default roster window in days.
 * When determining current roster, look at matches within this many days.
 */
export declare const ROSTER_WINDOW_DAYS = 365;
/**
 * Minimum matches required to consider a player on the roster.
 * Players must appear in at least this many matches within the window.
 */
export declare const MIN_MATCHES_FOR_ROSTER = 1;
/**
 * Cache TTLs (in seconds)
 */
export declare const CACHE_TTL: {
    readonly TEAM_SEARCH: number;
    readonly PLAYER_SEARCH: number;
    readonly TEAM_ROSTER: number;
    readonly MATCH: number;
    readonly ROSTER_INFERRED: number;
};
/**
 * Check if a date is before the cutoff.
 */
export declare function isBeforeCutoff(date: Date | string): boolean;
/**
 * Get the effective date for queries (never after cutoff).
 */
export declare function getEffectiveDate(date?: Date): Date;
/** Demo mode - runs offline using pre-cached data */
export declare function isDemoMode(): boolean;
/** App root directory (for packaged distribution) */
export declare function getAppRoot(): string;
