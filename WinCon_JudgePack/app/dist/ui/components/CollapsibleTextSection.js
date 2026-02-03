import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
import { useStore } from '../context/store.js';
export function CollapsibleTextSection({ value, hotkey, label, }) {
    const commandMode = useStore((s) => s.commandMode);
    const expanded = useStore((s) => s.winConditionExpanded);
    const toggleWinCondition = useStore((s) => s.toggleWinCondition);
    const renderFormattedText = (text) => {
        const lines = text.split('\n');
        const renderLine = (line, idx) => {
            const isFocus = line.startsWith('Strategic focus:');
            const segments = [];
            let i = 0;
            let bold = false;
            let italic = false;
            while (i < line.length) {
                if (line.startsWith('**', i)) {
                    bold = !bold;
                    i += 2;
                    continue;
                }
                if (line[i] === '*') {
                    italic = !italic;
                    i += 1;
                    continue;
                }
                let j = i;
                while (j < line.length && !line.startsWith('**', j) && line[j] !== '*') {
                    j += 1;
                }
                segments.push({ text: line.slice(i, j), bold, italic });
                i = j;
            }
            return (_jsx(Text, { color: isFocus ? 'yellow' : undefined, children: segments.map((seg, segIdx) => (_jsx(Text, { bold: seg.bold, italic: seg.italic, children: seg.text }, segIdx))) }, idx));
        };
        return (_jsx(Box, { flexDirection: "column", children: lines.map(renderLine) }));
    };
    useInput((input) => {
        if (input.toLowerCase() === hotkey.toLowerCase()) {
            toggleWinCondition();
        }
    }, { isActive: !commandMode });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? 'v' : '>', " "] }), _jsxs(Text, { color: "gray", children: ["Press ", _jsx(Text, { color: "yellow", children: hotkey.toUpperCase() }), " to ", expanded ? 'collapse' : 'expand', " ", label] })] }), expanded && (_jsx(Box, { marginTop: 1, flexDirection: "column", children: renderFormattedText(value) }))] }));
}
