import { VCT_TEAMS, getVctTeamsByRegion, findVctTeam, type VctRegion, type VctTeam } from './api/gridClient.js';
import type { Team, Player, Match } from './models/index.js';
export { VCT_TEAMS, getVctTeamsByRegion, findVctTeam, type VctRegion, type VctTeam };
export { CUTOFF_DATE_UTC } from '../config.js';
/**
 * Get roster metadata for a team (shows when roster was last updated).
 */
export declare function getRosterMetadata(teamId: string): Promise<{
    asOfDate: string;
    matchesAnalyzed: number;
} | null>;
/**
 * Get teams by VCT region (instant, no API call).
 * Returns hardcoded team list for browsing.
 */
export declare function getTeamsByVctRegion(region: VctRegion): VctTeam[];
export type CompetitiveRegion = 'NA' | 'LATAM';
export declare function getTeamsByCompetitiveRegion(region: CompetitiveRegion): VctTeam[];
/**
 * Get all VCT regions.
 */
export declare function getVctRegions(): VctRegion[];
/**
 * Search GRID for a team by name and get its current roster.
 * Called when user selects a team from the list.
 *
 * Roster is inferred from match participation data since GRID API
 * doesn't support filtering players by team directly.
 */
export declare function fetchTeamFromGrid(teamName: string): Promise<Team | undefined>;
/**
 * Get team by ID (fetches roster from match participation).
 *
 * Roster is inferred from match participation data since GRID API
 * doesn't support filtering players by team directly.
 */
export declare function getTeamById(teamId: string): Promise<Team | undefined>;
/**
 * Search for a team by name (for /team command).
 */
export declare function searchTeamByName(name: string): Promise<Team | undefined>;
/**
 * Search for a player by name (for /player command).
 * Uses match history to determine team as of cutoff date.
 */
export declare function searchPlayerByName(name: string): Promise<Player | undefined>;
/**
 * Search players by partial name (for player finder screen).
 * Returns players with their team as of the cutoff date.
 */
export declare function searchPlayers(query: string): Promise<Player[]>;
/**
 * Get player by ID (from cache).
 */
export declare function getPlayerById(playerId: string): Promise<Player | undefined>;
export declare function getMatchById(matchId: string): Promise<Match | undefined>;
export declare function getTeamMatches(teamId: string, limit?: number): Promise<Match[]>;
export declare function getPlayerMatches(playerId: string): Promise<Match[]>;
/**
 * Clear all cached data.
 */
export declare function clearAllCaches(): void;
export { type Team, type Player, type Match, type Region } from './models/index.js';
