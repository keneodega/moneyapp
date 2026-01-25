'use client';

import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService } from '@/lib/services';
import { DeleteButton } from '@/components/ui';

interface BudgetActionsProps {
  budgetId: string;
  monthId: string;
  budgetName: string;
}

export function BudgetActions({ budgetId, monthId, budgetName }: BudgetActionsProps) {
  const supabase = createSupabaseBrowserClient();

  const handleDelete = async () => {
    const service = new BudgetService(supabase);
    await service.delete(budgetId);
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/months/${monthId}/budgets/${budgetId}/edit`}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <EditIcon className="w-4 h-4" />
        Edit
      </Link>
      <DeleteButton 
        onDelete={handleDelete}
        itemName={budgetName}
        redirectTo={`/months/${monthId}`}
      />
    </div>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}
