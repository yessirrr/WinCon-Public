import { isApiConfigured, queryGrid, queryGridState, QUERIES, VCT_TEAMS, getVctTeamsByRegion, findVctTeam, vctRegionToRegion, type VctRegion, type VctTeam } from './api/gridClient.js';
import { readCache, writeCache, clearAllCacheFiles, listCachedByPrefix } from './cache/fsCache.js';
import { CUTOFF_DATE_UTC, ROSTER_WINDOW_DAYS, CACHE_TTL, isBeforeCutoff } from '../config.js';
import type {
  Team,
  Player,
  Match,
  Region,
  PlayerRole,
  EquipmentType,
  AgentRole,
  MapResult,
  MapTeamStats,
  Round,
  RoundPlayerStats,
  RoundPlayerEconomy,
  PlayerStats,
} from './models/index.js';

const GRID_VERBOSE = process.env.GRID_VERBOSE === '1';

// Cache TTLs (using centralized config)
const TEAM_SEARCH_TTL = CACHE_TTL.TEAM_SEARCH;
const PLAYER_SEARCH_TTL = CACHE_TTL.PLAYER_SEARCH;
const TEAM_ROSTER_TTL = CACHE_TTL.TEAM_ROSTER;
const MATCH_CACHE_TTL = CACHE_TTL.MATCH;

// Cache key prefixes
const SERIES_CACHE_PREFIX = 'series-v2-';
const TEAM_MATCH_CACHE_PREFIX = 'team-matches-v3-';
const VALORANT_TITLE_ID = '6';

// Re-export VCT types and functions for screens
export { VCT_TEAMS, getVctTeamsByRegion, findVctTeam, type VctRegion, type VctTeam };

// Re-export cutoff date for UI
export { CUTOFF_DATE_UTC } from '../config.js';

/**
 * Get roster metadata for a team (shows when roster was last updated).
 */
export async function getRosterMetadata(teamId: string): Promise<{ asOfDate: string; matchesAnalyzed: number } | null> {
  const cacheKey = `roster-inferred-${teamId}`;
  const cached = readCache<InferredRoster>(cacheKey);
  if (cached) {
    return {
      asOfDate: cached.asOfDate,
      matchesAnalyzed: cached.matchesAnalyzed,
    };
  }
  return null;
}

// ---------- Roster Inference Types ----------

interface PlayerParticipation {
  playerId: string;
  nickname: string;
  teamId: string;
  matchCount: number;
  lastMatchDate: string;
  agents: Map<string, number>; // agent name -> times played
}

interface InferredRoster {
  teamId: string;
  teamName: string;
  players: Player[];
  asOfDate: string; // Latest match date used for roster
  matchesAnalyzed: number;
}

// ---------- Public API: Hardcoded Team Browsing ----------

/**
 * Get teams by VCT region (instant, no API call).
 * Returns hardcoded team list for browsing.
 */
export function getTeamsByVctRegion(region: VctRegion): VctTeam[] {
  return getVctTeamsByRegion(region);
}

export type CompetitiveRegion = 'NA' | 'LATAM';

const NA_AMERICAS_TEAM_SHORT_NAMES = new Set(['100T', 'C9', 'EG', 'NRG', 'SEN', 'G2']);

export function getTeamsByCompetitiveRegion(region: CompetitiveRegion): VctTeam[] {
  const americasTeams = getVctTeamsByRegion('Americas');
  if (region === 'NA') {
    return americasTeams.filter((team) => NA_AMERICAS_TEAM_SHORT_NAMES.has(team.shortName));
  }
  return americasTeams.filter((team) => !NA_AMERICAS_TEAM_SHORT_NAMES.has(team.shortName));
}

/**
 * Get all VCT regions.
 */
export function getVctRegions(): VctRegion[] {
  return ['Americas', 'EMEA', 'Pacific', 'China'];
}

function normalizeTeamLookupValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function teamNamesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeTeamLookupValue(left);
  const normalizedRight = normalizeTeamLookupValue(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function resolveRegionFromVctTeam(vctTeam?: VctTeam): Region {
  if (!vctTeam) return 'NA';
  if (vctTeam.region !== 'Americas') {
    return vctRegionToRegion(vctTeam.region);
  }
  return NA_AMERICAS_TEAM_SHORT_NAMES.has(vctTeam.shortName) ? 'NA' : 'LATAM';
}

function normalizeDisplayTeamName(name: string): string {
  return name.replace(/\s+\(\d+\)\s*$/, '').trim();
}

function normalizeTeamModel(team: Team): Team {
  return {
    ...team,
    name: normalizeDisplayTeamName(team.name),
    shortName: normalizeDisplayTeamName(team.shortName),
    players: team.players.map(player => ({
      ...player,
      teamName: normalizeDisplayTeamName(player.teamName),
    })),
  };
}

// ---------- Series State API Types ----------

interface SeriesStateResponse {
  seriesState: {
    id: string;
    teams: Array<{
      id: string;
      name: string;
      score: number;
      won: boolean;
      players: Array<{
        id: string;
        name: string;
        participationStatus: string;
      }>;
    }>;
    games?: Array<{
      id: string;
      sequenceNumber: number;
      map?: { name: string } | null;
      teams: Array<{
        id: string;
        name: string;
        score?: number | null;
        won?: boolean | null;
        players?: Array<{
          id: string;
          name: string;
          character?: { name: string } | null;
          kills?: number | null;
          deaths?: number | null;
          killAssistsGiven?: number | null;
        }> | null;
      }>;
      segments?: Array<{
        id: string;
        sequenceNumber?: number | null;
        duration?: string | null;
        objectives?: Array<{
          type?: string | null;
          completionCount?: { sum?: number | null } | null;
        }> | null;
        teams?: Array<{
          id: string;
          side?: string | null;
          won?: boolean | null;
          kills?: number | null;
          deaths?: number | null;
          objectives?: Array<{
            type?: string | null;
            completionCount?: { sum?: number | null } | null;
          }> | null;
          players?: Array<{
            id: string;
            name: string;
            kills?: number | null;
            deaths?: number | null;
            killAssistsGiven?: number | null;
            economy?: {
              money?: number | null;
              loadoutValue?: number | null;
              netWorth?: number | null;
              totalMoneyEarned?: number | null;
            } | null;
          }> | null;
        }> | null;
      }> | null;
    }> | null;
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function isSchemaFieldError(message: string): boolean {
  return /FieldUndefined|Cannot query field/i.test(message);
}

async function fetchSeriesState(seriesId: string): Promise<SeriesStateResponse> {
  try {
    return await queryGridState<SeriesStateResponse>(QUERIES.getSeriesState, { id: seriesId });
  } catch (error) {
    const message = getErrorMessage(error);
    if (isSchemaFieldError(message)) {
      if (GRID_VERBOSE) {
        console.log(`[GRID] seriesState ${seriesId}: retrying without economy fields`);
      }
      try {
        return await queryGridState<SeriesStateResponse>(QUERIES.getSeriesStateBase, { id: seriesId });
      } catch (fallbackError) {
        const fallbackMessage = getErrorMessage(fallbackError);
        if (isSchemaFieldError(fallbackMessage)) {
          if (GRID_VERBOSE) {
            console.log(`[GRID] seriesState ${seriesId}: retrying without objectives`);
          }
          return await queryGridState<SeriesStateResponse>(QUERIES.getSeriesStateBaseNoObjectives, { id: seriesId });
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}


// ---------- Roster Inference from Series State API ----------

/**
 * Fetch series state and extract player roster.
 * Uses the Series State API which provides player participation data directly.
 */
async function fetchSeriesStateRoster(
  seriesId: string,
  targetTeamId: string
): Promise<{ players: Array<{ id: string; name: string; agent?: string }>; date: string } | null> {
  try {
    const response = await fetchSeriesState(seriesId);

    if (!response?.seriesState) {
      return null;
    }

    const series = response.seriesState;
    const seriesDate = ''; // startedAt removed for compatibility

    // Check cutoff date
    // if (seriesDate && !isBeforeCutoff(seriesDate)) {
    //   return null;
    // }

    // Find the target team in the series
    const team = series.teams.find(t => t.id === targetTeamId);
    if (!team || !team.players) {
      return null;
    }

    // Get players from the team - these are players who participated in the series
    const players: Array<{ id: string; name: string; agent?: string }> = team.players
      .filter(p => p.participationStatus === 'active')
      .map(p => ({
        id: p.id,
        name: p.name,
      }));

    // Also check games for character/agent info
    if (series.games) {
      for (const game of series.games) {
        const gameTeam = game.teams.find(t => t.id === targetTeamId);
        if (gameTeam?.players) {
          for (const gp of gameTeam.players) {
            const existing = players.find(p => p.id === gp.id);
            if (existing && gp.character?.name && !existing.agent) {
              (existing as { id: string; name: string; agent?: string }).agent = gp.character.name;
            }
          }
        }
      }
    }

    return { players, date: seriesDate };
  } catch (error) {
    console.error(`Failed to fetch series state ${seriesId}:`, error);
    return null;
  }
}

/**
 * Build roster from multiple series using Series State API.
 */
async function buildRosterFromSeriesStates(
  teamId: string,
  teamName: string,
  seriesIds: SeriesIdInfo[],
  region: Region
): Promise<InferredRoster> {
  // Limit how many series we hit to avoid GRID rate limits
  const LIMITED_SERIES = seriesIds.slice(0, 3);

  // Roster window cutoff (e.g. last 90 days)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - ROSTER_WINDOW_DAYS);

  const participation = new Map<string, PlayerParticipation>();
  let latestDate = '';
  let seriesAnalyzed = 0;

  for (const seriesInfo of LIMITED_SERIES) {
    // Use startTime from series metadata (Series State API doesn't return dates)
    const seriesDate = seriesInfo.startTime || '';

    // Skip series outside roster window
    if (seriesDate && new Date(seriesDate) < windowStart) continue;

    const result = await fetchSeriesStateRoster(seriesInfo.id, teamId);
    if (!result) continue;

    seriesAnalyzed++;

    // Track latest date from series metadata
    if (seriesDate && seriesDate > latestDate) {
      latestDate = seriesDate;
    }

    for (const player of result.players) {
      const existing = participation.get(player.id);
      if (existing) {
        existing.matchCount++;
        if (seriesDate > existing.lastMatchDate) {
          existing.lastMatchDate = seriesDate;
        }
        if (player.agent) {
          const count = existing.agents.get(player.agent) ?? 0;
          existing.agents.set(player.agent, count + 1);
        }
      } else {
        const agents = new Map<string, number>();
        if (player.agent) {
          agents.set(player.agent, 1);
        }
        participation.set(player.id, {
          playerId: player.id,
          nickname: player.name,
          teamId,
          matchCount: 1,
          lastMatchDate: seriesDate,
          agents,
        });
      }
    }
  }

  // Convert participation to players, sorted by most recent appearance
  const players: Player[] = Array.from(participation.values())
    // Most recent first, then by match count
    .sort((a, b) => {
      const dateDiff = b.lastMatchDate.localeCompare(a.lastMatchDate);
      if (dateDiff !== 0) return dateDiff;
      return b.matchCount - a.matchCount;
    })
    .slice(0, 5) // VALORANT active roster size
    .map(p => {
      // Determine most played agent for role inference
      let mostPlayedAgent = '';
      let maxPlays = 0;
      for (const [agent, count] of p.agents) {
        if (count > maxPlays) {
          mostPlayedAgent = agent;
          maxPlays = count;
        }
      }

      return {
        id: p.playerId,
        name: p.nickname || `Player-${p.playerId.slice(-6)}`,
        teamId,
        teamName,
        region,
        role: inferRoleFromAgent(mostPlayedAgent),
      };
    });

  return {
    teamId,
    teamName,
    players,
    asOfDate: latestDate || '',
    matchesAnalyzed: seriesAnalyzed,
  };
}

/**
 * Infer player role from their most played agent.
 * Handles various naming conventions from GRID API (e.g., 'kay/o' vs 'kayo').
 */
function inferRoleFromAgent(agentName: string): PlayerRole | undefined {
  // Normalize: lowercase and remove special characters (kay/o -> kayo)
  const agent = agentName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Duelists
  if (['jett', 'raze', 'phoenix', 'reyna', 'yoru', 'neon', 'iso', 'waylay'].includes(agent)) {
    return 'duelist';
  }
  // Initiators
  if (['sova', 'breach', 'skye', 'kayo', 'fade', 'gekko', 'tejo'].includes(agent)) {
    return 'initiator';
  }
  // Controllers
  if (['brimstone', 'omen', 'viper', 'astra', 'harbor', 'clove'].includes(agent)) {
    return 'controller';
  }
  // Sentinels
  if (['sage', 'cypher', 'killjoy', 'chamber', 'deadlock', 'vyse'].includes(agent)) {
    return 'sentinel';
  }

  return undefined;
}

/**
 * Get team roster by fetching from Series State API.
 * Uses actual match participation data from GRID.
 */
async function getTeamRosterFromParticipation(
  teamId: string,
  teamName: string,
  region: Region
): Promise<InferredRoster> {
  const cacheKey = `roster-inferred-${teamId}`;
  const cached = readCache<InferredRoster>(cacheKey, true); // Allow expired in demo mode
  if (cached) return cached;

  // In demo mode or without API, return empty roster on cache miss
  if (!isApiConfigured()) {
    return { teamId, teamName, players: [], asOfDate: '', matchesAnalyzed: 0 };
  }

  // Fetch recent series IDs for this team
  const seriesIds = await fetchRecentSeriesIdsForTeam(teamId, 8);

  // Build roster from series state data
  const roster = await buildRosterFromSeriesStates(teamId, teamName, seriesIds, region);

  // If no players found, try to return a stale (expired) roster if present
  if (roster.players.length === 0) {
    const stale = readCache<InferredRoster>(cacheKey, true);
    if (stale) return stale;
  }

  // Enrich roles via player search API if agent inference didn't provide roles
  await enrichRolesFromPlayerSearch(roster.players);

  if (roster.players.length > 0) {
    writeCache(cacheKey, roster, CACHE_TTL.ROSTER_INFERRED);
  }

  return roster;
}

/**
 * Enrich roster with roles by searching each player by name.
 * Fallback when agent inference doesn't provide roles.
 * Note: GRID API often returns empty roles (e.g., for Ethan on NRG),
 * so agent-based role inference is the primary method.
 */
async function enrichRolesFromPlayerSearch(players: Player[]): Promise<void> {
  // Skip in demo mode - no API calls allowed
  if (!isApiConfigured()) return;

  const needsRole = players.some(p => !p.role);
  if (!needsRole) return;

  for (const p of players) {
    if (p.role) continue;
    try {
      const result = await queryGrid<SearchPlayersResponse>(QUERIES.searchPlayers, {
        name: p.name,
        first: 5,
      });
      const edges = result?.players?.edges ?? [];
      // Prefer exact nickname match, fall back to first result
      const match = edges.find(e => e.node.nickname.toLowerCase() === p.name.toLowerCase()) ?? edges[0];
      const role = normalizePlayerRole(match?.node.roles?.[0]?.name);
      if (role) {
        p.role = role;
      }
    } catch {
      // Ignore per-player failures - role remains undefined
    }
  }
}

// ---------- Public API: GRID API Fetching (on-demand) ----------

/**
 * Search GRID for a team by name and get its current roster.
 * Called when user selects a team from the list.
 *
 * Roster is inferred from match participation data since GRID API
 * doesn't support filtering players by team directly.
 */
export async function fetchTeamFromGrid(teamName: string): Promise<Team | undefined> {
  const requestedVctTeam = findVctTeam(teamName);
  if (!requestedVctTeam || requestedVctTeam.region !== 'Americas') {
    return undefined;
  }

  // Check cache first (required for demo mode)
  const cacheKey = `team-grid-v3-${normalizeTeamLookupValue(teamName)}`;
  const cached = readCache<Team>(cacheKey, true); // Allow expired in demo mode
  if (cached && (teamNamesMatch(cached.name, teamName) || teamNamesMatch(cached.shortName, teamName))) {
    return normalizeTeamModel(cached);
  }

  // In demo mode or without API, return undefined on cache miss
  if (!isApiConfigured()) {
    return undefined;
  }

  // Step 1: Search GRID for this team
  const teamResult = await queryGrid<SearchTeamsResponse>(QUERIES.searchTeams, {
    name: teamName,
    first: 10,
    titleId: VALORANT_TITLE_ID,
  });
  const teamEdges = (teamResult?.teams?.edges ?? []).filter(edge => edge.node.title?.id === VALORANT_TITLE_ID);

  if (teamEdges.length === 0) return undefined;

  const matchingCandidates = teamEdges.filter(edge => {
    const candidateTeam =
      findVctTeam(edge.node.name) ??
      (edge.node.nameShortened ? findVctTeam(edge.node.nameShortened) : undefined);
    return !!candidateTeam && teamNamesMatch(candidateTeam.name, requestedVctTeam.name);
  });
  const candidateEdges = matchingCandidates.length > 0 ? matchingCandidates : teamEdges;

  // Find best match
  const normalizedSearchName = normalizeTeamLookupValue(teamName);
  let teamNode = candidateEdges[0].node;

  // Prefer an edge that matches the official team name/short name
  const preferred = candidateEdges.find(e =>
    teamNamesMatch(e.node.name, requestedVctTeam.name) ||
    (e.node.nameShortened ? teamNamesMatch(e.node.nameShortened, requestedVctTeam.shortName) : false)
  );
  if (preferred) {
    teamNode = preferred.node;
  }

  const scoredMatches = candidateEdges
    .map(edge => {
      const nameNormalized = normalizeTeamLookupValue(edge.node.name);
      const shortNormalized = normalizeTeamLookupValue(edge.node.nameShortened ?? '');
      let score = 0;
      if (nameNormalized === normalizedSearchName) score += 100;
      if (shortNormalized === normalizedSearchName) score += 95;
      if (nameNormalized.includes(normalizedSearchName)) score += 35;
      if (shortNormalized.includes(normalizedSearchName)) score += 30;

      if (teamNamesMatch(edge.node.name, requestedVctTeam.name)) score += 120;
      if (edge.node.nameShortened && teamNamesMatch(edge.node.nameShortened, requestedVctTeam.shortName)) score += 110;

      return { node: edge.node, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredMatches[0]?.score > 0) {
    const topScore = scoredMatches[0].score;
    const topMatches = scoredMatches.filter(match => match.score === topScore).slice(0, 3);
    if (topMatches.length > 1) {
      const candidates = await Promise.all(topMatches.map(async candidate => {
        try {
          const recentSeries = await fetchRecentSeriesIdsForTeam(candidate.node.id, 1);
          return {
            node: candidate.node,
            score: candidate.score,
            seriesCount: recentSeries.length,
            latestStart: recentSeries[0]?.startTime ?? '',
          };
        } catch {
          return {
            node: candidate.node,
            score: candidate.score,
            seriesCount: 0,
            latestStart: '',
          };
        }
      }));

      candidates.sort((a, b) =>
        b.seriesCount - a.seriesCount ||
        b.latestStart.localeCompare(a.latestStart)
      );
      teamNode = candidates[0].node;
    } else {
      teamNode = scoredMatches[0].node;
    }
  }

  // Confirm selected node maps back to an Americas VCT team
  const resolvedVctTeam =
    findVctTeam(teamNode.name) ??
    (teamNode.nameShortened ? findVctTeam(teamNode.nameShortened) : undefined) ??
    requestedVctTeam;
  if (!resolvedVctTeam || resolvedVctTeam.region !== 'Americas') {
    return undefined;
  }
  const region = resolveRegionFromVctTeam(resolvedVctTeam);

  // Step 2: Infer roster from match participation
  const normalizedDisplayName = normalizeDisplayTeamName(teamNode.name);
  const inferredRoster = await getTeamRosterFromParticipation(
    teamNode.id,
    normalizedDisplayName,
    region
  );

  const team: Team = {
    id: teamNode.id,
    name: normalizedDisplayName,
    shortName: normalizeDisplayTeamName(teamNode.nameShortened ?? teamNode.name),
    region,
    players: inferredRoster.players,
  };

  writeCache(cacheKey, team, TEAM_ROSTER_TTL);
  // Cache players for later lookup (use same TTL as roster since they're part of it)
  for (const player of inferredRoster.players) {
    writeCache(`player-${player.id}`, player, TEAM_ROSTER_TTL);
  }

  return team;
}

/**
 * Get team by ID (fetches roster from match participation).
 *
 * Roster is inferred from match participation data since GRID API
 * doesn't support filtering players by team directly.
 */
export async function getTeamById(teamId: string): Promise<Team | undefined> {
  // Check cache first (required for demo mode)
  const cacheKey = `team-roster-${teamId}`;
  const cached = readCache<Team>(cacheKey, true); // Allow expired in demo mode
  if (cached) return normalizeTeamModel(cached);

  // In demo mode or without API, return undefined on cache miss
  if (!isApiConfigured()) {
    return undefined;
  }

  // Step 1: Get team basic info
  const teamResult = await queryGrid<GetTeamResponse>(QUERIES.getTeam, { id: teamId });
  if (!teamResult?.team) return undefined;

  const teamNode = teamResult.team;

  // Get VCT team info for region
  const vctTeam = findVctTeam(teamNode.name);
  if (!vctTeam || vctTeam.region !== 'Americas') {
    return undefined;
  }
  const region = resolveRegionFromVctTeam(vctTeam);

  // Step 2: Infer roster from match participation
  const normalizedTeamName = normalizeDisplayTeamName(teamNode.name);
  const inferredRoster = await getTeamRosterFromParticipation(
    teamId,
    normalizedTeamName,
    region
  );

  const team: Team = {
    id: teamNode.id,
    name: normalizedTeamName,
    shortName: normalizeDisplayTeamName(teamNode.nameShortened ?? teamNode.name),
    region,
    players: inferredRoster.players,
  };

  writeCache(cacheKey, team, TEAM_ROSTER_TTL);
  // Cache players for later lookup (use same TTL as roster since they're part of it)
  for (const player of inferredRoster.players) {
    writeCache(`player-${player.id}`, player, TEAM_ROSTER_TTL);
  }

  return team;
}

/**
 * Search for a team by name (for /team command).
 */
export async function searchTeamByName(name: string): Promise<Team | undefined> {
  // First check if it's a known VCT team
  const vctTeam = findVctTeam(name);
  if (vctTeam) {
    return fetchTeamFromGrid(vctTeam.name);
  }
  // Otherwise search GRID directly
  return fetchTeamFromGrid(name);
}

/**
 * Search for a player by name (for /player command).
 * Uses match history to determine team as of cutoff date.
 */
export async function searchPlayerByName(name: string): Promise<Player | undefined> {
  // Check search-specific cache first
  const cacheKey = `player-search-${name.toLowerCase().replace(/\s+/g, '-')}`;
  const cached = readCache<Player>(cacheKey, true); // Allow expired
  if (cached) return cached;

  // Check individual player cache files (pre-populated for offline use)
  // Exclude player-search-* files to avoid duplicates
  const allCachedPlayers = listCachedByPrefix<Player>('player-', /^player-search-/);
  if (allCachedPlayers.length > 0) {
    const lowerName = name.toLowerCase();
    // Try exact match first, then partial
    const exactMatch = allCachedPlayers.find(p => p.name.toLowerCase() === lowerName);
    if (exactMatch) return exactMatch;
    const partialMatch = allCachedPlayers.find(p => p.name.toLowerCase().includes(lowerName));
    if (partialMatch) return partialMatch;
  }

  // No cached results - try API if configured
  if (!isApiConfigured()) {
    return undefined;
  }

  // Search GRID API for player
  const result = await queryGrid<SearchPlayersResponse>(QUERIES.searchPlayers, { name, first: 20 });
  const edges = result?.players?.edges ?? [];

  if (edges.length === 0) return undefined;

  // Find best match
  const lower = name.toLowerCase();
  const exactMatch = edges.find(e => e.node.nickname.toLowerCase() === lower);
  const node = exactMatch?.node ?? edges[0].node;

  // Get player's team from match history as of cutoff date
  const historicalTeam = await getPlayerTeamAsOfCutoff(node.id, node.nickname);

  const player: Player = {
    id: node.id,
    name: node.nickname,
    teamId: historicalTeam?.teamId ?? node.team?.id ?? '',
    teamName: normalizeDisplayTeamName(historicalTeam?.teamName ?? node.team?.name ?? 'Unknown'),
    region: historicalTeam?.region ?? (node.team ? (findVctTeam(node.team.name) ? vctRegionToRegion(findVctTeam(node.team.name)!.region) : 'NA') : 'NA'),
    role: historicalTeam?.role ?? normalizePlayerRole(node.roles?.[0]?.name),
  };

  writeCache(cacheKey, player, PLAYER_SEARCH_TTL);
  writeCache(`player-${player.id}`, player, PLAYER_SEARCH_TTL);
  return player;
}

/**
 * Get the team a player was on as of the cutoff date.
 * Queries the team's match history and checks for player participation.
 */
async function getPlayerTeamAsOfCutoff(
  playerId: string,
  playerName: string
): Promise<{ teamId: string; teamName: string; region: Region; role?: PlayerRole } | undefined> {
  try {
    // Get the player's current team from GRID
    const playerResult = await queryGrid<SearchPlayersResponse>(QUERIES.searchPlayers, {
      name: playerName,
      first: 5
    });
    const playerNode = playerResult?.players?.edges?.find(
      e => e.node.id === playerId
    )?.node;

    if (!playerNode?.team) return undefined;

    const currentTeamId = playerNode.team.id;
    const currentTeamName = playerNode.team.name;

    // Check if it's a VCT team
    const vctTeam = findVctTeam(currentTeamName);

    // Get the team's recent series
    const seriesData = await queryGrid<{
      allSeries: {
        edges: Array<{
          node: {
            id: string;
            startTimeScheduled?: string | null;
          };
        }>;
      };
    }>(QUERIES.getTeamMatches, { teamId: currentTeamId, first: 5 });

    const seriesEdges = seriesData?.allSeries?.edges ?? [];

    // Find a series before the cutoff date where this player participated
    for (const edge of seriesEdges) {
      const startTime = edge.node.startTimeScheduled;

      // Skip series after cutoff
      if (startTime && !isBeforeCutoff(startTime)) {
        continue;
      }

      // Check if player was on this team in this series
      const stateData = await fetchSeriesState(edge.node.id);

      if (!stateData?.seriesState) continue;

      for (const team of stateData.seriesState.teams) {
        const playerOnTeam = team.players?.some(
          p => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (playerOnTeam) {
          // Found the player on this team in a match before cutoff
          const teamVct = findVctTeam(team.name);
          return {
            teamId: team.id,
            teamName: normalizeDisplayTeamName(team.name),
            region: teamVct ? vctRegionToRegion(teamVct.region) : 'NA',
            role: undefined, // Role will be inferred later from agent data
          };
        }
      }
    }

    // Player wasn't found on current team before cutoff - search VCT teams
    // This handles cases where player transferred after cutoff
    const regionsToSearch: VctRegion[] = vctTeam
      ? [vctTeam.region] // Search same region first
      : ['Americas', 'EMEA', 'Pacific', 'China'];

    for (const region of regionsToSearch) {
      const teamsInRegion = getVctTeamsByRegion(region);

      for (const searchTeam of teamsInRegion) {
        if (searchTeam.name === currentTeamName) continue; // Already checked

        // Get team's series
        const teamSearchResult = await queryGrid<SearchTeamsResponse>(QUERIES.searchTeams, {
          name: searchTeam.name,
          first: 3,
          titleId: VALORANT_TITLE_ID,
        });
        const teamNode = teamSearchResult?.teams?.edges?.[0]?.node;
        if (!teamNode) continue;

        const teamSeriesData = await queryGrid<{
          allSeries: {
            edges: Array<{
              node: {
                id: string;
                startTimeScheduled?: string | null;
              };
            }>;
          };
        }>(QUERIES.getTeamMatches, { teamId: teamNode.id, first: 3 });

        for (const edge of teamSeriesData?.allSeries?.edges ?? []) {
          const startTime = edge.node.startTimeScheduled;
          if (startTime && !isBeforeCutoff(startTime)) continue;

          const stateData = await fetchSeriesState(edge.node.id);

          if (!stateData?.seriesState) continue;

          for (const team of stateData.seriesState.teams) {
            const playerOnTeam = team.players?.some(
              p => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
            );

            if (playerOnTeam) {
              return {
                teamId: team.id,
                teamName: normalizeDisplayTeamName(team.name),
                region: vctRegionToRegion(region),
                role: undefined,
              };
            }
          }
        }
      }

      // Only search one region at a time to avoid too many API calls
      break;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Search players by partial name (for player finder screen).
 * Returns players with their team as of the cutoff date.
 */
export async function searchPlayers(query: string): Promise<Player[]> {
  if (query.length < 2) return [];

  // Check search-specific cache first
  const cacheKey = `players-search-${query.toLowerCase().replace(/\s+/g, '-')}`;
  const cached = readCache<Player[]>(cacheKey, true); // Allow expired
  if (cached) return cached;

  // Always check cached players first (pre-populated for demo/offline use)
  // Exclude player-search-* files to avoid duplicates
  const allCachedPlayers = listCachedByPrefix<Player>('player-', /^player-search-/);
  if (allCachedPlayers.length > 0) {
    const lowerQuery = query.toLowerCase();
    const matches = allCachedPlayers.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.teamName.toLowerCase().includes(lowerQuery)
    );
    if (matches.length > 0) {
      return matches;
    }
  }

  // No cached results - try API if configured
  if (!isApiConfigured()) {
    return [];
  }

  const result = await queryGrid<SearchPlayersResponse>(QUERIES.searchPlayers, { name: query, first: 20 });
  const edges = result?.players?.edges ?? [];

  // Look up historical teams in parallel (limited to first 10 for performance)
  const playersToLookup = edges.slice(0, 10);
  const playerPromises = playersToLookup.map(async (e) => {
    try {
      // Use searchPlayerByName to get historical team
      return await searchPlayerByName(e.node.nickname);
    } catch {
      // Fall back to current team on error
      return mapGridPlayerToPlayer(e.node);
    }
  });

  const resolvedPlayers = await Promise.all(playerPromises);
  const players = resolvedPlayers.filter((p): p is Player => p !== undefined);

  // Add remaining players with current teams (if any beyond first 10)
  if (edges.length > 10) {
    const remaining = edges.slice(10)
      .map(e => mapGridPlayerToPlayer(e.node))
      .filter((p): p is Player => p !== undefined);
    players.push(...remaining);
  }

  // Filter to Americas-only: exclude players whose team is not an Americas VCT team
  const americasPlayers = players.filter(p => {
    const vct = findVctTeam(p.teamName);
    return vct !== undefined && vct.region === 'Americas';
  });

  writeCache(cacheKey, americasPlayers, PLAYER_SEARCH_TTL);
  for (const player of americasPlayers) {
    writeCache(`player-${player.id}`, player, PLAYER_SEARCH_TTL);
  }

  return americasPlayers;
}

/**
 * Get player by ID (from cache).
 */
export async function getPlayerById(playerId: string): Promise<Player | undefined> {
  const cacheKey = `player-${playerId}`;
  return readCache<Player>(cacheKey, true) ?? undefined; // Allow expired in demo mode
}

// ---------- Match Loading (from GRID) ----------

export async function getMatchById(matchId: string): Promise<Match | undefined> {
  // Check cache first (required for demo mode)
  const cacheKey = `${SERIES_CACHE_PREFIX}${matchId}`;
  const cached = readCache<Match>(cacheKey, true); // Allow expired in demo mode
  if (cached) return cached;

  // In demo mode or without API, return undefined on cache miss
  if (!isApiConfigured()) {
    return undefined;
  }

  try {
    return await getSeriesMatch(matchId);
  } catch {
    return undefined;
  }
}

export async function getTeamMatches(teamId: string, limit = 8): Promise<Match[]> {
  // Check cache first - try exact match, then fallback to other limits
  const cacheKey = `${TEAM_MATCH_CACHE_PREFIX}${teamId}-${limit}`;
  const cached = readCache<Match[]>(cacheKey, true); // Allow expired
  if (cached) return cached;

  // Try alternate limit (5 or 8) for pre-populated cache
  const altLimit = limit === 8 ? 5 : 8;
  const altCacheKey = `${TEAM_MATCH_CACHE_PREFIX}${teamId}-${altLimit}`;
  const altCached = readCache<Match[]>(altCacheKey, true);
  if (altCached) return altCached;

  // No cached results - try API if configured
  if (!isApiConfigured()) {
    return [];
  }

  const seriesIds = await fetchRecentSeriesIdsForTeam(teamId, limit);
  const matches: Match[] = [];

  for (const info of seriesIds) {
    try {
      const match = await getSeriesMatch(info);
      matches.push(match);
    } catch {
      // Skip failed match fetches
    }
  }

  writeCache(cacheKey, matches, MATCH_CACHE_TTL);
  return matches;
}

export async function getPlayerMatches(playerId: string): Promise<Match[]> {
  const player = await getPlayerById(playerId);
  if (!player) return [];

  // getTeamMatches already handles demo mode gracefully
  const teamMatches = await getTeamMatches(player.teamId);
  const filtered = teamMatches.filter(m =>
    m.maps.some(map =>
      map.rounds.some(r =>
        r.playerStats.some(ps => ps.playerId === playerId)
      )
    )
  );
  return filtered.length > 0 ? filtered : teamMatches;
}

/**
 * Clear all cached data.
 */
export function clearAllCaches(): void {
  clearAllCacheFiles();
}

export { type Team, type Player, type Match, type Region } from './models/index.js';

// ---------- Response Types ----------

interface SearchTeamsResponse {
  teams: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        nameShortened?: string | null;
        title?: {
          id: string;
          name: string;
        } | null;
      };
    }>;
  };
}


interface SearchPlayersResponse {
  players: {
    edges: Array<{
      node: {
        id: string;
        nickname: string;
        team?: {
          id: string;
          name: string;
          nameShortened?: string | null;
        } | null;
        roles?: Array<{ name: string }> | null;
      };
    }>;
  };
}

interface GetTeamResponse {
  team: {
    id: string;
    name: string;
    nameShortened?: string | null;
  };
}

// ---------- Mappers ----------

function mapGridPlayerToPlayer(node: SearchPlayersResponse['players']['edges'][0]['node']): Player | undefined {
  if (!node) return undefined;
  if (!node.team) return undefined;

  // Try to find VCT region from team name
  const vctTeam = findVctTeam(node.team.name);
  const region: Region = vctTeam ? vctRegionToRegion(vctTeam.region) : 'NA';

  return {
    id: node.id,
    name: node.nickname,
    teamId: node.team.id,
    teamName: normalizeDisplayTeamName(node.team.name),
    region,
    role: normalizePlayerRole(node.roles?.[0]?.name),
  };
}

// ---------- Series / Match Loading ----------

interface TeamMatchesResponse {
  allSeries: {
    edges: Array<{
      node: {
        id: string;
        startTimeScheduled?: string | null;
        tournament?: {
          id?: string | null;
          name?: string | null;
        } | null;
      };
    }>;
  };
}

type SeriesIdInfo = { id: string; tournamentName?: string; tournamentId?: string; startTime?: string | null };

async function fetchRecentSeriesIdsForTeam(teamId: string, limit: number): Promise<SeriesIdInfo[]> {
  try {
    const data = await queryGrid<TeamMatchesResponse>(QUERIES.getTeamMatches, {
      teamId,
      first: limit,
    });

    const edges = data?.allSeries?.edges ?? [];
    return edges.map(e => ({
      id: e.node.id,
      tournamentName: e.node.tournament?.name ?? 'Unknown Event',
      tournamentId: e.node.tournament?.id ?? 'unknown',
      startTime: e.node.startTimeScheduled ?? null,
    }));
  } catch {
    return [];
  }
}

interface SeriesResponse {
  series: GridSeries;
}

interface GridSeries {
  id: string;
  startTimeScheduled?: string | null;
  tournament?: {
    id: string;
    name: string;
    region?: string | null;
  } | null;
  teams?: Array<{
    baseInfo: {
      id: string;
      name: string;
      shortName?: string | null;
    };
    score?: number | null;
  }>;
  games?: GridGame[];
}

interface GridGame {
  id: string;
  sequenceNumber?: number | null;
  map?: { name: string | null } | null;
  teams: Array<{
    baseInfo: { id: string; name: string };
    score?: number | null;
    side?: string | null;
    won?: boolean | null;
  }>;
  segments?: Array<{
    duration?: string | null;
    rounds?: GridRound[];
  }>;
}

interface GridRound {
  sequenceNumber?: number | null;
  duration?: string | null;
  winningTeam?: { id: string } | null;
  winningCondition?: string | null;
  teams?: Array<{
    baseInfo: { id: string };
    side?: string | null;
    economy?: { loadoutValue?: number | null } | null;
  }>;
  playerStats?: Array<{
    player: { id: string; nickname?: string | null };
    team: { id: string };
    agent: { name: string; role?: string | null };
    kills?: number | null;
    deaths?: number | null;
    assists?: number | null;
    damageDealt?: number | null;
  }>;
}


async function getSeriesMatch(seriesInfo: string | SeriesIdInfo): Promise<Match> {
  const id = typeof seriesInfo === 'string' ? seriesInfo : seriesInfo.id;
  const cacheKey = `${SERIES_CACHE_PREFIX}${id}`;
  const cached = readCache<Match>(cacheKey);
  if (cached) {
    const needsPlant = cached.maps.some(map =>
      map.rounds.some(round => round.plantOccurred === undefined)
    );
    if (!needsPlant) {
      return cached;
    }
  }

  // Use Series State API - it has round-level player stats via segments
  try {
    const data = await fetchSeriesState(id);
    if (data?.seriesState) {
      const match = mapSeriesStateToMatch(
        id,
        data.seriesState,
        typeof seriesInfo === 'string' ? undefined : seriesInfo
      );

      // Log what we got
      const roundCount = match.maps.reduce((sum, m) => sum + m.rounds.length, 0);
      const playerStatsCount = match.maps.reduce((sum, m) =>
        sum + m.rounds.reduce((rs, r) => rs + r.playerStats.length, 0), 0);

      if (GRID_VERBOSE) {
        if (roundCount > 0) {
          console.log(`[GRID] Series ${id}: ${match.maps.length} maps, ${roundCount} rounds, ${playerStatsCount} player stats`);
        } else {
          console.log(`[GRID] Series ${id}: ${match.maps.length} maps (no round data available)`);
        }
      }

      writeCache(cacheKey, match, MATCH_CACHE_TTL);
      return match;
    }
  } catch (err) {
    console.error(`[GRID] Series State API failed for series ${id}:`, err instanceof Error ? err.message : err);
  }

  // Fallback: use Central Data API for basic metadata (no round data)
  try {
    let seriesData: SeriesResponse | null = null;
    try {
      seriesData = await queryGrid<SeriesResponse>(QUERIES.getSeriesFull, { id });
    } catch (err) {
      const message = getErrorMessage(err);
      if (isSchemaFieldError(message)) {
        if (GRID_VERBOSE) {
          console.log(`[GRID] Series ${id}: retrying minimal central data query`);
        }
        seriesData = await queryGrid<SeriesResponse>(QUERIES.getSeries, { id });
      } else {
        throw err;
      }
    }

    if (seriesData?.series) {
      const match = mapGridSeriesToMatch(seriesData.series);
      writeCache(cacheKey, match, MATCH_CACHE_TTL);
      return match;
    }
  } catch (err) {
    console.error(`[GRID] Central Data API failed for series ${id}:`, err instanceof Error ? err.message : err);
  }

  throw new Error(`Failed to fetch series ${id}`);
}

function mapSeriesStateToMatch(
  seriesId: string,
  state: SeriesStateResponse['seriesState'],
  meta?: SeriesIdInfo
): Match {
  const debugObjectives = {
    segmentsTotal: 0,
    segmentsWithObjectives: 0,
    segmentsWithPlant: 0,
  };
  const teams = (state.teams || []).map(t => ({
    teamId: t.id,
    teamName: normalizeDisplayTeamName(t.name),
    score: t.score ?? 0,
  }));

  const winner =
    teams.find(t => state.teams.find(st => st.id === t.teamId)?.won)?.teamId ??
    (teams.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), teams[0] ?? { teamId: '', teamName: '', score: 0 }).teamId ||
      undefined);

  const maps: MapResult[] = (state.games ?? []).map((g, idx) => {
    // Build a map of player ID -> agent from game-level data
    const playerAgents = new Map<string, string>();
    for (const team of g.teams || []) {
      for (const player of team.players || []) {
        if (player.character?.name) {
          playerAgents.set(player.id, player.character.name);
        }
      }
    }

    // Build team stats
    const teamStats: MapTeamStats[] = (g.teams || []).map(t => ({
      teamId: t.id,
      score: t.score ?? 0,
      attackRoundsWon: 0,
      defenseRoundsWon: 0,
    }));

    // Build rounds from segments
    const rounds: Round[] = [];
    for (const segment of g.segments ?? []) {
      debugObjectives.segmentsTotal += 1;
      const segmentTeams = segment.teams ?? [];
      const segmentObjectives = segment.objectives ?? [];
      const hasTeamObjectives = segmentTeams.some(t => (t.objectives?.length ?? 0) > 0);
      const hasSegmentObjectives = segmentObjectives.length > 0;

      const hasPlantObjective = (
        objectives?: Array<{ type?: string | null; completionCount?: { sum?: number | null } | null }> | null
      ) => (objectives ?? []).some(obj => {
        const lower = (obj.type || '').toLowerCase();
        const sum = obj.completionCount?.sum ?? 0;
        return sum > 0 && (
          lower === 'plantbomb' ||
          (lower.includes('plant') && lower.includes('bomb')) ||
          (lower.includes('spike') && (lower.includes('plant') || lower.includes('deton') || lower.includes('explode')))
        );
      });

      const plantOccurred = hasPlantObjective(segmentObjectives) || segmentTeams.some(t => hasPlantObjective(t.objectives));
      if (hasSegmentObjectives || hasTeamObjectives) {
        debugObjectives.segmentsWithObjectives += 1;
      }
      if (plantOccurred) {
        debugObjectives.segmentsWithPlant += 1;
      }
      const winningTeam = segmentTeams.find(t => t.won);
      const winnerId = winningTeam?.id ?? '';

      // Build side mapping
      const side: Record<string, 'attacker' | 'defender'> = {};
      for (const t of segmentTeams) {
        side[t.id] = normalizeSide(t.side);
      }

      // Build player stats from round data
      const playerStats: RoundPlayerStats[] = [];
      const playerEconomyPlayers: RoundPlayerEconomy[] = [];
      for (const segTeam of segmentTeams) {
        for (const player of segTeam.players || []) {
          const agentName = playerAgents.get(player.id) || 'Unknown';
          playerStats.push({
            playerId: player.id,
            playerNickname: player.name,
            teamId: segTeam.id,
            agent: {
              id: agentName.toLowerCase(),
              name: agentName,
              role: inferRoleFromAgent(agentName) === 'duelist' ? 'Duelist' :
                    inferRoleFromAgent(agentName) === 'initiator' ? 'Initiator' :
                    inferRoleFromAgent(agentName) === 'controller' ? 'Controller' :
                    inferRoleFromAgent(agentName) === 'sentinel' ? 'Sentinel' : 'Duelist',
            },
            kills: player.kills ?? 0,
            deaths: player.deaths ?? 0,
            assists: player.killAssistsGiven ?? 0,
            damageDealt: 0, // Not available in Series State API
            firstKill: false,
            firstDeath: false,
            clutchAttempt: false,
              clutchWin: false,
              ability: { casts: 0, kills: 0, damageDealt: 0 },
            });

            // Player economy snapshot (if provided by Series State API)
            const economy = player.economy ?? null;
            playerEconomyPlayers.push({
              playerId: player.id,
              playerName: player.name,
              teamId: segTeam.id,
              money: economy?.money ?? null,
              loadoutValue: economy?.loadoutValue ?? null,
              netWorth: economy?.netWorth ?? null,
              totalMoneyEarned: economy?.totalMoneyEarned ?? null,
            });
          }
        }

        rounds.push({
          roundNumber: segment.sequenceNumber ?? rounds.length + 1,
          winnerId,
          winType: 'elimination', // Series State API doesn't provide win condition
          side,
          economy: segmentTeams.map(t => ({
            teamId: t.id,
            loadoutValue: 0,
            spent: 0,
            bankRemaining: 0,
            equipmentType: 'full-buy' as EquipmentType,
          })),
          playerStats,
          playerEconomySnapshots: playerEconomyPlayers.length > 0
            ? [{ timestamp: null, players: playerEconomyPlayers }]
            : undefined,
          duration: segment.duration ?? undefined,
          plantOccurred,
          plantTimestamp: null,
          plantTimeSec: null,
        });

      // Update team stats
      if (winnerId && side[winnerId]) {
        const stats = teamStats.find(ts => ts.teamId === winnerId);
        if (stats) {
          if (side[winnerId] === 'attacker') stats.attackRoundsWon += 1;
          if (side[winnerId] === 'defender') stats.defenseRoundsWon += 1;
        }
      }
    }

    return {
      gameId: g.id,
      mapName: g.map?.name ?? 'Unknown',
      mapNumber: g.sequenceNumber ?? idx + 1,
      teamStats,
      rounds,
      winner: g.teams?.find(t => t.won)?.id,
    };
  });

  if (process.env.WINCON_DEBUG === '1') {
    console.log(
      `[WINCON] Series ${seriesId} objectives: segments=${debugObjectives.segmentsTotal}, withObjectives=${debugObjectives.segmentsWithObjectives}, plantRounds=${debugObjectives.segmentsWithPlant}`
    );
  }

  return {
    id: seriesId,
    seriesId,
    tournament: {
      id: meta?.tournamentId ?? 'unknown',
      name: meta?.tournamentName ?? 'Unknown Event',
      region: 'NA',
    },
    teams,
    maps,
    startedAt: meta?.startTime ?? new Date().toISOString(),
    winner,
  };
}

function mapGridSeriesToMatch(series: GridSeries): Match {
  const teams = (series.teams || []).map(t => ({
    teamId: t.baseInfo.id,
    teamName: normalizeDisplayTeamName(t.baseInfo.name),
    score: t.score ?? 0,
  }));

  const maps: MapResult[] = (series.games || []).map((g, idx) => mapGameToMapResult(g, idx + 1));

  const winner =
    teams.find(t => t.score === Math.max(...teams.map(tm => tm.score ?? 0)))?.teamId ||
    maps.find(m => m.winner)?.winner;

  return {
    id: series.id,
    seriesId: series.id,
    tournament: {
      id: series.tournament?.id ?? 'unknown',
      name: series.tournament?.name ?? 'Unknown Event',
      region: normalizeRegion(series.tournament?.region ?? undefined),
    },
    teams,
    maps,
    startedAt: series.startTimeScheduled ?? new Date().toISOString(),
    completedAt: undefined,
    winner,
  };
}

function mapGameToMapResult(game: GridGame, fallbackSeq: number): MapResult {
  const teamStats: MapTeamStats[] = (game.teams || []).map(t => ({
    teamId: t.baseInfo.id,
    score: t.score ?? 0,
    attackRoundsWon: 0,
    defenseRoundsWon: 0,
  }));

  const rounds: Round[] = [];

  for (const segment of game.segments ?? []) {
    for (const round of segment.rounds ?? []) {
      const side: Record<string, 'attacker' | 'defender'> = {};
      for (const teamSide of round.teams ?? []) {
        side[teamSide.baseInfo.id] = normalizeSide(teamSide.side);
      }

      const economy = (round.teams ?? []).map(teamSide => {
        const loadout = teamSide.economy?.loadoutValue ?? 0;
        return {
          teamId: teamSide.baseInfo.id,
          loadoutValue: loadout,
          spent: loadout,
          bankRemaining: 0,
          equipmentType: classifyEquipment(loadout, round.sequenceNumber ?? 0),
        };
      });

      const playerStats: RoundPlayerStats[] = (round.playerStats ?? []).map(ps => ({
        playerId: ps.player.id,
        playerNickname: ps.player.nickname ?? undefined, // For roster inference
        teamId: ps.team.id,
        agent: {
          id: ps.agent.name.toLowerCase(),
          name: ps.agent.name,
          role: normalizeAgentRole(ps.agent.role),
        },
        kills: ps.kills ?? 0,
        deaths: ps.deaths ?? 0,
        assists: ps.assists ?? 0,
        damageDealt: ps.damageDealt ?? 0,
        firstKill: false,
        firstDeath: false,
        clutchAttempt: false,
        clutchWin: false,
        ability: { casts: 0, kills: 0, damageDealt: 0 },
      }));

      const winnerId = round.winningTeam?.id ?? '';
      const existingPlantOccurred = (round as { plantOccurred?: boolean | null }).plantOccurred;
      rounds.push({
        roundNumber: round.sequenceNumber ?? rounds.length + 1,
        winnerId,
        winType: normalizeWinCondition(round.winningCondition),
        side,
        economy,
        playerStats,
        duration: round.duration ?? segment.duration ?? undefined,
        plantOccurred: existingPlantOccurred ?? derivePlantOccurredFromWinningCondition(round.winningCondition),
        plantTimestamp: null,
        plantTimeSec: null,
      });

      if (winnerId && side[winnerId]) {
        const stats = teamStats.find(ts => ts.teamId === winnerId);
        if (stats) {
          if (side[winnerId] === 'attacker') stats.attackRoundsWon += 1;
          if (side[winnerId] === 'defender') stats.defenseRoundsWon += 1;
        }
      }
    }
  }

  const mapWinner =
    game.teams?.find(t => t.won)?.baseInfo.id ??
    determineMapWinner(teamStats);

  return {
    gameId: game.id,
    mapName: game.map?.name ?? 'Unknown',
    mapNumber: game.sequenceNumber ?? fallbackSeq,
    teamStats,
    rounds,
    winner: mapWinner,
  };
}

function determineMapWinner(teamStats: MapTeamStats[]): string | undefined {
  if (teamStats.length === 0) return undefined;
  return teamStats.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), teamStats[0]).teamId;
}

// ---------- Normalizers ----------

function normalizeRegion(region?: string | null): Region {
  const value = (region || '').toUpperCase() as Region;
  if (value === 'NA' || value === 'EMEA' || value === 'APAC' || value === 'CN' || value === 'LATAM') {
    return value;
  }
  return 'NA';
}

function normalizePlayerRole(role?: string | null): PlayerRole | undefined {
  switch ((role || '').toLowerCase()) {
    case 'duelist':
      return 'duelist';
    case 'initiator':
      return 'initiator';
    case 'controller':
      return 'controller';
    case 'sentinel':
      return 'sentinel';
    case 'flex':
      return 'flex';
    default:
      return undefined;
  }
}

function normalizeAgentRole(role?: string | null): AgentRole {
  switch ((role || '').toLowerCase()) {
    case 'initiator':
      return 'Initiator';
    case 'controller':
      return 'Controller';
    case 'sentinel':
      return 'Sentinel';
    default:
      return 'Duelist';
  }
}

function normalizeSide(side?: string | null): 'attacker' | 'defender' {
  const value = (side || '').toLowerCase();
  if (value.startsWith('def')) return 'defender';
  return 'attacker';
}

function normalizeWinCondition(condition?: string | null): Round['winType'] {
  const value = (condition || '').toLowerCase();
  if (value.includes('defuse')) return 'spike_defuse';
  if (value.includes('deton')) return 'spike_detonation';
  if (value.includes('time')) return 'time_expired';
  return 'elimination';
}

function derivePlantOccurredFromWinningCondition(condition?: string | null): boolean {
  const wc = (condition || '').toLowerCase();
  if (wc.includes('defuse') && wc.includes('bomb')) return true;
  if (wc.includes('explode') && wc.includes('bomb')) return true;
  if (wc === 'defusebomb' || wc === 'explodebomb') return true;
  if (wc.includes('spike') && (wc.includes('defuse') || wc.includes('deton') || wc.includes('explode'))) return true;
  return false;
}

function classifyEquipment(loadoutValue: number, roundNumber: number): EquipmentType {
  if (roundNumber === 1 || roundNumber === 13) return 'pistol';
  if (loadoutValue < 2500) return 'eco';
  if (loadoutValue < 4000) return 'semi-buy';
  return 'full-buy';
}
