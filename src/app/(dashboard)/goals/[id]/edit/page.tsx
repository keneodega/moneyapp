'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FinancialGoalService } from '@/lib/services';
import { ValidationError, NotFoundError } from '@/lib/services/errors';

const STATUS_OPTIONS = [
  { value: 'Not Started', label: 'Not Started' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' },
];

const GOAL_TYPE_OPTIONS = [
  { value: '', label: 'Select type...' },
  { value: 'Emergency Fund', label: 'Emergency Fund' },
  { value: 'Vacation', label: 'Vacation' },
  { value: 'Home', label: 'Home' },
  { value: 'Car', label: 'Car' },
  { value: 'Education', label: 'Education' },
  { value: 'Wedding', label: 'Wedding' },
  { value: 'Retirement', label: 'Retirement' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Other', label: 'Other' },
];

const PERSON_OPTIONS = [
  { value: '', label: 'Select person...' },
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

const FREQUENCY_OPTIONS = [
  { value: '', label: 'Select frequency...' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Bi-Weekly', label: 'Bi-Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Bi-Annually', label: 'Bi-Annually' },
  { value: 'Annually', label: 'Annually' },
  { value: 'One-Time', label: 'One-Time' },
];

export default function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [goalId, setGoalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    start_date: '',
    end_date: '',
    status: 'Not Started',
    priority: 'Medium',
    goal_type: '',
    person: '',
    estimated_contributions: '',
    estimated_frequency: '',
    description: '',
    product_link: '',
  });

  useEffect(() => {
    async function loadGoal() {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setGoalId(id);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if ( !user) {
          router.push('/goals');
          return;
        }

        const goalService = new FinancialGoalService(supabase);
        const goal = await goalService.getById(id);

        setFormData({
          name: goal.name,
          target_amount: goal.target_amount.toString(),
          current_amount: goal.current_amount.toString(),
          start_date: goal.start_date,
          end_date: goal.end_date || '',
          status: goal.status,
          priority: goal.priority,
          goal_type: goal.goal_type || '',
          person: goal.person || '',
          estimated_contributions: goal.estimated_contributions?.toString() || '',
          estimated_frequency: goal.estimated_frequency || '',
          description: goal.description || '',
          product_link: goal.product_link || '',
        });
      } catch (err) {
        if (err instanceof NotFoundError) {
          setError('Goal not found');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load goal');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadGoal();
  }, [params, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ( !goalId) return;

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if ( !user) {
        router.push('/goals');
        return;
      }

      const goalService = new FinancialGoalService(supabase);

      await goalService.update(goalId, {
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount) || 0,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: formData.status as any,
        priority: formData.priority as any,
        goal_type: formData.goal_type ? (formData.goal_type as any) : null,
        person: formData.person ? (formData.person as any) : null,
        estimated_contributions: formData.estimated_contributions ? parseFloat(formData.estimated_contributions) : null,
        estimated_frequency: formData.estimated_frequency ? (formData.estimated_frequency as any) : null,
        description: formData.description || null,
        product_link: formData.product_link || null,
      });

      router.push(`/goals/${goalId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update goal');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading goal...</p>
        </Card>
      </div>
    );
  }

  if (error && !goalId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <h2 className="text-headline text-[var(--color-text)] mb-2">Error</h2>
          <p className="text-body text-[var(--color-text-muted)] mb-6">{error}</p>
          <Link
            href="/goals"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Back to Goals
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={goalId ? `/goals/${goalId}` : '/goals'}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Edit Goal</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Update goal details
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

          {/* Name */}
          <Input
            label="Goal Name"
            name="name"
            placeholder="e.g., Emergency Fund, Vacation to Paris"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Target Amount */}
          <Input
            label="Target Amount"
            name="target_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.target_amount}
            onChange={handleChange}
            required
          />

          {/* Current Amount */}
          <Input
            label="Current Amount"
            name="current_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.current_amount}
            onChange={handleChange}
            hint="How much you've saved so far"
          />

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start Date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleChange}
              required
            />
            <Input
              label="End Date (Optional)"
              name="end_date"
              type="date"
              value={formData.end_date}
              onChange={handleChange}
              hint="Must be after start date"
            />
          </div>

          {/* Status and Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Status"
              name="status"
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={handleChange}
            />
            <Select
              label="Priority"
              name="priority"
              options={PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={handleChange}
            />
          </div>

          {/* Goal Type and Person */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Goal Type"
              name="goal_type"
              options={GOAL_TYPE_OPTIONS}
              value={formData.goal_type}
              onChange={handleChange}
            />
            <Select
              label="Person"
              name="person"
              options={PERSON_OPTIONS}
              value={formData.person}
              onChange={handleChange}
            />
          </div>

          {/* Estimated Contributions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Estimated Contributions"
              name="estimated_contributions"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.estimated_contributions}
              onChange={handleChange}
              hint="Expected monthly contribution"
            />
            <Select
              label="Contribution Frequency"
              name="estimated_frequency"
              options={FREQUENCY_OPTIONS}
              value={formData.estimated_frequency}
              onChange={handleChange}
            />
          </div>

          {/* Description */}
          <Textarea
            label="Description (Optional)"
            name="description"
            placeholder="Add any notes about this goal..."
            value={formData.description}
            onChange={handleChange}
            rows={4}
          />

          {/* Product Link */}
          <Input
            label="Product Link (Optional)"
            name="product_link"
            type="url"
            placeholder="https://..."
            value={formData.product_link}
            onChange={handleChange}
            hint="Link to the product or item you're saving for"
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href={goalId ? `/goals/${goalId}` : '/goals'}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              size="lg"
              isLoading={isSaving}
              className="flex-1"
            >
              Save Changes
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
