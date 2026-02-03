import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Box, useApp, useInput } from 'ink';
import { useStore, selectCanGoBack } from './ui/context/store.js';
import { Header, Footer, CommandInput, HelpOverlay, ErrorMessage } from './ui/components/index.js';
import { Router } from './ui/Router.js';
export function App() {
    const { exit } = useApp();
    const commandMode = useStore((s) => s.commandMode);
    const setCommandMode = useStore((s) => s.setCommandMode);
    const showHelp = useStore((s) => s.showHelp);
    const toggleHelp = useStore((s) => s.toggleHelp);
    const error = useStore((s) => s.error);
    const setError = useStore((s) => s.setError);
    const goBack = useStore((s) => s.goBack);
    const canGoBack = useStore(selectCanGoBack);
    // Clear error after 3 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);
    // Global keyboard bindings
    useInput((input, key) => {
        // Ignore input when in command mode
        if (commandMode) {
            if (key.escape) {
                setCommandMode(false);
            }
            return;
        }
        // Help overlay takes priority
        if (showHelp) {
            toggleHelp();
            return;
        }
        // Global shortcuts
        if (input === '/') {
            setCommandMode(true);
            return;
        }
        if (input === '?' || (input === 'h' && !key.ctrl)) {
            toggleHelp();
            return;
        }
        if (input === 'q') {
            exit();
            return;
        }
        if (key.escape && canGoBack) {
            goBack();
            return;
        }
    });
    // Show help overlay if active
    if (showHelp) {
        return (_jsxs(Box, { flexDirection: "column", minHeight: 20, children: [_jsx(Header, {}), _jsx(Box, { flexGrow: 1, padding: 1, children: _jsx(HelpOverlay, {}) }), _jsx(Footer, {})] }));
    }
    return (_jsxs(Box, { flexDirection: "column", minHeight: 20, children: [_jsx(Header, {}), _jsx(Box, { flexGrow: 1, children: _jsx(Router, {}) }), error && _jsx(ErrorMessage, { message: error }), commandMode && _jsx(CommandInput, {}), _jsx(Footer, {})] }));
}
