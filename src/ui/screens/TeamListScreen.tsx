import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { getTeamsByCompetitiveRegion, fetchTeamFromGrid, type CompetitiveRegion, type VctTeam } from '../../data/index.js';

export function TeamListScreen(): React.ReactElement {
  const params = useStore((s) => s.navigation.params);
  const navigate = useStore((s) => s.navigate);
  const setSelectedTeam = useStore((s) => s.setSelectedTeam);
  const commandMode = useStore((s) => s.commandMode);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const region = params?.region as CompetitiveRegion | undefined;

  // Deterministic, memoized team list — stable across renders
  const teams: VctTeam[] = useMemo(() => {
    if (!region) return [];
    return getTeamsByCompetitiveRegion(region);
  }, [region]);

  const handleSelect = async (team: VctTeam) => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchTeamFromGrid(team.name);
      if (fetched) {
        setSelectedTeam(fetched.id);
        navigate('team-page', { teamId: fetched.id, teamName: team.name });
      } else {
        setError(`Could not find "${team.name}" in GRID database`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team');
    } finally {
      setLoading(false);
    }
  };

  // Controlled keyboard selection — cursor is the single source of truth
  useInput((_input, key) => {
    if (commandMode || loading || teams.length === 0) return;

    if (key.upArrow) {
      setCursor(i => (i > 0 ? i - 1 : teams.length - 1));
    }
    if (key.downArrow) {
      setCursor(i => (i < teams.length - 1 ? i + 1 : 0));
    }
    if (key.return) {
      const team = teams[cursor];
      if (team) handleSelect(team);
    }
  });

  if (!region) {
    return (
      <Box padding={1}>
        <Text color="red">No region selected</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Loading message="Fetching team roster from GRID..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text color="gray">Try selecting the team again or use /refresh.</Text>
      </Box>
    );
  }

  if (teams.length === 0) {
    return (
      <Box padding={1}>
        <Text color="gray">No teams found for {region}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{region} Teams (VCT 2025)</Text>
      <Box flexDirection="column" marginTop={1}>
        {teams.map((team, idx) => {
          const isHighlighted = idx === cursor;
          return (
            <Box key={team.name}>
              <Text color={isHighlighted ? 'cyan' : 'gray'}>
                {isHighlighted ? '\u25B6 ' : '  '}
              </Text>
              <Text bold={isHighlighted} color={isHighlighted ? 'cyan' : undefined}>
                {team.shortName}
              </Text>
              <Text color="gray"> - </Text>
              <Text bold={isHighlighted}>{team.name}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>{'\u2191\u2193'} Navigate  {'\u21B5'} Select</Text>
      </Box>
    </Box>
  );
}
