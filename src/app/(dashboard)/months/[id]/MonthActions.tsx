'use client';

import { useCallback, memo } from 'react';
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
    <DeleteButton 
      onDelete={handleDelete}
      itemName={monthName}
      redirectTo="/months"
    />
  );
});
