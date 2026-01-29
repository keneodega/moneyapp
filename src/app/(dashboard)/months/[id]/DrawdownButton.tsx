'use client';

import { Button } from '@/components/ui';
import { useDrawdownGoalDialog } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FinancialGoalService } from '@/lib/services';

interface DrawdownButtonProps {
  monthId: string;
  disabled?: boolean;
}

export function DrawdownButton({ monthId, disabled }: DrawdownButtonProps) {
  const { showDrawdownGoalDialog } = useDrawdownGoalDialog();
  const router = useRouter();
  const [hasGoalsWithBalance, setHasGoalsWithBalance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if there are any goals with balance > 0
  useEffect(() => {
    async function checkGoals() {
      try {
        const supabase = createSupabaseBrowserClient();
        const goalService = new FinancialGoalService(supabase);
        const goals = await goalService.getAll();
        
        // Check if any goal has current_amount > 0
        const hasBalance = goals.some(goal => goal.current_amount > 0);
        setHasGoalsWithBalance(hasBalance);
      } catch (err) {
        console.error('Error checking goals:', err);
        setHasGoalsWithBalance(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkGoals();
  }, []);

  const handleClick = () => {
    showDrawdownGoalDialog({
      // goalId, goalName, currentAmount not provided - user will select from dropdown
      monthlyOverviewId: monthId,
      onSuccess: () => {
        // Refresh the page to show updated data
        router.refresh();
      },
    });
  };

  // Don't show button if no goals have balance or still loading
  if (isLoading || !hasGoalsWithBalance) {
    return null;
  }

  return (
    <Button
      variant="danger"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-2"
    >
      <ArrowDownIcon className="w-4 h-4" />
      Drawdown from Goal
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
