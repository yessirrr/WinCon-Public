import React from 'react';
export interface SelectItem<T = string> {
    key?: string;
    label: string;
    value: T;
}
interface SelectListProps<T> {
    items: SelectItem<T>[];
    onSelect: (item: SelectItem<T>) => void;
    limit?: number;
}
export declare function SelectList<T>({ items, onSelect, limit, }: SelectListProps<T>): React.ReactElement;
export {};
