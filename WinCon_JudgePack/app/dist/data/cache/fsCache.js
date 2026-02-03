import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDemoMode, getAppRoot } from '../../config.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_VERSION = 1;
function getCacheDir() {
    if (isDemoMode()) {
        return join(getAppRoot(), 'data', 'cache', 'demo');
    }
    return join(__dirname, '../../../data/cache');
}
function ensureDir() {
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }
}
export function readCache(key, allowExpired = false) {
    ensureDir();
    const cacheDir = getCacheDir();
    const file = join(cacheDir, `${key}.json`);
    if (!existsSync(file))
        return null;
    try {
        const raw = readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION) {
            if (!isDemoMode())
                rmSync(file, { force: true });
            return null;
        }
        if (!allowExpired && Date.now() > parsed.expiresAt) {
            if (!isDemoMode())
                rmSync(file, { force: true });
            return null;
        }
        return parsed.data;
    }
    catch (err) {
        if (!isDemoMode())
            rmSync(file, { force: true });
        return null;
    }
}
export function writeCache(key, data, ttlSeconds) {
    if (isDemoMode())
        return; // No-op in demo mode
    ensureDir();
    const cacheDir = getCacheDir();
    const file = join(cacheDir, `${key}.json`);
    const envelope = {
        version: CACHE_VERSION,
        expiresAt: Date.now() + ttlSeconds * 1000,
        data,
    };
    writeFileSync(file, JSON.stringify(envelope, null, 2), 'utf-8');
}
export function clearCacheKey(key) {
    if (isDemoMode())
        return; // No-op in demo mode
    ensureDir();
    const cacheDir = getCacheDir();
    const file = join(cacheDir, `${key}.json`);
    if (existsSync(file)) {
        rmSync(file, { force: true });
    }
}
export function clearAllCacheFiles() {
    if (isDemoMode())
        return; // No-op in demo mode
    ensureDir();
    const cacheDir = getCacheDir();
    const files = readdirSync(cacheDir);
    for (const file of files) {
        if (file.endsWith('.json')) {
            rmSync(join(cacheDir, file), { force: true });
        }
    }
}
/**
 * List all cached items matching a prefix (e.g., 'player-' for all players).
 * Returns the data from each matching cache file.
 * @param prefix - The prefix to match (e.g., 'player-')
 * @param excludePattern - Optional regex pattern to exclude certain files
 */
export function listCachedByPrefix(prefix, excludePattern) {
    ensureDir();
    const cacheDir = getCacheDir();
    const files = readdirSync(cacheDir);
    const results = [];
    for (const file of files) {
        if (file.startsWith(prefix) && file.endsWith('.json')) {
            // Skip files matching the exclude pattern
            if (excludePattern && excludePattern.test(file)) {
                continue;
            }
            const key = file.replace('.json', '');
            const data = readCache(key, true); // Allow expired
            if (data) {
                results.push(data);
            }
        }
    }
    return results;
}
