import React from 'react';
import SelectInput from 'ink-select-input';

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

export function SelectList<T>({
  items,
  onSelect,
  limit = 10,
}: SelectListProps<T>): React.ReactElement {
  // ink-select-input falls back to using `value` as React key. Our values are often objects,
  // so provide a stable explicit key to avoid duplicate `[object Object]` keys.
  const keyedItems = React.useMemo(
    () => items.map((item, index) => ({
      ...item,
      key: item.key ?? `${index}:${item.label}`,
    })),
    [items]
  );

  return (
    <SelectInput
      items={keyedItems}
      onSelect={onSelect}
      limit={limit}
    />
  );
}
