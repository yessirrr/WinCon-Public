import { getTeamById, getPlayerById, getTeamMatches, getPlayerMatches } from '../../data/index.js';
export async function generatePistolReport(entityType, entityId, filters) {
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
    // Track pistol rounds (round 1 and round 13)
    let pistolRoundsPlayed = 0;
    let pistolRoundsWon = 0;
    let attackPistolWins = 0;
    let attackPistolPlayed = 0;
    let defensePistolWins = 0;
    let defensePistolPlayed = 0;
    const mapPistolStats = {};
    for (const match of windowedMatches) {
        for (const map of match.maps) {
            // Apply map filter
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            // Find pistol rounds (1 and 13)
            const pistolRounds = map.rounds.filter(r => r.roundNumber === 1 || r.roundNumber === 13);
            for (const round of pistolRounds) {
                // Determine if entity is in this round
                const isTeamInRound = entityType === 'team'
                    ? Object.keys(round.side).includes(entityId)
                    : round.playerStats.some(ps => ps.playerId === entityId);
                if (!isTeamInRound)
                    continue;
                // Get entity's team ID
                const teamId = entityType === 'team'
                    ? entityId
                    : round.playerStats.find(ps => ps.playerId === entityId)?.teamId;
                if (!teamId)
                    continue;
                const side = round.side[teamId];
                // Apply side filter
                if (filters.side && filters.side !== 'both' && side !== filters.side) {
                    continue;
                }
                pistolRoundsPlayed++;
                const won = round.winnerId === teamId;
                if (won)
                    pistolRoundsWon++;
                if (side === 'attacker') {
                    attackPistolPlayed++;
                    if (won)
                        attackPistolWins++;
                }
                else {
                    defensePistolPlayed++;
                    if (won)
                        defensePistolWins++;
                }
                // Map stats
                if (!mapPistolStats[map.mapName]) {
                    mapPistolStats[map.mapName] = { played: 0, won: 0 };
                }
                mapPistolStats[map.mapName].played++;
                if (won)
                    mapPistolStats[map.mapName].won++;
            }
        }
    }
    // Build sections
    const sections = [];
    // Overall stats
    const overallWinRate = pistolRoundsPlayed > 0
        ? ((pistolRoundsWon / pistolRoundsPlayed) * 100).toFixed(1)
        : '0.0';
    sections.push({
        heading: 'Overall Pistol Performance',
        content: {
            type: 'stat',
            label: 'Pistol Win Rate',
            value: `${overallWinRate}%`,
            unit: `(${pistolRoundsWon}/${pistolRoundsPlayed})`,
        },
    });
    // Side breakdown
    const attackWinRate = attackPistolPlayed > 0
        ? ((attackPistolWins / attackPistolPlayed) * 100).toFixed(1)
        : '0.0';
    const defenseWinRate = defensePistolPlayed > 0
        ? ((defensePistolWins / defensePistolPlayed) * 100).toFixed(1)
        : '0.0';
    sections.push({
        heading: 'By Side',
        content: {
            type: 'table',
            headers: ['Side', 'Win Rate', 'Record'],
            rows: [
                ['Attack', `${attackWinRate}%`, `${attackPistolWins}-${attackPistolPlayed - attackPistolWins}`],
                ['Defense', `${defenseWinRate}%`, `${defensePistolWins}-${defensePistolPlayed - defensePistolWins}`],
            ],
        },
    });
    // By map
    if (Object.keys(mapPistolStats).length > 0) {
        sections.push({
            heading: 'By Map',
            content: {
                type: 'table',
                headers: ['Map', 'Win Rate', 'Record'],
                rows: Object.entries(mapPistolStats).map(([mapName, stats]) => {
                    const winRate = ((stats.won / stats.played) * 100).toFixed(1);
                    return [mapName, `${winRate}%`, `${stats.won}-${stats.played - stats.won}`];
                }),
            },
        });
    }
    // Insights
    const insights = [];
    if (parseFloat(attackWinRate) > parseFloat(defenseWinRate)) {
        insights.push(`Stronger on attack pistols (${attackWinRate}% vs ${defenseWinRate}%)`);
    }
    else if (parseFloat(defenseWinRate) > parseFloat(attackWinRate)) {
        insights.push(`Stronger on defense pistols (${defenseWinRate}% vs ${attackWinRate}%)`);
    }
    if (insights.length > 0) {
        sections.push({
            heading: 'Insights',
            content: { type: 'bullets', items: insights },
        });
    }
    const entityName = entityType === 'team'
        ? entity.name
        : entity.name;
    return {
        type: 'pistol',
        title: `Pistol Round Analysis - ${entityName}`,
        entityType,
        entityId,
        entityName,
        generatedAt: new Date().toISOString(),
        filters,
        sections,
    };
}
