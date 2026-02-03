import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { SelectList, SelectItem, Loading } from '../components/index.js';
import { useStore } from '../context/store.js';
import { searchPlayers, searchPlayerByName } from '../../data/index.js';
import type { Player } from '../../data/models/index.js';

export function PlayerFinderScreen(): React.ReactElement {
  const navigate = useStore((s) => s.navigate);
  const setSelectedPlayer = useStore((s) => s.setSelectedPlayer);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    const search = async () => {
      setSearching(true);
      setError(null);
      try {
        const data = await searchPlayers(query);
        setResults(data);
        setHasSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const [selecting, setSelecting] = useState(false);

  const items: SelectItem<Player>[] = results.map((player) => ({
    label: `${player.name} (${player.teamName})`,
    value: player,
  }));

  const handleSelect = async (item: SelectItem<Player>) => {
    setSelecting(true);
    try {
      // Look up player with historical team (as of cutoff date)
      const player = await searchPlayerByName(item.value.name);
      if (player) {
        setSelectedPlayer(player.id);
        navigate('player-page', { playerId: player.id, playerName: player.name });
      } else {
        // Fallback to the search result
        setSelectedPlayer(item.value.id);
        navigate('player-page', { playerId: item.value.id, playerName: item.value.name });
      }
    } catch {
      // Fallback on error
      setSelectedPlayer(item.value.id);
      navigate('player-page', { playerId: item.value.id, playerName: item.value.name });
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Find a Player</Text>
      <Box marginY={1}>
        <Text color="gray">Search: </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Enter player name..."
        />
      </Box>

      {(searching || selecting) && (
        <Loading message={selecting ? "Loading player..." : "Searching GRID..."} />
      )}

      {error && (
        <Text color="red">Error: {error}</Text>
      )}

      {!searching && !selecting && !error && hasSearched && results.length === 0 && (
        <Text color="gray">No players found for "{query}"</Text>
      )}

      {!searching && !selecting && !error && results.length > 0 && (
        <Box flexDirection="column">
          <Text color="gray">Found {results.length} player(s):</Text>
          <Box marginTop={1}>
            <SelectList items={items} onSelect={handleSelect} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
