'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService, MasterBudgetService } from '@/lib/services';
import type { MasterBudget } from '@/lib/services/master-budget.service';

export default function NewBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterBudgets, setMasterBudgets] = useState<MasterBudget[]>([]);
  const [existingBudgetNames, setExistingBudgetNames] = useState<string[]>([]);
  const [loadingMasterBudgets, setLoadingMasterBudgets] = useState(true);
  const [formData, setFormData] = useState({
    master_budget_id: '',
    budget_amount: '',
  });
  const [selectedMasterBudget, setSelectedMasterBudget] = useState<MasterBudget | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        // Load master budgets
        const masterBudgetService = new MasterBudgetService(supabase);
        const masterData = await masterBudgetService.getAll(true);
        setMasterBudgets(masterData);

        // Load existing budget names for this month to filter out
        const { data: existingBudgets } = await supabase
          .from('budgets')
          .select('name, master_budget_id')
          .eq('monthly_overview_id', monthId);
        
        setExistingBudgetNames(existingBudgets?.map(b => b.name) || []);
      } catch (err) {
        console.error('Failed to load master budgets:', err);
      } finally {
        setLoadingMasterBudgets(false);
      }
    }

    loadData();
  }, [monthId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'master_budget_id') {
      const selected = masterBudgets.find(mb => mb.id === value);
      setSelectedMasterBudget(selected || null);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        budget_amount: selected ? selected.budget_amount.toString() : '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        setIsLoading(false);
        return;
      }

      if (!formData.master_budget_id) {
        setError('Please select a master budget category');
        setIsLoading(false);
        return;
      }

      if (!selectedMasterBudget) {
        setError('Selected master budget not found');
        setIsLoading(false);
        return;
      }

      // Check if this master budget is already used in this month
      const { data: existing } = await supabase
        .from('budgets')
        .select('id, name')
        .eq('monthly_overview_id', monthId)
        .eq('master_budget_id', formData.master_budget_id)
        .maybeSingle();

      if (existing) {
        setError(`The budget category "${selectedMasterBudget.name}" already exists for this month. Please edit the existing budget instead.`);
        setIsLoading(false);
        return;
      }

      const budgetService = new BudgetService(supabase);

      await budgetService.create({
        monthly_overview_id: monthId,
        name: selectedMasterBudget.name,
        budget_amount: parseFloat(formData.budget_amount) || selectedMasterBudget.budget_amount,
        master_budget_id: formData.master_budget_id,
        description: selectedMasterBudget.description || null,
      });

      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/months/${monthId}`}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Add Budget Category</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Select a master budget category to add to this month
          </p>
        </div>
      </div>

      {/* Form */}
      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {loadingMasterBudgets ? (
            <div className="text-center py-8">
              <p className="text-body text-[var(--color-text-muted)]">Loading master budgets...</p>
            </div>
          ) : masterBudgets.length === 0 ? (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
              <p className="text-small text-[var(--color-warning)]">
                No master budgets found. Please create master budgets first in the{' '}
                <Link href="/master-budgets" className="underline">Master Budgets</Link> page.
              </p>
            </div>
          ) : (
            <>
              {/* Master Budget Selection */}
              <div>
                <label className="block text-small font-medium text-[var(--color-text)] mb-2">
                  Select Master Budget Category <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  name="master_budget_id"
                  value={formData.master_budget_id}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] text-body text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                >
                  <option value="">-- Select a budget category --</option>
                  {masterBudgets
                    .filter(mb => !existingBudgetNames.includes(mb.name))
                    .map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.name} - €{mb.budget_amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </option>
                    ))}
                </select>
                {existingBudgetNames.length > 0 && (
                  <p className="text-caption text-[var(--color-text-muted)] mt-1">
                    {masterBudgets.filter(mb => existingBudgetNames.includes(mb.name)).length} master budget(s) already added to this month
                  </p>
                )}
                {selectedMasterBudget?.description && (
                  <p className="text-small text-[var(--color-text-muted)] mt-1">
                    {selectedMasterBudget.description}
                  </p>
                )}
              </div>

              {/* Budget Amount */}
              <Input
                label="Budget Amount (€)"
                name="budget_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder={selectedMasterBudget ? selectedMasterBudget.budget_amount.toString() : "0.00"}
                value={formData.budget_amount}
                onChange={handleChange}
                required
                hint={
                  selectedMasterBudget
                    ? `Default amount from master budget: €${selectedMasterBudget.budget_amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. You can override this amount.`
                    : "Amount will be set from selected master budget"
                }
              />
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href={`/months/${monthId}`}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="flex-1"
            >
              <PlusIcon className="w-5 h-5" />
              Add Budget
            </Button>
          </div>
        </form>
      </Card>
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
