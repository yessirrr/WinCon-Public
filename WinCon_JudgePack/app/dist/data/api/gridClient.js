import 'dotenv/config';
import { isDemoMode } from '../../config.js';
const GRID_API_KEY = process.env.GRID_API_KEY || '';
// Central Data (metadata)
const GRID_GQL_ENDPOINT = process.env.GRID_GQL_ENDPOINT || 'https://api-op.grid.gg/central-data/graphql';
// Series State (live/participant data)
const GRID_STATE_GQL_ENDPOINT = process.env.GRID_STATE_GQL_ENDPOINT || 'https://api-op.grid.gg/live-data-feed/series-state/graphql';
// Statistics Feed (aggregated stats)
const GRID_STATS_GQL_ENDPOINT = process.env.GRID_STATS_GQL_ENDPOINT || 'https://api-op.grid.gg/statistics-feed/graphql';
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getOperationName(query) {
    const match = /query\s+([A-Za-z0-9_]+)/.exec(query);
    return match?.[1] ?? 'UnknownOperation';
}
async function executeGridQuery(endpoint, query, variables) {
    const maxAttempts = 3;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': GRID_API_KEY,
                },
                body: JSON.stringify({ query, variables }),
            });
            // Retry on transient status codes
            if (!response.ok) {
                if (response.status === 429 || response.status === 503) {
                    lastError = new Error(`GRID API rate/availability error: ${response.status} ${response.statusText}`);
                    if (attempt < maxAttempts) {
                        await sleep(250 * attempt); // simple backoff
                        continue;
                    }
                }
                throw new Error(`GRID API error: ${response.status} ${response.statusText}`);
            }
            const json = await response.json();
            if (json.errors) {
                // Retry on rate-limit style GraphQL errors
                const msg = json.errors.map(e => e.message).join(', ');
                const transient = /rate limit|unavailable|timeout/i.test(msg);
                if (transient && attempt < maxAttempts) {
                    lastError = new Error(`GraphQL error (transient): ${msg}`);
                    await sleep(250 * attempt);
                    continue;
                }
                throw new Error(`GraphQL error: ${msg}`);
            }
            if (!json.data) {
                throw new Error('No data returned from GRID API');
            }
            return json.data;
        }
        catch (err) {
            lastError = err;
            if (attempt === maxAttempts) {
                throw err;
            }
            await sleep(250 * attempt);
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Unknown GRID API error');
}
// Central-data GraphQL
export function queryGrid(query, variables) {
    return executeGridQuery(GRID_GQL_ENDPOINT, query, variables);
}
// Series-state GraphQL (live / player participation)
export function queryGridState(query, variables) {
    return executeGridQuery(GRID_STATE_GQL_ENDPOINT, query, variables);
}
// Statistics-feed GraphQL (aggregated stats)
export async function queryGridStats(query, variables) {
    const debug = process.env.WINCON_DEBUG === '1';
    const operation = getOperationName(query);
    if (debug) {
        console.log(`[GRID] stats request ${operation} -> ${GRID_STATS_GQL_ENDPOINT}`);
    }
    try {
        const data = await executeGridQuery(GRID_STATS_GQL_ENDPOINT, query, variables);
        if (debug) {
            console.log(`[GRID] stats response ${operation}: ok`);
        }
        return data;
    }
    catch (err) {
        if (debug) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`[GRID] stats response ${operation}: error ${message}`);
        }
        throw err;
    }
}
// Official VCT 2025 partnered teams by region
export const VCT_TEAMS = [
    // ==================== AMERICAS ====================
    { name: '100 Thieves', shortName: '100T', region: 'Americas' },
    { name: 'Cloud9', shortName: 'C9', region: 'Americas' },
    { name: 'Evil Geniuses', shortName: 'EG', region: 'Americas' },
    { name: 'FURIA', shortName: 'FUR', region: 'Americas' },
    { name: 'KRU Esports', shortName: 'KRU', region: 'Americas' },
    { name: 'Leviatan Esports', shortName: 'LEV', region: 'Americas' },
    { name: 'LOUD', shortName: 'LOUD', region: 'Americas' },
    { name: 'MIBR', shortName: 'MIBR', region: 'Americas' },
    { name: 'NRG', shortName: 'NRG', region: 'Americas' },
    { name: 'Sentinels', shortName: 'SEN', region: 'Americas' },
    { name: 'G2 Esports', shortName: 'G2', region: 'Americas' },
    { name: '2GAME Esports', shortName: '2G', region: 'Americas' },
    // ==================== CHINA ====================
    { name: 'All Gamers', shortName: 'AG', region: 'China' },
    { name: 'Bilibili Gaming', shortName: 'BLG', region: 'China' },
    { name: 'EDward Gaming', shortName: 'EDG', region: 'China' },
    { name: 'FunPlus Phoenix', shortName: 'FPX', region: 'China' },
    { name: 'JD Gaming', shortName: 'JDG', region: 'China' },
    { name: 'Nova Esports', shortName: 'Nova', region: 'China' },
    { name: 'Titan Esports Club', shortName: 'TEC', region: 'China' },
    { name: 'Trace Esports', shortName: 'TE', region: 'China' },
    { name: 'TYLOO', shortName: 'TYL', region: 'China' },
    { name: 'Wolves Esports', shortName: 'Wolves', region: 'China' },
    { name: 'Dragon Ranger Gaming', shortName: 'DRG', region: 'China' },
    { name: 'XLG Esports', shortName: 'XLG', region: 'China' },
    // ==================== EMEA ====================
    { name: 'BBL Esports', shortName: 'BBL', region: 'EMEA' },
    { name: 'Fnatic', shortName: 'FNC', region: 'EMEA' },
    { name: 'FUT Esports', shortName: 'FUT', region: 'EMEA' },
    { name: 'Karmine Corp', shortName: 'KC', region: 'EMEA' },
    { name: 'KOI', shortName: 'KOI', region: 'EMEA' },
    { name: 'Natus Vincere', shortName: 'NAVI', region: 'EMEA' },
    { name: 'Team Heretics', shortName: 'TH', region: 'EMEA' },
    { name: 'Team Liquid', shortName: 'TL', region: 'EMEA' },
    { name: 'Team Vitality', shortName: 'VIT', region: 'EMEA' },
    { name: 'GIANTX', shortName: 'GIA', region: 'EMEA' },
    { name: 'Gentle Mates', shortName: 'M8', region: 'EMEA' },
    { name: 'Apeks', shortName: 'APK', region: 'EMEA' },
    // ==================== PACIFIC ====================
    { name: 'DetonatioN FocusMe', shortName: 'DFM', region: 'Pacific' },
    { name: 'DRX', shortName: 'DRX', region: 'Pacific' },
    { name: 'Gen.G Esports', shortName: 'GEN', region: 'Pacific' },
    { name: 'Global Esports', shortName: 'GE', region: 'Pacific' },
    { name: 'Paper Rex', shortName: 'PRX', region: 'Pacific' },
    { name: 'Rex Regum Qeon', shortName: 'RRQ', region: 'Pacific' },
    { name: 'T1', shortName: 'T1', region: 'Pacific' },
    { name: 'TALON', shortName: 'TLN', region: 'Pacific' },
    { name: 'Team Secret', shortName: 'TS', region: 'Pacific' },
    { name: 'ZETA DIVISION', shortName: 'ZETA', region: 'Pacific' },
    { name: 'Nongshim RedForce', shortName: 'NS', region: 'Pacific' },
    { name: 'BOOM Esports', shortName: 'BOOM', region: 'Pacific' },
];
// Get teams by region (instant, no API call)
export function getVctTeamsByRegion(region) {
    return VCT_TEAMS.filter(t => t.region === region);
}
// Find team by name (case-insensitive, partial match)
export function findVctTeam(name) {
    const lower = name.toLowerCase();
    const normalized = normalizeTeamLookupValue(name);
    const exact = VCT_TEAMS.find(t => t.name.toLowerCase() === lower ||
        t.shortName.toLowerCase() === lower ||
        normalizeTeamLookupValue(t.name) === normalized ||
        normalizeTeamLookupValue(t.shortName) === normalized);
    if (exact) {
        return exact;
    }
    if (!normalized) {
        return undefined;
    }
    return VCT_TEAMS.find(t => {
        const normalizedName = normalizeTeamLookupValue(t.name);
        return normalizedName.includes(normalized) || normalized.includes(normalizedName);
    });
}
function normalizeTeamLookupValue(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
// Map VCT region to internal Region type
export function vctRegionToRegion(vctRegion) {
    switch (vctRegion) {
        case 'Americas': return 'NA';
        case 'EMEA': return 'EMEA';
        case 'Pacific': return 'APAC';
        case 'China': return 'CN';
    }
}
// Lookup region by team name (case-insensitive)
export function getTeamRegion(teamName) {
    const team = findVctTeam(teamName);
    if (!team)
        return undefined;
    return vctRegionToRegion(team.region);
}
// Common GRID queries
export const QUERIES = {
    // Get series state with player data (Series State API)
    // This is the correct way to get players who participated in a series
    // Includes round-level data via segments.teams.players
    getSeriesState: `
    query GetSeriesState($id: ID!) {
      seriesState(id: $id) {
        id
        teams {
          id
          name
          score
          won
          players {
            id
            name
            participationStatus
          }
        }
        games {
          id
          sequenceNumber
          map { name }
          teams {
            id
            name
            score
            won
            players {
              id
              name
              character { name }
              kills
              deaths
              killAssistsGiven
            }
          }
          segments {
            id
            sequenceNumber
            duration
            objectives {
              type
              completionCount { sum }
            }
            teams {
              id
              side
              won
              kills
              deaths
              objectives {
                type
                completionCount { sum }
              }
              players {
                id
                name
                kills
                deaths
                killAssistsGiven
                economy {
                  money
                  loadoutValue
                  netWorth
                  totalMoneyEarned
                }
              }
            }
          }
        }
      }
    }
  `,
    // Series state without economy fields (fallback for schema-restricted accounts)
    getSeriesStateBase: `
    query GetSeriesStateBase($id: ID!) {
      seriesState(id: $id) {
        id
        teams {
          id
          name
          score
          won
          players {
            id
            name
            participationStatus
          }
        }
        games {
          id
          sequenceNumber
          map { name }
          teams {
            id
            name
            score
            won
            players {
              id
              name
              character { name }
              kills
              deaths
              killAssistsGiven
            }
          }
          segments {
            id
            sequenceNumber
            duration
            objectives {
              type
              completionCount { sum }
            }
            teams {
              id
              side
              won
              kills
              deaths
              objectives {
                type
                completionCount { sum }
              }
              players {
                id
                name
                kills
                deaths
                killAssistsGiven
              }
            }
          }
        }
      }
    }
  `,
    // Series state minimal fallback (no objectives, no economy)
    getSeriesStateBaseNoObjectives: `
    query GetSeriesStateBaseNoObjectives($id: ID!) {
      seriesState(id: $id) {
        id
        teams {
          id
          name
          score
          won
          players {
            id
            name
            participationStatus
          }
        }
        games {
          id
          sequenceNumber
          map { name }
          teams {
            id
            name
            score
            won
            players {
              id
              name
              character { name }
              kills
              deaths
              killAssistsGiven
            }
          }
          segments {
            id
            sequenceNumber
            duration
            teams {
              id
              side
              won
              kills
              deaths
              players {
                id
                name
                kills
                deaths
                killAssistsGiven
              }
            }
          }
        }
      }
    }
  `,
    getSeriesStatisticsObjectives: `
    query GetSeriesStatisticsObjectives($id: ID!) {
      seriesStatistics(id: $id) {
        id
        games {
          id
          segments {
            id
            sequenceNumber
            objectives {
              type
              completionCount { sum }
            }
          }
        }
      }
    }
  `,
    getSeriesStatisticsObjectivesAlt: `
    query GetSeriesStatisticsObjectivesAlt($seriesId: ID!) {
      seriesStatistics(seriesId: $seriesId) {
        id
        games {
          id
          segments {
            id
            sequenceNumber
            objectives {
              type
              completionCount { sum }
            }
          }
        }
      }
    }
  `,
    // Get series/match details (Central Data API - for metadata)
    getSeriesFull: `
    query GetSeriesFull($id: ID!) {
      series(id: $id) {
        id
        startTimeScheduled
        tournament {
          id
          name
        }
        teams {
          baseInfo {
            id
            name
            shortName
          }
          score
        }
        games {
          id
          sequenceNumber
          map {
            name
          }
          teams {
            baseInfo {
              id
              name
            }
            score
            side
            won
          }
          segments {
            id
            sequenceNumber
            duration
            rounds {
              sequenceNumber
              duration
              winningTeam {
                id
              }
              winningCondition
              teams {
                baseInfo {
                  id
                }
                side
                economy {
                  loadoutValue
                }
              }
              playerStats {
                player {
                  id
                  nickname
                }
                team {
                  id
                }
                agent {
                  name
                  role
                }
                kills
                deaths
                assists
                damageDealt
              }
            }
          }
        }
      }
    }
  `,
    getSeries: `
    query GetSeries($id: ID!) {
      series(id: $id) {
        id
        startTimeScheduled
        tournament {
          id
          name
        }
      }
    }
  `,
    // Search teams by name (no players - they're fetched separately)
    searchTeams: `
    query SearchTeams($name: String!, $first: Int, $titleId: ID!) {
      teams(filter: { name: { contains: $name }, titleId: $titleId }, first: $first) {
        edges {
          node {
            id
            name
            nameShortened
            title {
              id
              name
            }
          }
        }
      }
    }
  `,
    // Get players for a team by team ID (nested filter)
    getTeamPlayers: `
    query GetTeamPlayers($teamId: ID!, $first: Int) {
      players(filter: { teamIds: { in: [$teamId] } }, first: $first) {
        edges {
          node {
            id
            nickname
            team {
              id
              name
              nameShortened
            }
            roles { name }
          }
        }
      }
    }
  `,
    // Get recent series involving a team (Central Data API)
    getTeamMatches: `
    query GetTeamMatches($teamId: ID!, $first: Int) {
      allSeries(
        first: $first
        filter: { teamIds: { in: [$teamId] } }
        orderBy: StartTimeScheduled
        orderDirection: DESC
      ) {
        edges {
          node {
            id
            startTimeScheduled
            tournament { id name }
          }
        }
      }
    }
  `,
    // Search players by nickname
    searchPlayers: `
    query SearchPlayers($name: String!, $first: Int) {
      players(filter: { nickname: { contains: $name } }, first: $first) {
        edges {
          node {
            id
            nickname
            team {
              id
              name
              nameShortened
            }
            roles { name }
          }
        }
      }
    }
  `,
    // Get team details (players fetched separately)
    getTeam: `
    query GetTeam($id: ID!) {
      team(id: $id) {
        id
        name
        nameShortened
      }
    }
  `,
    // List teams paginated (players fetched separately)
    listTeamsPaginated: `
    query ListTeams($first: Int!, $after: String) {
      teams(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            name
            nameShortened
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
    // Get recent series to find active teams
    listRecentSeries: `
    query ListRecentSeries($first: Int!) {
      allSeries(first: $first, orderBy: StartTimeScheduled, orderDirection: DESC) {
        edges {
          node {
            id
            tournament {
              id
              name
            }
            teams {
              baseInfo {
                id
                name
                nameShortened
              }
            }
          }
        }
      }
    }
  `,
};
export function isApiConfigured() {
    if (isDemoMode())
        return false; // Never call API in demo mode
    return GRID_API_KEY.length > 0;
}
