import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
export function SelectableTable({ headers, rows, data, onSelect, columnWidths, isFocused = true, hint, resetKey, }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Reset cursor when resetKey changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [resetKey]);
    // Clamp cursor when data shrinks
    useEffect(() => {
        setSelectedIndex(prev => Math.min(prev, Math.max(0, rows.length - 1)));
    }, [rows.length]);
    useInput((input, key) => {
        if (!isFocused)
            return;
        if (key.upArrow) {
            setSelectedIndex(i => (i > 0 ? i - 1 : rows.length - 1));
        }
        if (key.downArrow) {
            setSelectedIndex(i => (i < rows.length - 1 ? i + 1 : 0));
        }
        if (key.return) {
            if (data[selectedIndex]) {
                onSelect(data[selectedIndex], selectedIndex);
            }
        }
    }, { isActive: isFocused });
    // Calculate column widths if not provided
    const widths = columnWidths || headers.map((header, i) => {
        const maxContentWidth = Math.max(header.length, ...rows.map((row) => (row[i] || '').length));
        return Math.min(maxContentWidth + 2, 30);
    });
    // Add width for selection indicator (2 chars: "▶ " or "  ")
    const indicatorWidth = 2;
    const renderCell = (content, width, isHeader, isSelected) => {
        const truncated = content.length > width - 2
            ? content.slice(0, width - 3) + '...'
            : content;
        const padded = truncated.padEnd(width);
        if (isHeader) {
            return (_jsx(Text, { bold: true, color: "cyan", children: padded }));
        }
        if (isSelected) {
            return (_jsx(Text, { backgroundColor: "cyan", color: "black", children: padded }));
        }
        return (_jsx(Text, { color: "white", children: padded }));
    };
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Box, { width: indicatorWidth, children: _jsx(Text, { children: " " }) }), headers.map((header, i) => (_jsx(Box, { width: widths[i], children: renderCell(header, widths[i], true, false) }, i)))] }), _jsx(Box, { children: _jsxs(Text, { color: "gray", children: [' '.repeat(indicatorWidth), widths.map((w) => '-'.repeat(w)).join('')] }) }), rows.map((row, rowIndex) => {
                const isSelected = rowIndex === selectedIndex;
                const isHighlighted = isSelected && isFocused;
                return (_jsxs(Box, { children: [_jsx(Box, { width: indicatorWidth, children: _jsx(Text, { color: isHighlighted ? 'cyan' : undefined, children: isHighlighted ? '▶ ' : '  ' }) }), row.map((cell, cellIndex) => (_jsx(Box, { width: widths[cellIndex], children: renderCell(cell, widths[cellIndex], false, isHighlighted) }, cellIndex)))] }, rowIndex));
            }), hint && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: hint }) }))] }));
}
