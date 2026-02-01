'use client';

import { Button } from '@/components/ui';
import { useFundGoalDialog } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface FundGoalButtonProps {
  monthId: string;
  disabled?: boolean;
}

export function FundGoalButton({ monthId, disabled }: FundGoalButtonProps) {
  const { showFundGoalDialog } = useFundGoalDialog();
  const router = useRouter();

  const handleClick = () => {
    showFundGoalDialog({
      monthlyOverviewId: monthId,
      onSuccess: () => {
        // Refresh the page to show updated data
        router.refresh();
      },
    });
  };

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-9"
      title={disabled ? 'Add income to this month first' : undefined}
    >
      <PiggyBankIcon className="w-4 h-4" />
      Fund Goal
    </Button>
  );
}

function PiggyBankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.818.182A2.25 2.25 0 0015.75 21c.41-.401.757-.924 1-1.5.243-.576.35-1.21.35-1.872 0-2.34-.611-4.603-1.75-6.55L12 14l-1.75-1.75A12.5 12.5 0 008.5 8.372c0-.662.107-1.296.35-1.872.243-.576.59-1.099 1-1.5A2.25 2.25 0 0111.182 5H12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21h7.5" />
    </svg>
  );
}
