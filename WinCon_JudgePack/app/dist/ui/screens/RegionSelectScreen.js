import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { SelectList } from '../components/index.js';
import { useStore } from '../context/store.js';
export function RegionSelectScreen({ mode }) {
    const navigate = useStore((s) => s.navigate);
    // WinCon scope: only NA and LATAM are supported team regions.
    const availableItems = [
        { label: 'NA', value: 'NA' },
        { label: 'LATAM', value: 'LATAM' },
    ];
    const unavailableRegions = [
        'EMEA - Europe, Middle East, Africa',
        'Pacific - Asia Pacific',
        'China',
    ];
    const handleSelect = (item) => {
        if (mode === 'team') {
            navigate('team-list', { region: item.value });
        }
        else {
            navigate('player-finder', { region: item.value });
        }
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Text, { bold: true, children: ["Select a region to browse ", mode === 'team' ? 'teams' : 'players', ":"] }), _jsx(Box, { marginTop: 1, children: _jsx(SelectList, { items: availableItems, onSelect: handleSelect }) }), unavailableRegions.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "------------------------------" }), _jsx(Text, { bold: true, color: "yellow", children: "Coming Soon" }), unavailableRegions.map((region) => (_jsxs(Text, { dimColor: true, children: ["  ", region] }, region)))] }))] }));
}
