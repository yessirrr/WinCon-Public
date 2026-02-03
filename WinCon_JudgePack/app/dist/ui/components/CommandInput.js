import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useStore } from '../context/store.js';
import { dispatchCommand } from '../../commands/dispatcher.js';
export const CommandInput = React.memo(function CommandInput() {
    const [value, setValue] = useState('');
    const setCommandMode = useStore((s) => s.setCommandMode);
    const setError = useStore((s) => s.setError);
    const handleSubmit = async (input) => {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            setCommandMode(false);
            return;
        }
        try {
            await dispatchCommand(trimmed);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Command failed');
        }
        setValue('');
        setCommandMode(false);
    };
    return (_jsxs(Box, { paddingX: 1, borderStyle: "single", borderColor: "green", children: [_jsx(Text, { color: "green", children: '> ' }), _jsx(TextInput, { value: value, onChange: setValue, onSubmit: handleSubmit, placeholder: "Enter command (e.g., /team SEN)" })] }));
});
