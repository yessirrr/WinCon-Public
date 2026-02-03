import React from 'react';
import { Box, Text } from 'ink';
import { SelectList, SelectItem } from '../components/index.js';
import { useStore } from '../context/store.js';

export function LandingScreen(): React.ReactElement {
  const navigate = useStore((s) => s.navigate);

  const items: SelectItem[] = [
    { label: 'Browse Teams by Region', value: 'teams' },
    { label: 'Find a Player', value: 'players' },
  ];

  const handleSelect = (item: SelectItem) => {
    if (item.value === 'teams') {
      navigate('region-select-team');
    } else if (item.value === 'players') {
      navigate('region-select-player');
    }
  };

  const logoLines = [
    '__        ___ _   _  ____ ___  _   _',
    '\\ \\      / (_) \\ | |/ ___/ _ \\| \\ | |',
    ' \\ \\ /\\ / /| |  \\| | |  | | | |  \\| |',
    '  \\ V  V / | | |\\  | |__| |_| | |\\  |',
    '   \\_/\\_/  |_|_| \\_|\\____\\___/|_| \\_|',
  ];

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {/* Left-aligned hierarchy keeps the landing screen scannable and tool-like in a terminal UI. */}
      <Text bold color="cyan">
        WINCON
      </Text>
      {logoLines.map((line, index) => (
        <Text key={`${index}:${line}`} bold color="cyan">
          {line}
        </Text>
      ))}

      <Text> </Text>
      {/* Descriptor/value copy is intentionally subordinate to the WINCON identity. */}
      <Text bold>VALORANT SCOUTING CONSOLE</Text>
      <Text color="gray">Automated scouting reports generated from recent GRID match data</Text>

      <Text> </Text>
      <Text bold>Who are you preparing for?</Text>
      <Text> </Text>
      <SelectList items={items} onSelect={handleSelect} />
    </Box>
  );
}
