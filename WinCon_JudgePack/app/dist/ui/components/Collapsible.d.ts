import React from 'react';
interface CollapsibleProps {
    label: string;
    expanded: boolean;
    children: React.ReactNode;
}
export declare function Collapsible({ label, expanded, children }: CollapsibleProps): React.ReactElement;
export {};
