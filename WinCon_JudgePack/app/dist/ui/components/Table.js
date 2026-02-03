import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function Table({ headers, rows, columnWidths }) {
    // Calculate column widths if not provided
    const widths = columnWidths || headers.map((header, i) => {
        const maxContentWidth = Math.max(header.length, ...rows.map((row) => (row[i] || '').length));
        return Math.min(maxContentWidth + 2, 30);
    });
    const renderCell = (content, width, isHeader) => {
        const truncated = content.length > width - 2
            ? content.slice(0, width - 3) + '...'
            : content;
        const padded = truncated.padEnd(width);
        return (_jsx(Text, { bold: isHeader, color: isHeader ? 'cyan' : 'white', children: padded }));
    };
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Box, { children: headers.map((header, i) => (_jsx(Box, { width: widths[i], children: renderCell(header, widths[i], true) }, i))) }), _jsx(Box, { children: _jsx(Text, { color: "gray", children: widths.map((w) => '-'.repeat(w)).join('') }) }), rows.map((row, rowIndex) => (_jsx(Box, { children: row.map((cell, cellIndex) => (_jsx(Box, { width: widths[cellIndex], children: renderCell(cell, widths[cellIndex], false) }, cellIndex))) }, rowIndex)))] }));
}
