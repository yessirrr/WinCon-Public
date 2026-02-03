import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { Table, MomentumSection, EconIntelSection, CollapsibleTextSection } from '../components/index.js';
import { useStore } from '../context/store.js';
export function ReportViewScreen() {
    const report = useStore((s) => s.currentReport);
    if (!report) {
        return (_jsx(Box, { padding: 1, children: _jsx(Text, { color: "gray", children: "No report loaded. Use /pistol or /overview to generate a report." }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "cyan", children: report.title }), _jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [report.entityType === 'team' ? 'Team' : 'Player', ":", ' '] }), _jsx(Text, { children: report.entityName })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Generated: " }), _jsx(Text, { children: new Date(report.generatedAt).toLocaleString() })] }), report.filters && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Filters: " }), _jsx(Text, { children: [
                                    report.filters.window && `Last ${report.filters.window} matches`,
                                    report.filters.map && `Map: ${report.filters.map}`,
                                    report.filters.side && report.filters.side !== 'both' && `Side: ${report.filters.side}`,
                                ]
                                    .filter(Boolean)
                                    .join(' | ') || 'None' })] }))] }), report.sections.map((section, i) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: section.heading }), _jsx(Box, { marginTop: 0, children: _jsx(RenderContent, { content: section.content, heading: section.heading }) })] }, i))), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "Use /export to save this report as markdown" }) })] }));
}
function RenderContent({ content, heading }) {
    const renderFormattedText = (value) => {
        const lines = value.split('\n');
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
    switch (content.type) {
        case 'text':
            if (heading === 'Win Condition Summary (W)') {
                return (_jsx(CollapsibleTextSection, { value: content.value, hotkey: "w", label: "win condition summary" }));
            }
            return renderFormattedText(content.value);
        case 'bullets':
            return (_jsx(Box, { flexDirection: "column", children: content.items.map((item, i) => (_jsxs(Text, { children: ["  * ", item] }, i))) }));
        case 'table':
            return _jsx(Table, { headers: content.headers, rows: content.rows });
        case 'stat':
            return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [content.label, ": "] }), _jsx(Text, { bold: true, color: "green", children: content.value }), content.unit && _jsxs(Text, { color: "gray", children: [" ", content.unit] })] }));
        case 'momentum':
            return _jsx(MomentumSection, { data: content.data });
        case 'econ-intel':
            return _jsx(EconIntelSection, { data: content.data });
        default:
            return _jsx(Text, { color: "red", children: "Unknown content type" });
    }
}
