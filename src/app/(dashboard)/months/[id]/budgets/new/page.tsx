'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, PageHeader } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function NewBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redirect to master budgets page since budgets are now managed there
    router.push('/master-budgets');
  }, [router]);
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Budgets via Master Budgets"
        subtitle="Budgets are created from your master budget list"
        actions={
          <Link href={`/months/${monthId}`}>
            <Button variant="secondary">Back to Month</Button>
          </Link>
        }
      />
      <Card variant="raised" padding="lg">
        <div className="text-center space-y-4">
          <h2 className="text-title text-[var(--color-text)]">Budgets are Managed via Master Budgets</h2>
          <p className="text-body text-[var(--color-text-muted)]">
            Budgets are automatically created from your master budgets when you create a new month.
            To add or modify budget categories, please use the{' '}
            <Link href="/master-budgets" className="text-[var(--color-primary)] hover:underline">
              Master Budgets
            </Link>{' '}
            page.
          </p>
        </div>
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
