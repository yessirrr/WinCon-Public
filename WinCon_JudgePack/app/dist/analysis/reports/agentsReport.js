import { getTeamById, getPlayerById, getTeamMatches, getPlayerMatches } from '../../data/index.js';
export async function generateAgentsReport(entityType, entityId, filters) {
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
    // Aggregate agent data
    const agentStats = {};
    for (const match of windowedMatches) {
        for (const map of match.maps) {
            // Apply map filter
            if (filters.map && map.mapName.toLowerCase() !== filters.map.toLowerCase()) {
                continue;
            }
            for (const round of map.rounds) {
                // Apply side filter
                for (const ps of round.playerStats) {
                    if (entityType === 'team' && ps.teamId !== entityId)
                        continue;
                    if (entityType === 'player' && ps.playerId !== entityId)
                        continue;
                    const side = round.side[ps.teamId];
                    if (filters.side && filters.side !== 'both' && side !== filters.side) {
                        continue;
                    }
                    const agentName = ps.agent.name;
                    if (!agentStats[agentName]) {
                        agentStats[agentName] = { picks: 0, maps: [], wins: 0, losses: 0 };
                    }
                    agentStats[agentName].picks++;
                    if (!agentStats[agentName].maps.includes(map.mapName)) {
                        agentStats[agentName].maps.push(map.mapName);
                    }
                    if (round.winnerId === ps.teamId) {
                        agentStats[agentName].wins++;
                    }
                    else {
                        agentStats[agentName].losses++;
                    }
                }
            }
        }
    }
    // Build sections
    const sections = [];
    // Check if we have round data
    const hasRoundData = windowedMatches.some(m => m.maps.some(map => map.rounds.length > 0));
    // Summary section
    const totalAgents = Object.keys(agentStats).length;
    if (!hasRoundData) {
        sections.push({
            heading: 'Summary',
            content: {
                type: 'text',
                value: `No round-level data available. Run /refresh to fetch fresh match data from GRID API.`,
            },
        });
    }
    else {
        sections.push({
            heading: 'Summary',
            content: {
                type: 'text',
                value: `Analyzed ${windowedMatches.length} matches. Found ${totalAgents} unique agents played.`,
            },
        });
    }
    // Agent composition table
    const sortedAgents = Object.entries(agentStats)
        .sort((a, b) => b[1].picks - a[1].picks);
    if (sortedAgents.length > 0) {
        sections.push({
            heading: 'Agent Usage',
            content: {
                type: 'table',
                headers: ['Agent', 'Rounds', 'Win Rate', 'Maps'],
                rows: sortedAgents.map(([agent, stats]) => {
                    const winRate = stats.wins + stats.losses > 0
                        ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
                        : '0.0';
                    return [
                        agent,
                        String(stats.picks),
                        `${winRate}%`,
                        stats.maps.join(', '),
                    ];
                }),
            },
        });
    }
    // Insights
    if (sortedAgents.length > 0) {
        const [topAgent, topStats] = sortedAgents[0];
        const insights = [];
        insights.push(`Most played agent: ${topAgent} (${topStats.picks} rounds)`);
        if (sortedAgents.length > 1) {
            const [secondAgent] = sortedAgents[1];
            insights.push(`Second most played: ${secondAgent}`);
        }
        sections.push({
            heading: 'Insights',
            content: { type: 'bullets', items: insights },
        });
    }
    const entityName = entityType === 'team'
        ? entity.name
        : entity.name;
    return {
        type: 'agents',
        title: `Agent Composition Report - ${entityName}`,
        entityType,
        entityId,
        entityName,
        generatedAt: new Date().toISOString(),
        filters,
        sections,
    };
}
