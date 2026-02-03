import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import SelectInput from 'ink-select-input';
export function SelectList({ items, onSelect, limit = 10, }) {
    // ink-select-input falls back to using `value` as React key. Our values are often objects,
    // so provide a stable explicit key to avoid duplicate `[object Object]` keys.
    const keyedItems = React.useMemo(() => items.map((item, index) => ({
        ...item,
        key: item.key ?? `${index}:${item.label}`,
    })), [items]);
    return (_jsx(SelectInput, { items: keyedItems, onSelect: onSelect, limit: limit }));
}
