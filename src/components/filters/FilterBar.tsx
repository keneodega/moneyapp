'use client';

import { useState, useCallback } from 'react';
import { Button, Select } from '@/components/ui';

export type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';

export interface FilterOptions {
  dateRange?: {
    start: Date;
    end: Date;
  };
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: SortOption;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
  categories?: Array<{ value: string; label: string }>;
  showDateRange?: boolean;
  showCategory?: boolean;
  showAmount?: boolean;
  showSort?: boolean;
}

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date (Newest)' },
  { value: 'date_asc', label: 'Date (Oldest)' },
  { value: 'amount_desc', label: 'Amount (High to Low)' },
  { value: 'amount_asc', label: 'Amount (Low to High)' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
];

export function FilterBar({
  onFilterChange,
  categories = [],
  showDateRange = true,
  showCategory = true,
  showAmount = true,
  showSort = true,
}: FilterBarProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: 'date_desc',
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = useCallback((key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const clearFilters = useCallback(() => {
    const clearedFilters: FilterOptions = { sortBy: 'date_desc' };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  }, [onFilterChange]);

  const hasActiveFilters = filters.category || filters.minAmount || filters.maxAmount || filters.dateRange;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {showSort && (
          <Select
            label="Sort By"
            value={filters.sortBy || 'date_desc'}
            onChange={(e) => updateFilter('sortBy', e.target.value as SortOption)}
            options={SORT_OPTIONS}
            className="min-w-[180px]"
          />
        )}
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="min-h-[44px]"
        >
          <FilterIcon className="w-4 h-4" />
          Filters {hasActiveFilters && `(${Object.keys(filters).filter(k => k !== 'sortBy' && filters[k as keyof FilterOptions]).length})`}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="min-h-[44px]"
          >
            Clear
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[var(--color-surface-sunken)] rounded-[var(--radius-md)]">
          {showCategory && categories.length > 0 && (
            <Select
              label="Category"
              value={filters.category || ''}
              onChange={(e) => updateFilter('category', e.target.value || undefined)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories,
              ]}
            />
          )}

          {showAmount && (
            <>
              <div>
                <label className="text-small font-medium text-[var(--color-text)] block mb-1.5">
                  Min Amount
                </label>
                <input
                  type="number"
                  value={filters.minAmount || ''}
                  onChange={(e) => updateFilter('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="€0.00"
                  className="w-full min-h-[44px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
              <div>
                <label className="text-small font-medium text-[var(--color-text)] block mb-1.5">
                  Max Amount
                </label>
                <input
                  type="number"
                  value={filters.maxAmount || ''}
                  onChange={(e) => updateFilter('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="€0.00"
                  className="w-full min-h-[44px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            </>
          )}

          {showDateRange && (
            <>
              <div>
                <label className="text-small font-medium text-[var(--color-text)] block mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.start.toISOString().split('T')[0] || ''}
                  onChange={(e) => {
                    const start = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', start && filters.dateRange?.end ? { start, end: filters.dateRange.end } : start ? { start, end: new Date() } : undefined);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
              <div>
                <label className="text-small font-medium text-[var(--color-text)] block mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.end.toISOString().split('T')[0] || ''}
                  onChange={(e) => {
                    const end = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', end && filters.dateRange?.start ? { start: filters.dateRange.start, end } : undefined);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}
