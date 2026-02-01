'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { MonthlyOverviewSchema } from '@/lib/validation/schemas';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { useFormToastActions } from '@/lib/hooks/useFormToast';

interface EditMonthPageProps {
  params: Promise<{ id: string }>;
}

interface MonthData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}

export default function EditMonthPage({ params }: EditMonthPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { showSuccessToast, showErrorToast } = useFormToastActions();
  const { errors, validateField, validateAll, clearError } = useFormValidation(MonthlyOverviewSchema);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<MonthData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    notes: '',
  });

  useEffect(() => {
    async function loadMonth() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from('monthly_overviews')
        .select('id, name, start_date, end_date, notes')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        router.replace('/months');
        return;
      }

      const startDate = typeof data.start_date === 'string' ? data.start_date : data.start_date?.toString().slice(0, 10) ?? '';
      const endDate = typeof data.end_date === 'string' ? data.end_date : data.end_date?.toString().slice(0, 10) ?? '';

      setMonth(data as MonthData);
      setFormData({
        name: data.name ?? '',
        start_date: startDate,
        end_date: endDate,
        notes: data.notes ?? '',
      });
    }
    loadMonth();
  }, [id, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof typeof formData]) {
      clearError(name as keyof typeof formData);
    }
  };

  const handleBlur = (name: keyof typeof formData) => {
    validateField(name, formData[name]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month) return;
    setIsLoading(true);
    setError(null);

    try {
      const validationResult = validateAll(formData);
      if (!validationResult.valid) {
        showErrorToast('Please fix the validation errors before submitting');
        setIsLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/months');
        return;
      }

      const service = new MonthlyOverviewService(supabase);
      await service.update(month.id, {
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        notes: formData.notes || null,
      });

      showSuccessToast('Month updated successfully');
      router.push(`/months/${month.id}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update month';
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!month) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </button>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Edit Month</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Update the name, dates, or notes for this budget period
          </p>
        </div>
      </div>

      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          <Input
            label="Month Name"
            name="name"
            placeholder="e.g., January 2026"
            value={formData.name}
            onChange={handleChange}
            onBlur={() => handleBlur('name')}
            error={errors.name}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start Date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleChange}
              onBlur={() => handleBlur('start_date')}
              error={errors.start_date}
              required
            />
            <Input
              label="End Date"
              name="end_date"
              type="date"
              value={formData.end_date}
              onChange={handleChange}
              onBlur={() => handleBlur('end_date')}
              error={errors.end_date}
              required
            />
          </div>

          <Textarea
            label="Notes (optional)"
            name="notes"
            placeholder="Add any notes for this month..."
            value={formData.notes}
            onChange={handleChange}
            onBlur={() => handleBlur('notes')}
            error={errors.notes}
          />

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" size="lg" isLoading={isLoading} className="flex-1">
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
