'use client';

import { Button } from './Button';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void | Promise<void>;
  onBulkAction?: (action: string) => void | Promise<void>;
  itemLabel?: string;
  className?: string;
  isDeleting?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClear,
  onDelete,
  onBulkAction,
  itemLabel = 'items',
  className = '',
  isDeleting = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="text-small font-medium text-[var(--color-text)]">
        {selectedCount} {itemLabel} selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onClear} disabled={isDeleting}>
          Clear
        </Button>
        {onDelete && (
          <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting} isLoading={isDeleting}>
            Delete {selectedCount}
          </Button>
        )}
      </div>
    </div>
  );
}
