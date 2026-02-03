import { getTeamById, getPlayerById, getTeamMatches, getPlayerMatches } from '../../data/index.js';
export async function generateEconomyReport(entityType, entityId, filters) {
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
    // Track economy patterns
    const buyTypeStats = {
        pistol: { played: 0, won: 0 },
        eco: { played: 0, won: 0 },
        'semi-buy': { played: 0, won: 0 },
        'full-buy': { played: 0, won: 0 },
    };
    let totalLoadoutValue = 0;
    let totalRounds = 0;
    let bonusWins = 0; // Wins when outspent
    let bonusLosses = 0; // Losses when outspending
    for (const match of windowedMatches) {
        for (const map of match.maps) {
            // Apply map filter
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            for (const round of map.rounds) {
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
                const teamEconomy = round.economy.find(e => e.teamId === teamId);
                const enemyEconomy = round.economy.find(e => e.teamId !== teamId);
                if (!teamEconomy)
                    continue;
                totalRounds++;
                totalLoadoutValue += teamEconomy.loadoutValue;
                const buyType = teamEconomy.equipmentType;
                buyTypeStats[buyType].played++;
                if (round.winnerId === teamId) {
                    buyTypeStats[buyType].won++;
                }
                // Track bonus wins/losses (economic mismatches)
                if (enemyEconomy) {
                    const outspent = teamEconomy.loadoutValue < enemyEconomy.loadoutValue * 0.7;
                    const outspending = teamEconomy.loadoutValue > enemyEconomy.loadoutValue * 1.3;
                    const won = round.winnerId === teamId;
                    if (outspent && won)
                        bonusWins++;
                    if (outspending && !won)
                        bonusLosses++;
                }
            }
        }
    }
    // Build sections
    const sections = [];
    // Average loadout
    const avgLoadout = totalRounds > 0 ? Math.round(totalLoadoutValue / totalRounds) : 0;
    sections.push({
        heading: 'Economy Overview',
        content: {
            type: 'stat',
            label: 'Average Loadout Value',
            value: avgLoadout.toLocaleString(),
            unit: 'credits',
        },
    });
    // Buy type performance
    sections.push({
        heading: 'Performance by Buy Type',
        content: {
            type: 'table',
            headers: ['Buy Type', 'Rounds', 'Win Rate'],
            rows: Object.entries(buyTypeStats)
                .filter(([_, stats]) => stats.played > 0)
                .map(([buyType, stats]) => {
                const winRate = ((stats.won / stats.played) * 100).toFixed(1);
                return [buyType, String(stats.played), `${winRate}%`];
            }),
        },
    });
    // Eco round performance
    const ecoStats = buyTypeStats.eco;
    if (ecoStats.played > 0) {
        const ecoWinRate = ((ecoStats.won / ecoStats.played) * 100).toFixed(1);
        sections.push({
            heading: 'Eco Round Performance',
            content: {
                type: 'stat',
                label: 'Eco Win Rate',
                value: `${ecoWinRate}%`,
                unit: `(${ecoStats.won}/${ecoStats.played})`,
            },
        });
    }
    // Insights
    const insights = [];
    if (bonusWins > 0) {
        insights.push(`Won ${bonusWins} round(s) when significantly outspent (bonus rounds)`);
    }
    if (bonusLosses > 0) {
        insights.push(`Lost ${bonusLosses} round(s) despite outspending opponent`);
    }
    const fullBuyWinRate = buyTypeStats['full-buy'].played > 0
        ? (buyTypeStats['full-buy'].won / buyTypeStats['full-buy'].played) * 100
        : 0;
    if (fullBuyWinRate < 50 && buyTypeStats['full-buy'].played >= 3) {
        insights.push(`Low full-buy win rate (${fullBuyWinRate.toFixed(1)}%) - may indicate execution issues`);
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
        type: 'economy',
        title: `Economy Analysis - ${entityName}`,
        entityType,
        entityId,
        entityName,
        generatedAt: new Date().toISOString(),
        filters,
        sections,
    };
}
