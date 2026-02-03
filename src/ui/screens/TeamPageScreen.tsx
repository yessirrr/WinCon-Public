import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading, SelectableTable } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamById, getTeamMatches, fetchTeamFromGrid, getRosterMetadata } from '../../data/index.js';
import type { Team, Match, Player } from '../../data/models/index.js';

type TeamSection = 'roster' | 'matches';

function formatTournamentName(name: string): string {
  const match = name.match(/\b202\d\b/); // keep through the year token
  if (match && match.index !== undefined) {
    const end = match.index + match[0].length;
    return name.slice(0, end).trim();
  }
  return name;
}

export function TeamPageScreen(): React.ReactElement {
  const params = useStore((s) => s.navigation.params);
  const refreshTrigger = useStore((s) => s.refreshTrigger);
  const lastRefreshed = useStore((s) => s.lastRefreshed);
  const navigate = useStore((s) => s.navigate);
  const setSelectedPlayer = useStore((s) => s.setSelectedPlayer);
  const setSelectedTeam = useStore((s) => s.setSelectedTeam);
  const commandMode = useStore((s) => s.commandMode);

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rosterAsOf, setRosterAsOf] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [focusedSection, setFocusedSection] = useState<TeamSection>('roster');

  const teamId = params?.teamId as string | undefined;
  const teamName = params?.teamName as string | undefined;

  useEffect(() => {
    if (!teamId && !teamName) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try to get team by ID first, fall back to name search
        let teamData: Team | undefined;
        if (teamId) {
          teamData = await getTeamById(teamId);
        }
        if (!teamData && teamName) {
          teamData = await fetchTeamFromGrid(teamName);
        }

        if (teamData) {
          const currentSelectedTeamId = useStore.getState().selectedTeamId;
          if (currentSelectedTeamId !== teamData.id) {
            setSelectedTeam(teamData.id);
          }
          setTeam(teamData);
          setFetchedAt(new Date());
          setLoading(false);

          // Get roster metadata for "as of" date
          const metadata = await getRosterMetadata(teamData.id);
          if (metadata?.asOfDate) {
            setRosterAsOf(new Date(metadata.asOfDate).toLocaleDateString());
          }

          // Load matches in background
          setLoadingMatches(true);
          const matchData = await getTeamMatches(teamData.id, 5).catch(() => [] as Match[]);
          setMatches(matchData);
          setLoadingMatches(false);
        } else {
          setError('Team not found');
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team');
        setLoading(false);
      }
    };

    load();
  }, [teamId, teamName, refreshTrigger]); // Re-fetch when refreshTrigger changes

  const recentMatches = useMemo(() => matches.slice(0, 5), [matches]);

  const matchRows = useMemo(() =>
    recentMatches.map((m) => {
      const opponent = m.teams.find((t) => t.teamId !== team?.id);
      const teamScore = m.teams.find((t) => t.teamId === team?.id);
      return [
        opponent?.teamName || 'Unknown',
        `${teamScore?.score || 0}-${opponent?.score || 0}`,
        formatTournamentName(m.tournament.name),
      ];
    }),
  [recentMatches, team]);

  useInput((_input, key) => {
    if (commandMode) return;
    if (key.tab) {
      setFocusedSection(prev => prev === 'roster' ? 'matches' : 'roster');
    }
  });

  // Format time ago for display
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box padding={1} flexDirection="column">
        <Loading message="Fetching roster from recent matches..." />
        <Text color="gray">Analyzing match participation data from GRID API</Text>
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

  if (!team) {
    return (
      <Box padding={1}>
        <Text color="red">Team not found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Team Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">{team.shortName}</Text>
          <Text color="gray"> - </Text>
          <Text>{team.name}</Text>
          <Text color="gray"> ({team.region})</Text>
        </Box>
        {fetchedAt && (
          <Text color="gray" dimColor>
            Data fetched {formatTimeAgo(fetchedAt)} • /refresh to update
          </Text>
        )}
      </Box>

      {/* Roster */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold>Roster</Text>
          {rosterAsOf && <Text color="gray"> (as of {rosterAsOf})</Text>}
        </Box>
        {team.players.length > 0 ? (
          <SelectableTable<Player>
            headers={['Player', 'Role']}
            rows={team.players.map((p) => [p.name, p.role || '-'])}
            data={team.players}
            onSelect={(player) => {
              setSelectedTeam(null);  // Clear team context
              setSelectedPlayer(player.id);
              navigate('player-page', { playerId: player.id, playerName: player.name });
            }}
            columnWidths={[20, 15]}
            isFocused={focusedSection === 'roster' && !commandMode}
            hint={focusedSection === 'roster' ? '↵ Enter: View player  Tab: Switch section' : 'Tab: Switch section'}
            resetKey={team.id}
          />
        ) : (
          <Box flexDirection="column">
            <Text color="yellow">No roster data available</Text>
            <Text color="gray">GRID API may not have match data for this team/region</Text>
          </Box>
        )}
      </Box>

      {/* Recent Matches */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Recent Matches</Text>
        {loadingMatches ? (
          <Text color="gray">Loading matches from GRID...</Text>
        ) : recentMatches.length > 0 ? (
          <SelectableTable<Match>
            headers={['Opponent', 'Score', 'Tournament']}
            rows={matchRows}
            data={recentMatches}
            onSelect={(match) => {
              navigate('match-page', { teamId: team.id, matchId: match.id });
            }}
            columnWidths={[20, 8, 30]}
            isFocused={focusedSection === 'matches' && !commandMode}
            hint={focusedSection === 'matches' ? '↵ Enter: View match  Tab: Switch section' : 'Tab: Switch section'}
            resetKey={team.id}
          />
        ) : (
          <Text color="gray">No recent matches found</Text>
        )}
      </Box>

      {/* Actions Menu */}
      <Box flexDirection="column">
        <Text bold>Reports</Text>
        <Box>
          <Text color="gray">Use </Text>
          <Text color="gray">/pistol</Text>
          <Text color="gray">, </Text>
          <Text color="gray">/overview</Text>
          <Text color="gray">, or </Text>
          <Text color="yellow">/wincon</Text>
          <Text color="gray"> commands</Text>
        </Box>
      </Box>
    </Box>
  );
}
