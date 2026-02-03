import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamById, getTeamMatches } from '../../data/index.js';
import type { Match, MapResult, Team } from '../../data/models/index.js';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 'N/A';
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = Math.floor(parseFloat(match[3] || '0'));
  const totalMin = hours * 60 + minutes;
  return `${totalMin}:${String(seconds).padStart(2, '0')}`;
}

// --- Data helpers ---

interface TeamPlayerRow {
  name: string;
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
}

interface GroupedScoreboard {
  ourTeamName: string;
  ourScore: number;
  ourPlayers: TeamPlayerRow[];
  oppTeamName: string;
  oppScore: number;
  oppPlayers: TeamPlayerRow[];
}

function buildGroupedScoreboard(map: MapResult, ourTeamId: string, teams: Match['teams']): GroupedScoreboard {
  const playerTotals: Record<string, TeamPlayerRow & { teamId: string }> = {};

  for (const round of map.rounds) {
    for (const ps of round.playerStats) {
      if (!playerTotals[ps.playerId]) {
        playerTotals[ps.playerId] = {
          name: ps.playerNickname || ps.playerId,
          agent: capitalize(ps.agent.name),
          teamId: ps.teamId,
          kills: 0, deaths: 0, assists: 0,
        };
      }
      playerTotals[ps.playerId].kills += ps.kills;
      playerTotals[ps.playerId].deaths += ps.deaths;
      playerTotals[ps.playerId].assists += ps.assists;
    }
  }

  const all = Object.values(playerTotals);
  const ourPlayers = all.filter(p => p.teamId === ourTeamId).sort((a, b) => b.kills - a.kills);
  const oppPlayers = all.filter(p => p.teamId !== ourTeamId).sort((a, b) => b.kills - a.kills);

  const ourTeam = teams.find(t => t.teamId === ourTeamId);
  const oppTeam = teams.find(t => t.teamId !== ourTeamId);

  const ourStats = map.teamStats.find(s => s.teamId === ourTeamId);
  const oppStats = map.teamStats.find(s => s.teamId !== ourTeamId);

  return {
    ourTeamName: ourTeam?.teamName || 'Team',
    ourScore: ourStats?.score ?? 0,
    ourPlayers,
    oppTeamName: oppTeam?.teamName || 'Opponent',
    oppScore: oppStats?.score ?? 0,
    oppPlayers,
  };
}

interface RoundRow {
  roundNum: string;
  winnerName: string;
  runningScore: string;
  time: string;
}

function buildRoundsWithScore(map: MapResult, ourTeamId: string, teams: Match['teams']): RoundRow[] {
  let ourScore = 0;
  let oppScore = 0;

  return map.rounds.map(round => {
    const winnerTeam = teams.find(t => t.teamId === round.winnerId);
    const winnerName = winnerTeam?.teamName || '\u2014';

    if (round.winnerId) {
      if (round.winnerId === ourTeamId) {
        ourScore++;
      } else {
        oppScore++;
      }
    }

    const runningScore = round.winnerId ? `${ourScore}-${oppScore}` : 'N/A';
    const time = round.duration ? parseIsoDuration(round.duration) : 'N/A';

    return {
      roundNum: `R${round.roundNumber}`,
      winnerName,
      runningScore,
      time,
    };
  });
}

// --- Component ---

