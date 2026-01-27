'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Skeleton, SkeletonList, useToast, useConfirmDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MasterBudgetService } from '@/lib/services';
import type { MasterBudget } from '@/lib/services/master-budget.service';

export default function MasterBudgetsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  const [budgets, setBudgets] = useState<MasterBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    budget_amount: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const masterBudgetService = new MasterBudgetService(supabase);
      const data = await masterBudgetService.getAll(true);
      setBudgets(data);
    } catch (err) {
      console.error('Failed to load master budgets:', err);
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to load master budgets',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const masterBudgetService = new MasterBudgetService(supabase);

      await masterBudgetService.create({
        name: formData.name.trim(),
        budget_amount: parseFloat(formData.budget_amount) || 0,
        description: formData.description.trim() || null,
      });

      setFormData({ name: '', budget_amount: '', description: '' });
      setShowAddForm(false);
      await loadBudgets();
      toast.showToast('Master budget created successfully', 'success');
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to create master budget',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string, updates: { name?: string; budget_amount?: number; description?: string | null }) => {
    setSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const masterBudgetService = new MasterBudgetService(supabase);

      await masterBudgetService.update(id, updates);
      setEditingId(null);
      await loadBudgets();
      toast.showToast('Master budget updated successfully', 'success');
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to update master budget',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog.showConfirm({
      title: 'Delete Master Budget',
      message: 'Are you sure you want to delete this master budget? This will not affect existing monthly budgets, but new months will not include this category.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setSaving(true);
        try {
          const supabase = createSupabaseBrowserClient();
          const masterBudgetService = new MasterBudgetService(supabase);

          await masterBudgetService.delete(id, true);
          await loadBudgets();
          toast.showToast('Master budget deleted successfully', 'success');
        } catch (err) {
          toast.showToast(
            err instanceof Error ? err.message : 'Failed to delete master budget',
            'error'
          );
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const totalAmount = budgets.reduce((sum, b) => sum + Number(b.budget_amount || 0), 0);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <Skeleton variant="text" width="40%" height={40} className="mb-2" />
          <Skeleton variant="text" width="60%" height={20} />
        </div>
        <Card variant="raised" padding="md">
          <Skeleton variant="text" width="30%" height={24} />
        </Card>
        <SkeletonList items={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display text-[var(--color-text)]">Master Budgets</h1>
        <p className="text-body text-[var(--color-text-muted)] mt-1">
          Manage your baseline budget categories. These amounts are copied to each new month.
        </p>
      </div>

      {/* Total Summary */}
      <Card variant="raised" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-small text-[var(--color-text-muted)]">Total Master Budget</p>
            <p className="text-display text-[var(--color-text)] mt-1">€{totalAmount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="primary"
          >
            <PlusIcon className="w-5 h-5" />
            Add Budget Category
          </Button>
        </div>
      </Card>

      {/* Add Form */}
      {showAddForm && (
        <Card variant="raised" padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Category Name"
                name="name"
                placeholder="e.g., Food, Housing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Budget Amount (€)"
                name="budget_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.budget_amount}
                onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                required
              />
            </div>
            <Input
              label="Description (Optional)"
              name="description"
              placeholder="Brief description of this budget category"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', budget_amount: '', description: '' });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={saving}>
                Add Budget
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Budgets List */}
      {budgets.length === 0 ? (
        <Card variant="raised" padding="lg">
          <p className="text-body text-[var(--color-text-muted)] text-center py-8">
            No master budgets yet. Click "Add Budget Category" to create your first one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <Card key={budget.id} variant="raised" padding="md">
              {editingId === budget.id ? (
                <EditForm
                  budget={budget}
                  onSave={(updates) => handleEdit(budget.id, updates)}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-headline text-[var(--color-text)]">{budget.name}</h3>
                      <span className="text-body font-medium text-[var(--color-text)]">
                        €{Number(budget.budget_amount).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {budget.description && (
                      <p className="text-small text-[var(--color-text-muted)] mt-1">
                        {budget.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(budget.id)}
                      disabled={saving}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(budget.id)}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EditForm({
  budget,
  onSave,
  onCancel,
  saving,
}: {
  budget: MasterBudget;
  onSave: (updates: { name?: string; budget_amount?: number; description?: string | null }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState({
    name: budget.name,
    budget_amount: budget.budget_amount.toString(),
    description: budget.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name.trim(),
      budget_amount: parseFloat(formData.budget_amount) || 0,
      description: formData.description.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Category Name"
          name="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Budget Amount (€)"
          name="budget_amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.budget_amount}
          onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
          required
        />
      </div>
      <Input
        label="Description (Optional)"
        name="description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" isLoading={saving}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
