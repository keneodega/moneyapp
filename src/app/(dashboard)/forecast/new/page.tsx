'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LifeEventService } from '@/lib/services';
import { LifeEventCategory, LifeEventStatus, DateConfidence } from '@/lib/supabase/database.types';

const CATEGORY_OPTIONS = [
  { value: 'baby', label: '👶 Baby' },
  { value: 'property', label: '🏠 Property' },
  { value: 'vehicle', label: '🚗 Vehicle' },
  { value: 'career', label: '💼 Career' },
  { value: 'education', label: '🎓 Education' },
  { value: 'other', label: '📋 Other' },
];

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DATE_CONFIDENCE_OPTIONS = [
  { value: 'month', label: 'Specific month' },
  { value: 'quarter', label: 'Approximate quarter' },
  { value: 'year', label: 'Approximate year' },
];

interface FormData {
  name: string;
  description: string;
  category: LifeEventCategory;
  expected_date: string;
  date_confidence: DateConfidence;
  status: LifeEventStatus;
  one_time_cost: string;
  one_time_income: string;
  recurring_monthly_change: string;
  recurring_description: string;
  income_monthly_change: string;
  income_change_duration_months: string;
  income_change_description: string;
  linked_goal_id: string;
  notes: string;
}

const DEFAULT_FORM: FormData = {
  name: '',
  description: '',
  category: 'other',
  expected_date: new Date().toISOString().split('T')[0],
  date_confidence: 'month',
  status: 'planned',
  one_time_cost: '',
  one_time_income: '',
  recurring_monthly_change: '',
  recurring_description: '',
  income_monthly_change: '',
  income_change_duration_months: '',
  income_change_description: '',
  linked_goal_id: '',
  notes: '',
};

export default function NewLifeEventPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [goals, setGoals] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const service = new LifeEventService(supabase);
    service.getGoals().then(setGoals).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Event name is required.');
      return;
    }
    if (!formData.expected_date) {
      setError('Expected date is required.');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createSupabaseBrowserClient();
      const service = new LifeEventService(supabase);

      await service.create({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        expected_date: formData.expected_date,
        date_confidence: formData.date_confidence,
        status: formData.status,
        one_time_cost: parseFloat(formData.one_time_cost) || 0,
        one_time_income: parseFloat(formData.one_time_income) || 0,
        recurring_monthly_change: parseFloat(formData.recurring_monthly_change) || 0,
        recurring_description: formData.recurring_description.trim() || null,
        income_monthly_change: parseFloat(formData.income_monthly_change) || 0,
        income_change_duration_months: parseInt(formData.income_change_duration_months) || null,
        income_change_description: formData.income_change_description.trim() || null,
        linked_goal_id: formData.linked_goal_id || null,
        notes: formData.notes.trim() || null,
      });

      router.push('/forecast');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create life event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasRecurring = formData.recurring_monthly_change !== '' && parseFloat(formData.recurring_monthly_change) !== 0;
  const hasIncomeChange = formData.income_monthly_change !== '' && parseFloat(formData.income_monthly_change) !== 0;

  const goalOptions = [
    { value: '', label: 'None' },
    ...goals.map(g => ({ value: g.id, label: g.name })),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Add Life Event"
        subtitle="Plan a major milestone and capture its financial impact"
        actions={
          <Link href="/forecast">
            <Button variant="secondary" size="sm">Cancel</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-small text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <Card variant="outlined" padding="lg">
            <h2 className="text-title text-[var(--color-text)] mb-4">Event Details</h2>
            <div className="space-y-4">
              <Input
                label="Event name *"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. First Baby, New House, Car Replacement"
                required
              />
              <Textarea
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Optional notes about this event"
                rows={2}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  options={CATEGORY_OPTIONS}
                />
                <Select
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={STATUS_OPTIONS}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Expected date *"
                  name="expected_date"
                  type="date"
                  value={formData.expected_date}
                  onChange={handleChange}
                  required
                />
                <Select
                  label="How precise is this date?"
                  name="date_confidence"
                  value={formData.date_confidence}
                  onChange={handleChange}
                  options={DATE_CONFIDENCE_OPTIONS}
                />
              </div>
            </div>
          </Card>

          {/* One-time financial impact */}
          <Card variant="outlined" padding="lg">
            <h2 className="text-title text-[var(--color-text)] mb-1">One-Time Financial Impact</h2>
            <p className="text-small text-[var(--color-text-muted)] mb-4">
              Lump sums that happen at the time of the event (leave blank if none).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="One-time cost (€)"
                name="one_time_cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.one_time_cost}
                onChange={handleChange}
                placeholder="e.g. 30000 for a car, 5000 hospital"
              />
              <Input
                label="One-time income (€)"
                name="one_time_income"
                type="number"
                min="0"
                step="0.01"
                value={formData.one_time_income}
                onChange={handleChange}
                placeholder="e.g. 8000 car trade-in"
              />
            </div>
          </Card>

          {/* Recurring monthly change */}
          <Card variant="outlined" padding="lg">
            <h2 className="text-title text-[var(--color-text)] mb-1">Ongoing Monthly Impact</h2>
            <p className="text-small text-[var(--color-text-muted)] mb-4">
              How will your monthly budget change permanently after this event? Use a positive number for new costs, negative for costs that go away (e.g. rent replaced by mortgage).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Monthly change (€)"
                name="recurring_monthly_change"
                type="number"
                step="0.01"
                value={formData.recurring_monthly_change}
                onChange={handleChange}
                placeholder="e.g. 900 for childcare, -200 if a cost goes away"
              />
              {hasRecurring && (
                <Input
                  label="Label"
                  name="recurring_description"
                  value={formData.recurring_description}
                  onChange={handleChange}
                  placeholder="e.g. Childcare, Mortgage replaces rent"
                />
              )}
            </div>
          </Card>

          {/* Income change */}
          <Card variant="outlined" padding="lg">
            <h2 className="text-title text-[var(--color-text)] mb-1">Income Change</h2>
            <p className="text-small text-[var(--color-text-muted)] mb-4">
              Will your income change after this event? Use a negative number for a reduction (e.g. maternity leave) or positive for an increase.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Monthly income change (€)"
                name="income_monthly_change"
                type="number"
                step="0.01"
                value={formData.income_monthly_change}
                onChange={handleChange}
                placeholder="e.g. -1500 for maternity leave"
              />
              {hasIncomeChange && (
                <>
                  <Input
                    label="Duration (months, blank = permanent)"
                    name="income_change_duration_months"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.income_change_duration_months}
                    onChange={handleChange}
                    placeholder="e.g. 6"
                  />
                  <Input
                    label="Label"
                    name="income_change_description"
                    value={formData.income_change_description}
                    onChange={handleChange}
                    placeholder="e.g. Maternity leave"
                  />
                </>
              )}
            </div>
          </Card>

          {/* Link to goal + notes */}
          <Card variant="outlined" padding="lg">
            <h2 className="text-title text-[var(--color-text)] mb-4">Additional</h2>
            <div className="space-y-4">
              {goalOptions.length > 1 && (
                <Select
                  label="Link to savings goal (optional)"
                  name="linked_goal_id"
                  value={formData.linked_goal_id}
                  onChange={handleChange}
                  options={goalOptions}
                />
              )}
              <Textarea
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional context or plans"
                rows={3}
              />
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/forecast">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Event'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
