import { getTeamById, getPlayerById, getTeamMatches, getPlayerMatches } from '../../data/index.js';
import { buildRoundOutcomeReport } from '../roundOutcome.js';
import { mapToRoundObs, isPistolRound, isPostPistolRound } from '../../domain/roundAdapter.js';
import { inferMapEconomy } from '../../domain/econInference.js';
import { analyzeMapPauses } from '../../domain/pauseModel.js';
export async function generateOverviewReport(entityType, entityId, filters) {
    const entity = entityType === 'team'
        ? await getTeamById(entityId)
        : await getPlayerById(entityId);
    if (!entity) {
        throw new Error(`${entityType} not found: ${entityId}`);
    }
    const matches = entityType === 'team'
        ? await getTeamMatches(entityId)
        : await getPlayerMatches(entityId);
    // Apply window filter
    const windowedMatches = matches.slice(0, filters.window || 5);
    // Track overall stats
    let seriesWins = 0;
    let seriesLosses = 0;
    let mapWins = 0;
    let mapLosses = 0;
    let roundsWon = 0;
    let roundsLost = 0;
    let attackRoundsWon = 0;
    let attackRoundsPlayed = 0;
    let defenseRoundsWon = 0;
    let defenseRoundsPlayed = 0;
    const mapStats = {};
    const teamId = entityType === 'team' ? entityId : entity.teamId;
    for (const match of windowedMatches) {
        // Series result
        if (match.winner === teamId) {
            seriesWins++;
        }
        else {
            seriesLosses++;
        }
        for (const map of match.maps) {
            // Apply map filter
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            // Map result
            const mapTeamStats = map.teamStats.find(t => t.teamId === teamId);
            const mapEnemyStats = map.teamStats.find(t => t.teamId !== teamId);
            if (mapTeamStats && mapEnemyStats) {
                if (mapTeamStats.score > mapEnemyStats.score) {
                    mapWins++;
                }
                else {
                    mapLosses++;
                }
                roundsWon += mapTeamStats.score;
                roundsLost += mapEnemyStats.score;
                attackRoundsWon += mapTeamStats.attackRoundsWon;
                defenseRoundsWon += mapTeamStats.defenseRoundsWon;
                // Approximate rounds played per side
                attackRoundsPlayed += mapTeamStats.attackRoundsWon + (mapEnemyStats.defenseRoundsWon || 0);
                defenseRoundsPlayed += mapTeamStats.defenseRoundsWon + (mapEnemyStats.attackRoundsWon || 0);
            }
            // Track map-specific stats
            if (!mapStats[map.mapName]) {
                mapStats[map.mapName] = { wins: 0, losses: 0 };
            }
            if (map.winner === teamId) {
                mapStats[map.mapName].wins++;
            }
            else {
                mapStats[map.mapName].losses++;
            }
        }
    }
    // Build sections
    const sections = [];
    // Match record
    const seriesWinRate = seriesWins + seriesLosses > 0
        ? ((seriesWins / (seriesWins + seriesLosses)) * 100).toFixed(1)
        : '0.0';
    sections.push({
        heading: 'Series Record',
        content: {
            type: 'stat',
            label: 'Win Rate',
            value: `${seriesWinRate}%`,
            unit: `(${seriesWins}W-${seriesLosses}L)`,
        },
    });
    // Map record
    const mapWinRate = mapWins + mapLosses > 0
        ? ((mapWins / (mapWins + mapLosses)) * 100).toFixed(1)
        : '0.0';
    sections.push({
        heading: 'Map Record',
        content: {
            type: 'stat',
            label: 'Map Win Rate',
            value: `${mapWinRate}%`,
            unit: `(${mapWins}W-${mapLosses}L)`,
        },
    });
    // Round differential
    const roundDiff = roundsWon - roundsLost;
    sections.push({
        heading: 'Round Differential',
        content: {
            type: 'stat',
            label: 'Round Diff',
            value: roundDiff >= 0 ? `+${roundDiff}` : String(roundDiff),
            unit: `(${roundsWon}-${roundsLost})`,
        },
    });
    // Side performance
    const attackWinRate = attackRoundsPlayed > 0
        ? ((attackRoundsWon / attackRoundsPlayed) * 100).toFixed(1)
        : '0.0';
    const defenseWinRate = defenseRoundsPlayed > 0
        ? ((defenseRoundsWon / defenseRoundsPlayed) * 100).toFixed(1)
        : '0.0';
    if (entityType === 'team') {
        sections.push({
            heading: 'Side Performance',
            content: {
                type: 'table',
                headers: ['Side', 'Win Rate', 'Rounds Won'],
                rows: [
                    ['Attack', `${attackWinRate}%`, String(attackRoundsWon)],
                    ['Defense', `${defenseWinRate}%`, String(defenseRoundsWon)],
                ],
            },
        });
    }
    // Map pool
    if (Object.keys(mapStats).length > 0) {
        sections.push({
            heading: 'Map Pool',
            content: {
                type: 'table',
                headers: ['Map', 'Win Rate', 'Record'],
                rows: Object.entries(mapStats)
                    .sort((a, b) => {
                    const aRate = a[1].wins / (a[1].wins + a[1].losses);
                    const bRate = b[1].wins / (b[1].wins + b[1].losses);
                    return bRate - aRate;
                })
                    .map(([mapName, stats]) => {
                    const winRate = ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1);
                    return [mapName, `${winRate}%`, `${stats.wins}W-${stats.losses}L`];
                }),
            },
        });
    }
    // Insights
    const insights = [];
    if (parseFloat(attackWinRate) > parseFloat(defenseWinRate) + 10) {
        insights.push('Attack-sided team - consider favoring attack-side maps');
    }
    else if (parseFloat(defenseWinRate) > parseFloat(attackWinRate) + 10) {
        insights.push('Defense-sided team - consider favoring defense-side maps');
    }
    // Best/worst maps
    const sortedMaps = Object.entries(mapStats).sort((a, b) => {
        const aRate = a[1].wins / (a[1].wins + a[1].losses);
        const bRate = b[1].wins / (b[1].wins + b[1].losses);
        return bRate - aRate;
    });
    if (sortedMaps.length >= 2) {
        const [bestMap] = sortedMaps[0];
        const [worstMap] = sortedMaps[sortedMaps.length - 1];
        if (bestMap !== worstMap) {
            insights.push(`Best map: ${bestMap}, Worst map: ${worstMap}`);
        }
    }
    if (insights.length > 0) {
        sections.push({
            heading: 'Insights',
            content: { type: 'bullets', items: insights },
        });
    }
    // Round Outcome & Momentum Analysis (v1 spec)
    const entityName = entityType === 'team'
        ? entity.name
        : entity.name;
    const momentumData = buildRoundOutcomeReport(entityType, entityId, entityName, windowedMatches);
    sections.push({
        heading: 'Round Outcome & Momentum',
        content: {
            type: 'momentum',
            data: momentumData,
        },
    });
    // Economy & Pause Intelligence (v1.1 spec)
    const econIntelData = buildEconIntelData(windowedMatches, teamId, filters);
    if (econIntelData.mapSummaries.length > 0) {
        sections.push({
            heading: 'Economy & Pause Intelligence',
            content: {
                type: 'econ-intel',
                data: econIntelData,
            },
        });
    }
    return {
        type: 'overview',
        title: `Overview Report - ${entityName}`,
        entityType,
        entityId,
        entityName,
        generatedAt: new Date().toISOString(),
        filters,
        sections,
    };
}
/**
 * Build Economy & Pause Intelligence data (v1.1)
 */
