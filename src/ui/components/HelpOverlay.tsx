import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../context/store.js';

export function HelpOverlay(): React.ReactElement {
  const toggleHelp = useStore((s) => s.toggleHelp);
  const selectedTeamId = useStore((s) => s.selectedTeamId);

  React.useEffect(() => {
    const handleKeypress = () => {
      toggleHelp();
    };
    // Overlay closes on any keypress
    process.stdin.once('keypress', handleKeypress);
    return () => {
      process.stdin.removeListener('keypress', handleKeypress);
    };
  }, [toggleHelp]);

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="double"
      borderColor="cyan"
    >
      <Text bold color="cyan">
        WINCON HELP
      </Text>
      <Text> </Text>

      <Text bold color="yellow">Navigation</Text>
      <Text>  /home         - Go to home screen</Text>
      <Text>  /back         - Go back</Text>
      <Text>  /team {'<name>'}  - View team page</Text>
      <Text>  /player {'<name>'} - View player page</Text>
      <Text>  /match {'<id>'}   - View match details</Text>
      <Text> </Text>

      <Text bold color="yellow">Reports</Text>
      <Text>  /pistol       - Pistol round analysis</Text>
      <Text>  /overview     - General overview</Text>
      {selectedTeamId && (
        <Text color="yellow">  /wincon      - Win Conditions (team only)</Text>
      )}
      <Text> </Text>

      <Text bold color="yellow">Other</Text>
      <Text>  /export       - Export current report to markdown</Text>
      <Text>  /refresh      - Clear cache and refetch fresh data</Text>
      <Text>  /help         - Show this help</Text>
      <Text>  /quit         - Exit application</Text>
      <Text> </Text>

      <Text bold color="yellow">Keyboard</Text>
      <Text>  /             - Open command input</Text>
      <Text>  Esc           - Go back / Cancel</Text>
      <Text>  ?             - Show help</Text>
      <Text>  q             - Quit</Text>
      <Text> </Text>

      <Text color="gray">Press any key to close</Text>
    </Box>
  );
}
