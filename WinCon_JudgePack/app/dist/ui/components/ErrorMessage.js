import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function ErrorMessage({ message }) {
    return (_jsx(Box, { paddingX: 1, borderStyle: "single", borderColor: "red", children: _jsxs(Text, { color: "red", children: ["Error: ", message] }) }));
}
