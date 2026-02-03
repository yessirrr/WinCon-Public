import React from 'react';
import { Box, Text } from 'ink';
import { useStore, selectCanGoBack } from '../context/store.js';

export function Footer(): React.ReactElement {
  const canGoBack = useStore(selectCanGoBack);
  const commandMode = useStore((s) => s.commandMode);

  if (commandMode) {
    return (
      <Box paddingX={1} borderStyle="single" borderColor="gray">
        <Text color="gray">
          <Text color="yellow">Enter</Text> submit | <Text color="yellow">Esc</Text> cancel
        </Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} borderStyle="single" borderColor="gray">
      <Text color="gray">
        <Text color="yellow">/</Text> command
        {canGoBack && (
          <>
            {' | '}
            <Text color="yellow">Esc</Text> back
          </>
        )}
        {' | '}
        <Text color="yellow">?</Text> help
        {' | '}
        <Text color="yellow">q</Text> quit
      </Text>
    </Box>
  );
}
