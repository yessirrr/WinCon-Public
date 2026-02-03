import React from 'react';
interface TableProps {
    headers: string[];
    rows: string[][];
    columnWidths?: number[];
}
export declare function Table({ headers, rows, columnWidths }: TableProps): React.ReactElement;
export {};
