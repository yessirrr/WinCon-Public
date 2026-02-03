export declare function readCache<T>(key: string, allowExpired?: boolean): T | null;
export declare function writeCache<T>(key: string, data: T, ttlSeconds: number): void;
export declare function clearCacheKey(key: string): void;
export declare function clearAllCacheFiles(): void;
/**
 * List all cached items matching a prefix (e.g., 'player-' for all players).
 * Returns the data from each matching cache file.
 * @param prefix - The prefix to match (e.g., 'player-')
 * @param excludePattern - Optional regex pattern to exclude certain files
 */
export declare function listCachedByPrefix<T>(prefix: string, excludePattern?: RegExp): T[];
