import React from 'react';
interface SelectableTableProps<T> {
    headers: string[];
    rows: string[][];
    data: T[];
    onSelect: (item: T, index: number) => void;
    columnWidths?: number[];
    isFocused?: boolean;
    hint?: string;
    resetKey?: string;
}
export declare function SelectableTable<T>({ headers, rows, data, onSelect, columnWidths, isFocused, hint, resetKey, }: SelectableTableProps<T>): React.ReactElement;
export {};
