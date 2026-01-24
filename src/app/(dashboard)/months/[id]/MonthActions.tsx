'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { DeleteButton } from '@/components/ui';

interface MonthActionsProps {
  monthId: string;
  monthName: string;
}

export function MonthActions({ monthId, monthName }: MonthActionsProps) {
  const supabase = createSupabaseBrowserClient();

  const handleDelete = async () => {
    const service = new MonthlyOverviewService(supabase);
    await service.delete(monthId);
  };

  return (
    <DeleteButton 
      onDelete={handleDelete}
      itemName={monthName}
      redirectTo="/months"
    />
  );
}
