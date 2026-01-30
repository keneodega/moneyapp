'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useTransferDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { useRouter } from 'next/navigation';

interface TransferButtonProps {
  goalId: string;
  goalName: string;
  currentAmount: number;
  disabled?: boolean;
}

export function TransferButton({ goalId, goalName, currentAmount, disabled }: TransferButtonProps) {
  const { showTransferDialog } = useTransferDialog();
  const router = useRouter();
  const [monthId, setMonthId] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentMonth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const monthlyOverviewService = new MonthlyOverviewService(supabase);
        const activeMonths = await monthlyOverviewService.getAll(true);
        if (activeMonths.length > 0) setMonthId(activeMonths[0].id);
      } catch (err) {
        console.error('Error fetching current month:', err);
      }
    }
    getCurrentMonth();
  }, []);

  const handleClick = () => {
    if (!monthId) {
      alert('Please create a month first before transferring from this goal.');
      return;
    }
    showTransferDialog({
      monthlyOverviewId: monthId,
      goalId,
      goalName,
      currentAmount,
      onSuccess: () => router.refresh(),
    });
  };

  if (currentAmount <= 0) return null;

  return (
    <Button
      variant="danger"
      onClick={handleClick}
      disabled={disabled || !monthId}
      className="inline-flex items-center gap-2"
    >
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
