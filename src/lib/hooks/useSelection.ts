'use client';

import { useState, useCallback } from 'react';

/**
 * Hook for managing multi-selection state across list views.
 * Supports select all, clear, toggle individual items.
 */
export function useSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allIds = new Set(items.map((i) => i.id));
    setSelectedIds((prev) => (prev.size === allIds.size ? new Set() : allIds));
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const isAllSelected =
    items.length > 0 && selectedIds.size === items.length;
  const isSomeSelected = selectedIds.size > 0;

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    toggle,
    toggleAll,
    clear,
    selectAll,
    isSelected,
    isAllSelected,
    isSomeSelected,
  };
}
