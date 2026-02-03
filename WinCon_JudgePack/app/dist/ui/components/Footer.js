import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { useStore, selectCanGoBack } from '../context/store.js';
export function Footer() {
    const canGoBack = useStore(selectCanGoBack);
    const commandMode = useStore((s) => s.commandMode);
    if (commandMode) {
        return (_jsx(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray", children: _jsxs(Text, { color: "gray", children: [_jsx(Text, { color: "yellow", children: "Enter" }), " submit | ", _jsx(Text, { color: "yellow", children: "Esc" }), " cancel"] }) }));
    }
    return (_jsx(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray", children: _jsxs(Text, { color: "gray", children: [_jsx(Text, { color: "yellow", children: "/" }), " command", canGoBack && (_jsxs(_Fragment, { children: [' | ', _jsx(Text, { color: "yellow", children: "Esc" }), " back"] })), ' | ', _jsx(Text, { color: "yellow", children: "?" }), " help", ' | ', _jsx(Text, { color: "yellow", children: "q" }), " quit"] }) }));
}
