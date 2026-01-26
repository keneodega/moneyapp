'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    name: startDate.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' }),
  };
}

export default function NewMonthPage() {
  const router = useRouter();
  const defaults = getDefaultDates();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: defaults.name,
    start_date: defaults.start,
    end_date: defaults.end,
    notes: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if ( !user) {
        // For demo, redirect to months list
        router.push('/months');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('monthly_overviews')
        .insert({
          user_id: user.id,
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (insertError) {
        // Check if error is due to missing budgets table
        if (insertError.message.includes('relation') && insertError.message.includes('budgets')) {
          throw new Error(
            'Database setup incomplete. The budgets table does not exist. ' +
            'Please run the database schema migration in Supabase SQL Editor. ' +
            'See: supabase/schema.sql'
          );
        }
        throw new Error(insertError.message);
      }

      // Redirect to the new month
      router.push(`/months/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create month');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/months"
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">New Month</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Create a new monthly budget period
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card variant="outlined" padding="md" className="bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
            <InfoIcon className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h3 className="text-body font-medium text-[var(--color-text)]">
              Default Budgets
            </h3>
            <p className="text-small text-[var(--color-text-muted)] mt-1">
              13 budget categories will be automatically created with your default amounts (€4,588 total).
            </p>
          </div>
        </div>
      </Card>

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
            label="Month Name"
            name="name"
            placeholder="e.g., January 2026"
            value={formData.name}
            onChange={handleChange}
            required
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
              label="End Date"
              name="end_date"
              type="date"
              value={formData.end_date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Notes */}
          <Textarea
            label="Notes (optional)"
            name="notes"
            placeholder="Add any notes for this month..."
            value={formData.notes}
            onChange={handleChange}
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href="/months"
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
              Create Month
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// Icons
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}
