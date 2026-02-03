import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../context/store.js';
export function HelpOverlay() {
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
    return (_jsxs(Box, { flexDirection: "column", padding: 1, borderStyle: "double", borderColor: "cyan", children: [_jsx(Text, { bold: true, color: "cyan", children: "WINCON HELP" }), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, color: "yellow", children: "Navigation" }), _jsx(Text, { children: "  /home         - Go to home screen" }), _jsx(Text, { children: "  /back         - Go back" }), _jsxs(Text, { children: ["  /team ", '<name>', "  - View team page"] }), _jsxs(Text, { children: ["  /player ", '<name>', " - View player page"] }), _jsxs(Text, { children: ["  /match ", '<id>', "   - View match details"] }), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, color: "yellow", children: "Reports" }), _jsx(Text, { children: "  /pistol       - Pistol round analysis" }), _jsx(Text, { children: "  /overview     - General overview" }), selectedTeamId && (_jsx(Text, { color: "yellow", children: "  /wincon      - Win Conditions (team only)" })), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, color: "yellow", children: "Other" }), _jsx(Text, { children: "  /export       - Export current report to markdown" }), _jsx(Text, { children: "  /refresh      - Clear cache and refetch fresh data" }), _jsx(Text, { children: "  /help         - Show this help" }), _jsx(Text, { children: "  /quit         - Exit application" }), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, color: "yellow", children: "Keyboard" }), _jsx(Text, { children: "  /             - Open command input" }), _jsx(Text, { children: "  Esc           - Go back / Cancel" }), _jsx(Text, { children: "  ?             - Show help" }), _jsx(Text, { children: "  q             - Quit" }), _jsx(Text, { children: " " }), _jsx(Text, { color: "gray", children: "Press any key to close" })] }));
}
