'use client';

import { useState, useEffect, use, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService, MasterBudgetService } from '@/lib/services';
import type { MasterBudget } from '@/lib/services/master-budget.service';

export default function SelectBudgetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const [masterBudgets, setMasterBudgets] = useState<MasterBudget[]>([]);
  const [existingBudgetIds, setExistingBudgetIds] = useState<Set<string>>(new Set());
  const [existingBudgets, setExistingBudgets] = useState<Array<{ master_budget_id: string | null; name: string | null }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Load master budgets
      const masterBudgetService = new MasterBudgetService(supabase);
      const masterData = await masterBudgetService.getAll(true);
      
      if (!masterData || masterData.length === 0) {
        setError('No master budgets found. Please create master budgets first in the Master Budgets page.');
      }
      
      setMasterBudgets(masterData);

      // Load existing budgets for this month
      // Check both by master_budget_id and by name to catch all existing budgets
      const { data: existingBudgets, error: existingError } = await supabase
        .from('budgets')
        .select('master_budget_id, name')
        .eq('monthly_overview_id', monthId);
      
      if (existingError) {
        console.error('Error loading existing budgets:', existingError);
        // If budgets table doesn't exist, that's okay - just continue with empty list
        if (!existingError.message.includes('does not exist')) {
          throw existingError;
        }
      }
      
      // Get existing master budget IDs (filter out nulls)
      const existingMasterIds = new Set(
        existingBudgets?.map(b => b.master_budget_id).filter((id): id is string => Boolean(id)) || []
      );
      
      // Also check by name in case budgets exist without master_budget_id
      // Match master budget names to existing budget names (case-insensitive)
      const existingBudgetNames = new Set(
        existingBudgets?.map(b => b.name?.toLowerCase().trim()).filter(Boolean) || []
      );
      
      // Find master budgets that match existing budgets by name (for backwards compatibility)
      // This handles budgets created before master budgets system or manually created budgets
      const matchedMasterIds = masterData
        .filter(mb => {
          const masterName = mb.name?.toLowerCase().trim();
          return masterName && existingBudgetNames.has(masterName);
        })
        .map(mb => mb.id);
      
      // Combine both sets - budgets that exist by master_budget_id OR by name match
      const allExistingIds = new Set([...existingMasterIds, ...matchedMasterIds]);
      setExistingBudgetIds(allExistingIds);
      // Also store the full existing budgets data for name matching in the filter
      setExistingBudgets(existingBudgets || []);
      
      // Log for debugging
      if (allExistingIds.size > 0 || (existingBudgets && existingBudgets.length > 0)) {
        console.log('Found existing budgets:', {
          byMasterId: Array.from(existingMasterIds),
          byName: Array.from(matchedMasterIds),
          total: allExistingIds.size,
          existingCount: existingBudgets?.length || 0
        });
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load master budgets');
    } finally {
      setIsLoading(false);
    }
  }, [monthId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter budgets: check both by master_budget_id and by name match
  const availableBudgets = useMemo(() => {
    return masterBudgets.filter(mb => {
      // Check if exists by master_budget_id
      if (existingBudgetIds.has(mb.id)) {
        return false;
      }
      // Also check if a budget with the same name already exists (case-insensitive)
      // This handles budgets created before master budgets system
      const existingBudgetsData = existingBudgets || [];
      const nameMatch = existingBudgetsData.some(
        b => b.name?.toLowerCase().trim() === mb.name.toLowerCase().trim()
      );
      return !nameMatch;
    });
  }, [masterBudgets, existingBudgetIds, existingBudgets]);

  const toggleSelection = (masterBudgetId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(masterBudgetId)) {
        newSet.delete(masterBudgetId);
      } else {
        newSet.add(masterBudgetId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = useCallback(() => {
    const allSelected = availableBudgets.length > 0 && availableBudgets.every(mb => selectedIds.has(mb.id));
    
    if (allSelected) {
      // Deselect all available budgets
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        availableBudgets.forEach(mb => newSet.delete(mb.id));
        return newSet;
      });
    } else {
      // Select all available budgets
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        availableBudgets.forEach(mb => newSet.add(mb.id));
        return newSet;
      });
    }
  }, [availableBudgets, selectedIds]);

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one budget to add');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        setIsSaving(false);
        return;
      }

      const budgetService = new BudgetService(supabase);
      const selectedBudgets = masterBudgets.filter(mb => selectedIds.has(mb.id));

      if (selectedBudgets.length === 0) {
        setError('No budgets selected');
        setIsSaving(false);
        return;
      }

      // Create budgets for selected master budgets one by one to get better error messages
      const created: string[] = [];
      const failed: Array<{ name: string; error: string }> = [];

      for (const masterBudget of selectedBudgets) {
        // Double-check if already exists (in case it was added between load and submit)
        // Check both by master_budget_id and by name
        const existsByMasterId = existingBudgetIds.has(masterBudget.id);
        const existsByName = existingBudgets?.some(
          b => b.name?.toLowerCase().trim() === masterBudget.name.toLowerCase().trim()
        );
        
        if (existsByMasterId || existsByName) {
          console.log(`Skipping ${masterBudget.name} - already exists (by master_id: ${existsByMasterId}, by name: ${existsByName})`);
          continue; // Skip if already added
        }

        try {
          await budgetService.create({
            monthly_overview_id: monthId,
            name: masterBudget.name,
            budget_amount: masterBudget.budget_amount,
            master_budget_id: masterBudget.id,
            description: masterBudget.description || null,
          });
          created.push(masterBudget.name);
        } catch (err) {
          console.error(`Failed to create budget ${masterBudget.name}:`, err);
          // If error is about duplicate name, skip it (might have been added by another user/session)
          if (err instanceof Error && err.message.includes('already exists')) {
            console.log(`Budget ${masterBudget.name} already exists, skipping`);
            continue;
          }
          failed.push({
            name: masterBudget.name,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // Show results
      if (failed.length > 0) {
        const errorMsg = failed.length === selectedBudgets.length
          ? `Failed to add budgets: ${failed.map(f => `${f.name} (${f.error})`).join(', ')}`
          : `Added ${created.length} budget(s). Failed: ${failed.map(f => `${f.name} (${f.error})`).join(', ')}`;
        setError(errorMsg);
        setIsSaving(false);
        return;
      }

      if (created.length === 0) {
        setError('No new budgets were added. They may already exist in this month.');
        setIsSaving(false);
        return;
      }

      // Refresh the page to show new budgets
      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      console.error('Error adding budgets:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add budgets';
      setError(errorMessage);
      // Don't redirect on error so user can see the error message
    } finally {
      setIsSaving(false);
    }
  };
  
  const alreadyAdded = masterBudgets.filter(mb => {
    // Check if exists by master_budget_id
    if (existingBudgetIds.has(mb.id)) {
      return true;
    }
    // Also check if a budget with the same name already exists
    const existingBudgetsData = existingBudgets || [];
    return existingBudgetsData.some(
      b => b.name?.toLowerCase().trim() === mb.name.toLowerCase().trim()
    );
  });

  // Calculate select all state
  const allSelected = availableBudgets.length > 0 && availableBudgets.every(mb => selectedIds.has(mb.id));
  const someSelected = availableBudgets.length > 0 && availableBudgets.some(mb => selectedIds.has(mb.id)) && !allSelected;

  // Update indeterminate state of select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <p className="text-body text-[var(--color-text-muted)]">Loading master budgets...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/months/${monthId}`}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Select Budgets</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Choose which master budgets to include in this month
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card variant="raised" padding="md" className="border border-[var(--color-danger)]">
          <p className="text-small text-[var(--color-danger)]">{error}</p>
        </Card>
      )}

      {/* Already Added Section */}
      {alreadyAdded.length > 0 && (
        <Card variant="outlined" padding="md">
          <h3 className="text-body font-medium text-[var(--color-text)] mb-3">
            Already Added ({alreadyAdded.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {alreadyAdded.map((mb) => (
              <span
                key={mb.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-sunken)] text-small text-[var(--color-text)]"
              >
                {mb.name}
                <span className="text-[var(--color-text-muted)]">
                  €{mb.budget_amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Available Budgets */}
      {availableBudgets.length === 0 ? (
        <Card variant="raised" padding="lg">
          <div className="text-center space-y-4">
            <p className="text-body text-[var(--color-text-muted)]">
              All master budgets have been added to this month.
            </p>
            <p className="text-small text-[var(--color-text-muted)]">
              To add more budgets, create them in the{' '}
              <Link href="/master-budgets" className="text-[var(--color-primary)] hover:underline">
                Master Budgets
              </Link>{' '}
              page.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card variant="raised" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-body font-medium text-[var(--color-text)]">
                  Available Master Budgets ({availableBudgets.length})
                </h3>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Select the budgets you want to include in this month. You can add more later.
                </p>
              </div>
            </div>
            
            {/* Select All Checkbox */}
            {availableBudgets.length > 0 && (
              <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                <label className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary)]/5 transition-colors min-h-[44px] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                  />
                  <span className="text-body font-medium text-[var(--color-text)]">
                    Select All ({selectedIds.size} of {availableBudgets.length} selected)
                  </span>
                </label>
              </div>
            )}
            
            <div className="space-y-2">
              {availableBudgets.map((mb) => {
                const isSelected = selectedIds.has(mb.id);
                return (
                  <label
                    key={mb.id}
                    className={`flex items-center gap-3 p-4 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(mb.id)}
                      className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-body font-medium text-[var(--color-text)]">
                          {mb.name}
                        </span>
                        <span className="text-body font-medium text-[var(--color-text)]">
                          €{mb.budget_amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {mb.description && (
                        <p className="text-small text-[var(--color-text-muted)] mt-1">
                          {mb.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Link
              href={`/months/${monthId}`}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              onClick={handleSubmit}
              size="lg"
              isLoading={isSaving}
              disabled={selectedIds.size === 0}
              className="flex-1"
            >
              <PlusIcon className="w-5 h-5" />
              Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Budget{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
