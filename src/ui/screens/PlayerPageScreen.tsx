import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getPlayerById, getTeamById, searchPlayerByName, getPlayerMatches } from '../../data/index.js';
import type { Player, Team, Match } from '../../data/models/index.js';

const STAT_OPTIONS = ['Performance', 'Agent Pool', 'By Map'] as const;
type StatOption = typeof STAT_OPTIONS[number];

const PANEL_WIDTH = 58;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function borderLine(char: string): string {
  return char.repeat(PANEL_WIDTH);
}

function padLine(content: string): string {
  const visible = content.length;
  const pad = Math.max(0, PANEL_WIDTH - visible);
  return content + ' '.repeat(pad);
}

interface PerformanceData {
  kills: number;
  deaths: number;
  assists: number;
  roundsPlayed: number;
  kd: number;
  kda: number;
  kastPercent: number | null;
  kastRounds: number;
}

interface AgentData {
  name: string;
  rounds: number;
  wins: number;
  losses: number;
  mapCounts: Record<string, number>;
  totalMaps: number;
}

interface MapData {
  mapName: string;
  mapsPlayed: number;
  kills: number;
  deaths: number;
  kd: number;
}


function computePerformance(matches: Match[], playerId: string): PerformanceData {
  let kills = 0, deaths = 0, assists = 0, roundsPlayed = 0;
  let kastRounds = 0;

  for (const match of matches) {
    for (const map of match.maps) {
      for (const round of map.rounds) {
        const ps = round.playerStats.find(s => s.playerId === playerId);
        if (ps) {
          kills += ps.kills;
          deaths += ps.deaths;
          assists += ps.assists;
          roundsPlayed++;

          // KAST: Kill, Assist, Survived, or Traded
          // K: got a kill, A: got an assist, S: survived (deaths === 0)
          // T: traded - approximated as: died but teammate got a kill in same round
          const hasKill = ps.kills > 0;
          const hasAssist = ps.assists > 0;
          const survived = ps.deaths === 0;
          // Check if traded: player died but a teammate got a kill
          const traded = ps.deaths > 0 && round.playerStats.some(
            other => other.teamId === ps.teamId && other.playerId !== playerId && other.kills > 0
          );

          if (hasKill || hasAssist || survived || traded) {
            kastRounds++;
          }
        }
      }
    }
  }

  const kd = deaths > 0 ? kills / deaths : kills;
  const kda = deaths > 0 ? (kills + assists) / deaths : kills + assists;
  const kastPercent = roundsPlayed > 0 ? (kastRounds / roundsPlayed) * 100 : null;

  return { kills, deaths, assists, roundsPlayed, kd, kda, kastPercent, kastRounds };
}

function computeAgentPool(matches: Match[], playerId: string): AgentData[] {
  const agents: Record<string, AgentData> = {};

  for (const match of matches) {
    const teamId = match.teams.find(t =>
      match.maps.some(m => m.rounds.some(r => r.playerStats.some(s => s.playerId === playerId && s.teamId === t.teamId)))
    )?.teamId;

    for (const map of match.maps) {
      // Track which agents appeared on this map (for map-level counting)
      const agentSeenOnMap = new Set<string>();

      for (const round of map.rounds) {
        const ps = round.playerStats.find(s => s.playerId === playerId);
        if (ps) {
          const name = ps.agent.name;
          if (!agents[name]) {
            agents[name] = { name, rounds: 0, wins: 0, losses: 0, mapCounts: {}, totalMaps: 0 };
          }
          agents[name].rounds++;
          if (round.winnerId === teamId) {
            agents[name].wins++;
          } else {
            agents[name].losses++;
          }
          agentSeenOnMap.add(name);
        }
      }

      // Increment map-played counts once per map per agent
      for (const agentName of agentSeenOnMap) {
        agents[agentName].mapCounts[map.mapName] = (agents[agentName].mapCounts[map.mapName] || 0) + 1;
        agents[agentName].totalMaps++;
      }
    }
  }

  return Object.values(agents).sort((a, b) => b.totalMaps - a.totalMaps);
}