function buildEconIntelData(matches, teamId, filters) {
    const mapSummaries = [];
    // Aggregated distributions
    const aggEconDist = { BROKE: 0, LOW: 0, OK: 0, RICH: 0 };
    const aggBuyDist = { ECO: 0, HALF_BUY: 0, FULL_BUY: 0 };
    let totalRounds = 0;
    let totalConfidence = 0;
    for (const match of matches) {
        for (const map of match.maps) {
            // Apply map filter
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            // Convert rounds to RoundObs
            const roundObs = mapToRoundObs(map);
            if (roundObs.length === 0)
                continue;
            // Run economy inference
            const econSummary = inferMapEconomy(roundObs, teamId);
            // Run pause analysis
            const pauseAnalysis = analyzeMapPauses(roundObs, teamId, econSummary);
            // Calculate side win rates
            let attackWins = 0, attackRounds = 0, defenseWins = 0, defenseRounds = 0;
            for (const round of roundObs) {
                const isAttack = round.attackTeamId === teamId;
                if (isAttack) {
                    attackRounds++;
                    if (round.winnerTeamId === teamId)
                        attackWins++;
                }
                else {
                    defenseRounds++;
                    if (round.winnerTeamId === teamId)
                        defenseWins++;
                }
            }
            // Calculate round type win rates
            let pistolWins = 0, pistolPlayed = 0, postPistolWins = 0, postPistolPlayed = 0;
            for (const round of roundObs) {
                if (isPistolRound(round.roundIndex)) {
                    pistolPlayed++;
                    if (round.winnerTeamId === teamId)
                        pistolWins++;
                }
                else if (isPostPistolRound(round.roundIndex)) {
                    postPistolPlayed++;
                    if (round.winnerTeamId === teamId)
                        postPistolWins++;
                }
            }
            mapSummaries.push({
                mapName: econSummary.mapName,
                econ: econSummary,
                pause: pauseAnalysis,
                sideWinRates: {
                    attack: attackRounds > 0 ? attackWins / attackRounds : 0,
                    defense: defenseRounds > 0 ? defenseWins / defenseRounds : 0,
                    attackRounds,
                    defenseRounds,
                },
                roundTypeWinRates: {
                    pistol: pistolPlayed > 0 ? pistolWins / pistolPlayed : 0,
                    pistolPlayed,
                    postPistol: postPistolPlayed > 0 ? postPistolWins / postPistolPlayed : 0,
                    postPistolPlayed,
                },
            });
            // Accumulate for aggregated stats
            const mapRounds = econSummary.rounds.length;
            totalRounds += mapRounds;
            totalConfidence += econSummary.avgConfidence * mapRounds;
            for (const [state, pct] of Object.entries(econSummary.econDistribution)) {
                aggEconDist[state] += pct * mapRounds;
            }
            for (const [buyClass, pct] of Object.entries(econSummary.buyDistribution)) {
                aggBuyDist[buyClass] += pct * mapRounds;
            }
        }
    }
    // Normalize aggregated distributions
    if (totalRounds > 0) {
        for (const state of Object.keys(aggEconDist)) {
            aggEconDist[state] /= totalRounds;
        }
        for (const buyClass of Object.keys(aggBuyDist)) {
            aggBuyDist[buyClass] /= totalRounds;
        }
    }
    return {
        mapSummaries,
        aggregated: {
            avgEconConfidence: totalRounds > 0 ? totalConfidence / totalRounds : 0,
            econDistribution: aggEconDist,
            buyDistribution: aggBuyDist,
        },
    };
}
