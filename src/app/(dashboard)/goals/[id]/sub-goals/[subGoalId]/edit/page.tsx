'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, PageHeader, Select, Textarea, DeleteButton } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FinancialGoalService, SettingsService } from '@/lib/services';
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

const DEFAULT_PERSON_OPTIONS = [
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

export default function EditSubGoalPage({
  params,
}: {
  params: Promise<{ id: string; subGoalId: string }>;
}) {
  const router = useRouter();
  const [goalId, setGoalId] = useState<string | null>(null);
  const [subGoalId, setSubGoalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personOptions, setPersonOptions] = useState([
    { value: '', label: 'Select person...' },
    ...DEFAULT_PERSON_OPTIONS,
  ]);
  const [formData, setFormData] = useState({
    name: '',
    estimated_cost: '',
    actual_cost: '',
    status: 'Not Started',
    priority: 'Medium',
    responsible_person: '',
    start_date: '',
    end_date: '',
    progress: '0',
    description: '',
    product_link: '',
    contribution_frequency: '',
  });

  useEffect(() => {
    async function loadSubGoal() {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      const subId = resolvedParams.subGoalId;
      setGoalId(id);
      setSubGoalId(subId);

      try {
        const supabase = createSupabaseBrowserClient();

        // Load people from settings
        const settingsService = new SettingsService(supabase);
        const people = await settingsService.getPeople();
        if (people.length > 0) {
          setPersonOptions([
            { value: '', label: 'Select person...' },
            ...people,
          ]);
        }
        const { data: { user } } = await supabase.auth.getUser();

        if ( !user) {
          router.push('/goals');
          return;
        }

        const goalService = new FinancialGoalService(supabase);
        const goal = await goalService.getById(id);
        const subGoal = goal.sub_goals?.find(sg => sg.id === subId);

        if ( !subGoal) {
          setError('Sub-goal not found');
          setIsLoading(false);
          return;
        }

        setFormData({
          name: subGoal.name,
          estimated_cost: subGoal.estimated_cost?.toString() || '',
          actual_cost: subGoal.actual_cost?.toString() || '',
          status: subGoal.status,
          priority: subGoal.priority,
          responsible_person: subGoal.responsible_person || '',
          start_date: subGoal.start_date || '',
          end_date: subGoal.end_date || '',
          progress: subGoal.progress.toString(),
          description: subGoal.description || '',
          product_link: subGoal.product_link || '',
          contribution_frequency: subGoal.contribution_frequency || '',
        });
      } catch (err) {
        if (err instanceof NotFoundError) {
          setError('Sub-goal not found');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load sub-goal');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSubGoal();
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
    if ( !subGoalId) return;

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

      await goalService.updateSubGoal(subGoalId, {
        name: formData.name,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
        status: formData.status as any,
        priority: formData.priority as any,
        responsible_person: formData.responsible_person ? (formData.responsible_person as any) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        progress: parseFloat(formData.progress) || 0,
        description: formData.description || null,
        product_link: formData.product_link || null,
        contribution_frequency: formData.contribution_frequency ? (formData.contribution_frequency as any) : null,
      });

      router.push(`/goals/${goalId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update sub-goal');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading sub-goal...</p>
        </Card>
      </div>
    );
  }

  if (error && !subGoalId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <h2 className="text-headline text-[var(--color-text)] mb-2">Error</h2>
          <p className="text-body text-[var(--color-text-muted)] mb-6">{error}</p>
          <Link
            href={goalId ? `/goals/${goalId}` : '/goals'}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Back to Goal
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Edit Sub-Goal"
        subtitle="Update sub-goal details"
        actions={
          <Link
            href={goalId ? `/goals/${goalId}` : '/goals'}
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
        }
      />

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
            label="Sub-Goal Name"
            name="name"
            placeholder="e.g., Research destinations, Save for flight tickets"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Costs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Estimated Cost"
              name="estimated_cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.estimated_cost}
              onChange={handleChange}
            />
            <Input
              label="Actual Cost"
              name="actual_cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.actual_cost}
              onChange={handleChange}
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

          {/* Responsible Person and Progress */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Responsible Person"
              name="responsible_person"
              options={personOptions}
              value={formData.responsible_person}
              onChange={handleChange}
            />
            <Input
              label="Progress (%)"
              name="progress"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              value={formData.progress}
              onChange={handleChange}
              hint="0-100"
            />
          </div>

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start Date (Optional)"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleChange}
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

          {/* Contribution Frequency */}
          <Select
            label="Contribution Frequency"
            name="contribution_frequency"
            options={FREQUENCY_OPTIONS}
            value={formData.contribution_frequency}
            onChange={handleChange}
          />

          {/* Description */}
          <Textarea
            label="Description (Optional)"
            name="description"
            placeholder="Add any notes about this sub-goal..."
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

          {/* Delete */}
          <div className="pt-6 border-t border-[var(--color-border)]">
            <p className="text-small text-[var(--color-text-muted)] mb-3">Danger Zone</p>
            <DeleteButton 
              onDelete={async () => {
                if (!subGoalId) return;
                const supabase = createSupabaseBrowserClient();
                const goalService = new FinancialGoalService(supabase);
                await goalService.deleteSubGoal(subGoalId);
              }}
              itemName="sub-goal"
              redirectTo={goalId ? `/goals/${goalId}` : '/goals'}
            />
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
