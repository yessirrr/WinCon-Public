import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { SelectList } from '../components/index.js';
import { useStore } from '../context/store.js';
export function LandingScreen() {
    const navigate = useStore((s) => s.navigate);
    const items = [
        { label: 'Browse Teams by Region', value: 'teams' },
        { label: 'Find a Player', value: 'players' },
    ];
    const handleSelect = (item) => {
        if (item.value === 'teams') {
            navigate('region-select-team');
        }
        else if (item.value === 'players') {
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
    return (_jsxs(Box, { flexDirection: "column", paddingLeft: 2, children: [_jsx(Text, { bold: true, color: "cyan", children: "WINCON" }), logoLines.map((line, index) => (_jsx(Text, { bold: true, color: "cyan", children: line }, `${index}:${line}`))), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, children: "VALORANT SCOUTING CONSOLE" }), _jsx(Text, { color: "gray", children: "Automated scouting reports generated from recent GRID match data" }), _jsx(Text, { children: " " }), _jsx(Text, { bold: true, children: "Who are you preparing for?" }), _jsx(Text, { children: " " }), _jsx(SelectList, { items: items, onSelect: handleSelect })] }));
}
