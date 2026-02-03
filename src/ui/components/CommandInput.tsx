import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useStore } from '../context/store.js';
import { dispatchCommand } from '../../commands/dispatcher.js';

export const CommandInput = React.memo(function CommandInput(): React.ReactElement {
  const [value, setValue] = useState('');
  const setCommandMode = useStore((s) => s.setCommandMode);
  const setError = useStore((s) => s.setError);

  const handleSubmit = async (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      setCommandMode(false);
      return;
    }

    try {
      await dispatchCommand(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command failed');
    }

    setValue('');
    setCommandMode(false);
  };

  return (
    <Box paddingX={1} borderStyle="single" borderColor="green">
      <Text color="green">{'> '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Enter command (e.g., /team SEN)"
      />
    </Box>
  );
});
