'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useDrawdownGoalDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { useRouter } from 'next/navigation';

interface DrawdownButtonProps {
  goalId: string;
  goalName: string;
  currentAmount: number;
  disabled?: boolean;
}

export function DrawdownButton({ goalId, goalName, currentAmount, disabled }: DrawdownButtonProps) {
  const { showDrawdownGoalDialog } = useDrawdownGoalDialog();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null);

  // Get current active month
  useEffect(() => {
    async function getCurrentMonth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const monthlyOverviewService = new MonthlyOverviewService(supabase);
        const activeMonths = await monthlyOverviewService.getAll(true);
        
        // Get the most recent active month (or first one if multiple)
        if (activeMonths.length > 0) {
          setCurrentMonthId(activeMonths[0].id);
        }
      } catch (err) {
        console.error('Error fetching current month:', err);
      }
    }

    getCurrentMonth();
  }, []);

  const handleClick = () => {
    if (!currentMonthId) {
      alert('Please create a month first before drawing down from a goal.');
      return;
    }

    showDrawdownGoalDialog({
      goalId,
      goalName,
      currentAmount,
      monthlyOverviewId: currentMonthId,
      onSuccess: () => {
        // Refresh the page to show updated data
        router.refresh();
      },
    });
  };

  // Don't show button if goal has no balance
  if (currentAmount <= 0) {
    return null;
  }

  return (
    <Button
      variant="danger"
      onClick={handleClick}
      disabled={disabled || isLoading || !currentMonthId}
      className="inline-flex items-center gap-2"
    >
      <ArrowDownIcon className="w-4 h-4" />
      Drawdown
    </Button>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
    </svg>
  );
}
