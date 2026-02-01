'use client';

import { Button } from '@/components/ui';
import { useTransferDialog } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface TransferButtonProps {
  monthId: string;
  disabled?: boolean;
}

export function TransferButton({ monthId, disabled }: TransferButtonProps) {
  const { showTransferDialog } = useTransferDialog();
  const router = useRouter();
  const [hasSource, setHasSource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const supabase = createSupabaseBrowserClient();
        const [goalRes, budgetRes] = await Promise.all([
          supabase.from('financial_goals').select('id').gt('current_amount', 0).limit(1),
          supabase.from('budget_summary').select('id').eq('monthly_overview_id', monthId).gt('amount_left', 0).limit(1),
        ]);
        setHasSource((goalRes.data?.length ?? 0) > 0 || (budgetRes.data?.length ?? 0) > 0);
      } catch {
        setHasSource(false);
      } finally {
        setIsLoading(false);
      }
    }
    check();
  }, [monthId]);

  const handleClick = () => {
    showTransferDialog({
      monthlyOverviewId: monthId,
      onSuccess: () => router.refresh(),
    });
  };

  const unavailable = isLoading || !hasSource;

  return (
    <Button variant="secondary" onClick={handleClick} disabled={disabled || unavailable} className="inline-flex items-center gap-2 h-9" title={unavailable ? (isLoading ? 'Checking...' : 'Add a goal or budget with available balance to transfer') : undefined}>
      <ArrowRightIcon className="w-4 h-4" />
      Transfer
    </Button>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}