function computeByMap(matches: Match[], playerId: string): MapData[] {
  const maps: Record<string, { kills: number; deaths: number; mapsPlayed: number }> = {};

  for (const match of matches) {
    for (const map of match.maps) {
      const played = map.rounds.some(r => r.playerStats.some(s => s.playerId === playerId));
      if (!played) continue;

      if (!maps[map.mapName]) {
        maps[map.mapName] = { kills: 0, deaths: 0, mapsPlayed: 0 };
      }
      maps[map.mapName].mapsPlayed++;

      for (const round of map.rounds) {
        const ps = round.playerStats.find(s => s.playerId === playerId);
        if (ps) {
          maps[map.mapName].kills += ps.kills;
          maps[map.mapName].deaths += ps.deaths;
        }
      }
    }
  }

  return Object.entries(maps)
    .map(([mapName, data]) => ({
      mapName,
      mapsPlayed: data.mapsPlayed,
      kills: data.kills,
      deaths: data.deaths,
      kd: data.deaths > 0 ? data.kills / data.deaths : data.kills,
    }))
    .sort((a, b) => b.mapsPlayed - a.mapsPlayed);
}

function renderPanel(lines: string[]): string[] {
  const output: string[] = [];
  output.push(`\u250C\u2500${borderLine('\u2500')}\u2500\u2510`);
  for (const line of lines) {
    output.push(`\u2502 ${padLine(line)} \u2502`);
  }
  output.push(`\u2514\u2500${borderLine('\u2500')}\u2500\u2518`);
  return output;
}

function PerformancePanel({ data, playerName }: { data: PerformanceData; playerName: string }): React.ReactElement {
  const kastDisplay = data.kastPercent !== null ? `${data.kastPercent.toFixed(1)}%` : '--';
  const lines = renderPanel([
    playerName,
    '',
    `Kills: ${data.kills}    Deaths: ${data.deaths}    Assists: ${data.assists}`,
    `Rounds Played: ${data.roundsPlayed}`,
    '',
    `K/D: ${data.kd.toFixed(2)}    KDA: ${data.kda.toFixed(2)}`,
    `KAST%: ${kastDisplay}    KAST (avg): ${data.kastRounds}/${data.roundsPlayed}`,
  ]);
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => <Text key={i}>{line}</Text>)}
    </Box>
  );
}

