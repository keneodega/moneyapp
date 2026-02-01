'use client';

import { Button } from '@/components/ui';
import { useTransferDialog } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface TransferButtonProps {
  monthId: string;
  disabled?: boolean;
}

export function TransferButton({ monthId, disabled }: TransferButtonProps) {
  const { showTransferDialog } = useTransferDialog();
  const router = useRouter();

  const handleClick = () => {
    showTransferDialog({
      monthlyOverviewId: monthId,
      onSuccess: () => router.refresh(),
    });
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={disabled} className="inline-flex items-center gap-2 h-9">
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
