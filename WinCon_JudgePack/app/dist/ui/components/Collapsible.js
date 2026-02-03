import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Collapsible({ label, expanded, children }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [expanded ? '▾' : '▸', " "] }), _jsx(Text, { bold: true, children: label })] }), expanded && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: children }))] }));
}
