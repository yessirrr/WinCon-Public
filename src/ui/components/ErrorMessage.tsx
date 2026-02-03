import React from 'react';
import { Box, Text } from 'ink';

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps): React.ReactElement {
  return (
    <Box paddingX={1} borderStyle="single" borderColor="red">
      <Text color="red">Error: {message}</Text>
    </Box>
  );
}