function AgentPoolPanel({ agents, playerName }: { agents: AgentData[]; playerName: string }): React.ReactElement {
  // Find most played agent
  const mostPlayed = agents.length > 0 ? agents[0] : null;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{playerName} - Agent Pool</Text>
      {mostPlayed && (
        <Box marginTop={1}>
          <Text>Most played agent: </Text>
          <Text bold>{capitalize(mostPlayed.name)}</Text>
          <Text> ({mostPlayed.totalMaps} maps)</Text>
        </Box>
      )}
      <Box flexDirection="column" marginTop={1}>
        {agents.map((agent) => {
          const total = agent.wins + agent.losses;
          const wr = total > 0 ? (agent.wins / total) * 100 : 0;
          const wrColor = wr >= 50 ? 'green' : 'yellow';

          return (
            <Box key={agent.name} justifyContent="space-between" width={PANEL_WIDTH}>
              <Text>{capitalize(agent.name)}</Text>
              <Box>
                <Text color="yellow">maps </Text>
                <Text color="yellow">{String(agent.totalMaps).padStart(2)}</Text>
                <Text>   </Text>
                <Text color={wrColor}>{wr.toFixed(0)}% WR</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ByMapPanel({ mapData, playerName }: { mapData: MapData[]; playerName: string }): React.ReactElement {
  if (mapData.length < 2) {
    const lines = renderPanel([playerName, '', 'Not enough data (need 2+ maps)']);
    return (
      <Box flexDirection="column">
        {lines.map((line, i) => <Text key={i}>{line}</Text>)}
      </Box>
    );
  }

  const contentLines: string[] = [playerName, ''];
  for (const m of mapData) {
    contentLines.push(`${capitalize(m.mapName)} (${m.mapsPlayed}): ${m.kd.toFixed(2)} K/D`);
  }

  const lines = renderPanel(contentLines);
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => <Text key={i}>{line}</Text>)}
    </Box>
  );
}

export function PlayerPageScreen(): React.ReactElement {
  const params = useStore((s) => s.navigation.params);
  const commandMode = useStore((s) => s.commandMode);
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep focus on first item by default, but don't auto-open any stat panel.
  const [selectedStat, setSelectedStat] = useState(0);
  const [expandedStat, setExpandedStat] = useState<StatOption | null>(null);

  const playerId = params?.playerId;
  const playerName = params?.playerName as string | undefined;

  useEffect(() => {
    // Reset advanced-stats focus/selection whenever a new player context is opened.
    setSelectedStat(0);
    setExpandedStat(null);
  }, [playerId, playerName]);

  useEffect(() => {
    if (!playerId && !playerName) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let playerData = playerId ? await getPlayerById(playerId) : undefined;
        if (!playerData && playerName) {
          playerData = await searchPlayerByName(playerName);
        }

        if (playerData) {
          setPlayer(playerData);
          const teamData = await getTeamById(playerData.teamId).catch(() => null);
          setTeam(teamData || null);
          const matchData = await getPlayerMatches(playerData.id).catch(() => []);
          setMatches(matchData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load player');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [playerId, playerName]);

  useInput((input, key) => {
    if (commandMode) return;

    if (key.upArrow) {
      setSelectedStat(i => (i > 0 ? i - 1 : STAT_OPTIONS.length - 1));
    } else if (key.downArrow) {
      setSelectedStat(i => (i < STAT_OPTIONS.length - 1 ? i + 1 : 0));
    } else if (key.return) {
      const option = STAT_OPTIONS[selectedStat];
      setExpandedStat(prev => (prev === option ? null : option));
    }
  });

  const perfData = useMemo(() => {
    if (!player || matches.length === 0) return null;
    return computePerformance(matches, player.id);
  }, [matches, player]);

  const agentData = useMemo(() => {
    if (!player || matches.length === 0) return [];
    return computeAgentPool(matches, player.id);
  }, [matches, player]);

  const mapData = useMemo(() => {
    if (!player || matches.length === 0) return [];
    return computeByMap(matches, player.id);
  }, [matches, player]);

  if (loading) {
    return (
      <Box padding={1}>
        <Loading message="Loading player..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text color="gray">Try /refresh to retry or check your connection.</Text>
      </Box>
    );
  }

  if (!player) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Player not found</Text>
        <Text color="gray">Player data may have expired. Try searching again with /player.</Text>
      </Box>
    );
  }

  const displayRole = player.role || 'Unknown';
  const displayTeam = team?.name || player.teamName || 'Unknown';

  return (
    <Box flexDirection="column" padding={1}>
      {/* Player Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">{player.name}</Text>
        {player.realName && (
          <>
            <Text color="gray"> - </Text>
            <Text>{player.realName}</Text>
          </>
        )}
      </Box>

      {/* Player Info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="gray">Team: </Text>
          <Text>{displayTeam}</Text>
          {player.region && <Text color="gray"> ({player.region})</Text>}
        </Box>
        <Box>
          <Text color="gray">Role: </Text>
          <Text>{displayRole}</Text>
        </Box>
      </Box>

      {/* Teammates */}
      {team && team.players.length > 1 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Teammates</Text>
          <Box>
            <Text color="gray">
              {team.players
                .filter(p => p.id !== player.id)
                .map(p => p.name)
                .join(', ')}
            </Text>
          </Box>
        </Box>
      )}

      {/* Separator */}
      <Box marginBottom={1}>
        <Text color="gray">{'\u2500'.repeat(40)}</Text>
      </Box>

      {/* Advanced Stats */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Advanced Stats</Text>
        <Box flexDirection="column" marginTop={1}>
          {STAT_OPTIONS.map((option, idx) => (
            <Box key={option}>
              <Text color={idx === selectedStat ? 'cyan' : 'gray'}>
                {idx === selectedStat ? '\u25B6 ' : '  '}
              </Text>
              <Text bold={idx === selectedStat} color={expandedStat === option ? 'green' : undefined}>
                {option}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Expanded stat panel */}
      {expandedStat === 'Performance' && perfData && (
        <Box marginBottom={1}>
          <PerformancePanel data={perfData} playerName={player.name} />
        </Box>
      )}

      {expandedStat === 'Agent Pool' && agentData.length > 0 && (
        <Box marginBottom={1}>
          <AgentPoolPanel agents={agentData} playerName={player.name} />
        </Box>
      )}

      {expandedStat === 'By Map' && (
        <Box marginBottom={1}>
          <ByMapPanel mapData={mapData} playerName={player.name} />
        </Box>
      )}
    </Box>
  );
}