export function MatchPageScreen(): React.ReactElement {
  const params = useStore((s) => s.navigation.params);
  const commandMode = useStore((s) => s.commandMode);

  const teamId = params?.teamId as string | undefined;
  const matchId = params?.matchId as string | undefined;

  const [team, setTeam] = useState<Team | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  // ID-based selection state (single source of truth)
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
  const [mapCursor, setMapCursor] = useState(0);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      setLoading(true);
      // Reset selection state on context change
      setSelectedMapNumber(null);
      setMapCursor(0);
      setAdvancedExpanded(false);
      try {
        const teamData = await getTeamById(teamId);
        setTeam(teamData || null);
        if (teamData) {
          const allMatches = await getTeamMatches(teamData.id).catch(() => [] as Match[]);
          // Find the specific match by ID
          const found = matchId
            ? allMatches.find(m => m.id === matchId)
            : allMatches[0];
          setMatch(found || null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId, matchId]);

  // Derived data (memoized, deterministically sorted)
  const maps: MapResult[] = useMemo(() => {
    if (!match) return [];
    // Sort by mapNumber for deterministic order
    return [...match.maps].sort((a, b) => a.mapNumber - b.mapNumber);
  }, [match]);

  // Derive selected map from ID, not cursor
  const selectedMap = useMemo(() => {
    if (selectedMapNumber === null) return null;
    return maps.find(m => m.mapNumber === selectedMapNumber) ?? null;
  }, [maps, selectedMapNumber]);

  const scoreboard = useMemo((): GroupedScoreboard | null => {
    if (!selectedMap || !match || !team) return null;
    return buildGroupedScoreboard(selectedMap, team.id, match.teams);
  }, [selectedMap, match, team]);

  const roundTimeline = useMemo(() => {
    if (!selectedMap || !match || !team) return [];
    return buildRoundsWithScore(selectedMap, team.id, match.teams);
  }, [selectedMap, match, team]);

  // Keyboard navigation
  useInput((input, key) => {
    if (commandMode) return;

    // "A" key: toggle Advanced (only when a map is selected)
    if (input.toLowerCase() === 'a') {
      if (selectedMapNumber !== null) {
        setAdvancedExpanded(prev => !prev);
      }
      return;
    }

    // Backspace: go back one level
    if (key.backspace || key.delete) {
      if (selectedMapNumber !== null) {
        // From map view → back to maps list
        setSelectedMapNumber(null);
        setAdvancedExpanded(false);
      } else {
        // From maps list → back to team page
        useStore.getState().goBack();
      }
      return;
    }

    // Up/Down: navigate maps list
    if (key.upArrow || key.downArrow) {
      if (maps.length === 0) return;
      const dir = key.downArrow ? 1 : -1;
      const newCursor = (() => {
        const next = mapCursor + dir;
        if (next < 0) return maps.length - 1;
        if (next >= maps.length) return 0;
        return next;
      })();
      setMapCursor(newCursor);
      // If in map view, update selection to follow cursor
      if (selectedMapNumber !== null) {
        const newMap = maps[newCursor];
        if (newMap) {
          setSelectedMapNumber(newMap.mapNumber);
          setAdvancedExpanded(false);
        }
      }
      return;
    }

    // Enter: select map (show scoreboard)
    if (key.return) {
      if (selectedMapNumber === null && maps.length > 0) {
        const mapAtCursor = maps[mapCursor];
        if (mapAtCursor) {
          setSelectedMapNumber(mapAtCursor.mapNumber);
          setAdvancedExpanded(false);
        }
      }
      return;
    }
  });

  // --- RENDERING ---

  if (loading) {
    return (
      <Box padding={1}>
        <Loading message="Loading match..." />
      </Box>
    );
  }

  if (!team) {
    return (
      <Box padding={1}>
        <Text color="red">Team not found</Text>
      </Box>
    );
  }

  if (!match) {
    return (
      <Box padding={1} flexDirection="column">
        <Text bold color="cyan">{team.name}</Text>
        <Text color="yellow">Match not found.</Text>
      </Box>
    );
  }

  // Match header info
  const opponent = match.teams.find(t => t.teamId !== team.id);
  const teamScore = match.teams.find(t => t.teamId === team.id);
  const won = match.winner === team.id;

  // Scoreboard rendering (display-only, no selection)
  const HEADER_LINE = `${'Player'.padEnd(18)}${'Agent'.padEnd(14)}${'K'.padEnd(6)}${'D'.padEnd(6)}${'A'.padEnd(6)}`;
  const SEPARATOR = '\u2500'.repeat(50);

  const renderPlayerRow = (p: TeamPlayerRow, idx: number) => {
    const cells = `${p.name.padEnd(18)}${p.agent.padEnd(14)}${String(p.kills).padEnd(6)}${String(p.deaths).padEnd(6)}${String(p.assists).padEnd(6)}`;
    return (
      <Box key={idx}>
        <Text>{'  '}{cells}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Match header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">{team.shortName || team.name}</Text>
          <Text> </Text>
          <Text bold color={won ? 'green' : 'red'}>
            {teamScore?.score || 0}-{opponent?.score || 0}
          </Text>
          <Text> vs </Text>
          <Text bold>{opponent?.teamName || 'Unknown'}</Text>
        </Box>
        <Text color="gray" dimColor>
          {formatDate(match.startedAt)}
          {match.tournament?.name ? ` \u2022 ${match.tournament.name}` : ''}
        </Text>
      </Box>

      {/* Maps list */}
      <Box flexDirection="column">
        <Text bold color={selectedMapNumber === null ? 'cyan' : 'gray'}>
          {selectedMapNumber === null ? '[ Maps ]' : 'Maps'}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {maps.length === 0 ? (
            <Text color="gray">No map data available.</Text>
          ) : (
            maps.map((map, idx) => {
              const isAtCursor = idx === mapCursor;
              const t1 = map.teamStats.find(s => s.teamId === team.id);
              const t2 = map.teamStats.find(s => s.teamId !== team.id);
              const mapWon = map.winner === team.id;
              return (
                <Box key={`map-${map.mapNumber}`}>
                  <Text color={isAtCursor ? 'cyan' : 'gray'}>
                    {isAtCursor ? '\u25B6 ' : '  '}
                  </Text>
                  <Text bold={isAtCursor}>{capitalize(map.mapName)}</Text>
                  <Text> </Text>
                  <Text color={mapWon ? 'green' : 'red'}>
                    {t1?.score ?? 0}-{t2?.score ?? 0}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {/* Scoreboard (only after selecting a map with Enter) */}
      {selectedMap && scoreboard && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="gray">Scoreboard \u2014 {capitalize(selectedMap.mapName)}</Text>

          {scoreboard.ourPlayers.length === 0 && scoreboard.oppPlayers.length === 0 ? (
            <Text color="gray">No player data.</Text>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              {/* Our team block */}
              <Box>
                <Text bold color="green">
                  {scoreboard.ourTeamName} ({scoreboard.ourScore})
                </Text>
              </Box>
              <Box>
                <Text bold color="cyan">{'  '}{HEADER_LINE}</Text>
              </Box>
              <Text color="gray">{'  '}{SEPARATOR}</Text>
              {scoreboard.ourPlayers.map((p, i) => renderPlayerRow(p, i))}

              {/* Divider between teams */}
              <Box marginTop={1}>
                <Text color="gray">{'  '}{'\u2504'.repeat(50)}</Text>
              </Box>

              {/* Opponent team block */}
              <Box marginTop={1}>
                <Text bold color="red">
                  {scoreboard.oppTeamName} ({scoreboard.oppScore})
                </Text>
              </Box>
              <Box>
                <Text bold color="cyan">{'  '}{HEADER_LINE}</Text>
              </Box>
              <Text color="gray">{'  '}{SEPARATOR}</Text>
              {scoreboard.oppPlayers.map((p, i) => renderPlayerRow(p, scoreboard.ourPlayers.length + i))}
            </Box>
          )}

          {/* Advanced: Rounds timeline (toggled with "A" key) */}
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text color="cyan">{advancedExpanded ? '\u25BE' : '\u25B8'} </Text>
              <Text bold>Rounds</Text>
              <Text color="gray"> (press </Text>
              <Text color="yellow" bold>A</Text>
              <Text color="gray"> to {advancedExpanded ? 'collapse' : 'expand'})</Text>
            </Box>
            {advancedExpanded && (
              <Box flexDirection="column" marginLeft={2}>
                {roundTimeline.length === 0 ? (
                  <Text color="gray">No round timeline available.</Text>
                ) : (
                  <Box flexDirection="column">
                    <Box>
                      <Text bold color="cyan">{'  '}</Text>
                      <Text bold color="cyan">{'Round'.padEnd(8)}</Text>
                      <Text bold color="cyan">{'Winner'.padEnd(22)}</Text>
                      <Text bold color="cyan">{'Score'.padEnd(8)}</Text>
                      <Text bold color="cyan">{'Time'.padEnd(8)}</Text>
                    </Box>
                    <Text color="gray">{'  '}{'\u2500'.repeat(46)}</Text>
                    {roundTimeline.map((row, idx) => {
                      const cells = `${row.roundNum.padEnd(8)}${row.winnerName.padEnd(22)}${row.runningScore.padEnd(8)}${row.time.padEnd(8)}`;
                      return (
                        <Box key={`round-${idx}`}>
                          <Text>{'  '}{cells}</Text>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Navigation hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {'\u2191\u2193'} Navigate  {'\u21B5'} Select  {'\u232B'} Back{selectedMapNumber !== null ? '  A: Advanced' : ''}
        </Text>
      </Box>
    </Box>
  );
}
