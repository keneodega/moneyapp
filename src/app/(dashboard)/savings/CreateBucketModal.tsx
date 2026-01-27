'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Textarea, useToast } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SavingsService, FinancialGoalService } from '@/lib/services';
import { ValidationError } from '@/lib/services/errors';

interface CreateBucketModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBucketModal({ onClose, onSuccess }: CreateBucketModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    monthly_contribution: '',
    linked_goal_id: '',
    description: '',
  });

  const toast = useToast();
  const supabase = createSupabaseBrowserClient();
  const savingsService = new SavingsService(supabase);
  const goalService = new FinancialGoalService(supabase);

  useEffect(() => {
    async function loadGoals() {
      try {
        const allGoals = await goalService.getAll();
        setGoals(allGoals.map((g) => ({ id: g.id, name: g.name })));
      } catch (err) {
        console.error('Failed to load goals:', err);
      }
    }
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await savingsService.createBucket({
        name: formData.name,
        target_amount: formData.target_amount ? parseFloat(formData.target_amount) : null,
        monthly_contribution: formData.monthly_contribution
          ? parseFloat(formData.monthly_contribution)
          : null,
        linked_goal_id: formData.linked_goal_id || null,
        description: formData.description || null,
      });

      toast.success('Savings bucket created successfully');
      onSuccess();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create savings bucket');
      }
      toast.error('Failed to create savings bucket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card variant="raised" padding="lg" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-headline text-[var(--color-text)]">Create Savings Bucket</h2>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Bucket Name *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Emergency Fund, Vacation"
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Target Amount (optional)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.target_amount}
                onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Monthly Contribution (optional)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_contribution}
                onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Link to Goal (optional)
              </label>
              <Select
                value={formData.linked_goal_id}
                onChange={(e) => setFormData({ ...formData, linked_goal_id: e.target.value })}
              >
                <option value="">No goal linked</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Description (optional)
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Add notes about this savings bucket..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Bucket'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
