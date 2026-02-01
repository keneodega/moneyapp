'use client';

import { useCallback, memo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { DeleteButton } from '@/components/ui';

interface MonthActionsProps {
  monthId: string;
  monthName: string;
}

export const MonthActions = memo(function MonthActions({ monthId, monthName }: MonthActionsProps) {
  const supabase = createSupabaseBrowserClient();

  const handleDelete = useCallback(async () => {
    const service = new MonthlyOverviewService(supabase);
    await service.delete(monthId);
  }, [supabase, monthId]);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/months/${monthId}/edit`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] text-small font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <PencilIcon className="w-4 h-4" />
        Edit
      </Link>
      <DeleteButton
        onDelete={handleDelete}
        itemName={monthName}
        redirectTo="/months"
      />
    </div>
  );
});

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}
