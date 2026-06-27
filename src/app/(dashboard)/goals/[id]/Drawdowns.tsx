import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TransferService } from '@/lib/services';
import { DrawdownsList } from './DrawdownsList';

async function getTransfers(goalId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const transferService = new TransferService(supabase);
    return await transferService.getByGoal(goalId);
  } catch (error) {
    console.error('Error fetching transfers for goal:', error);
    return [];
  }
}

export async function Drawdowns({ goalId }: { goalId: string }) {
  const transfers = await getTransfers(goalId);

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No transfers from this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Use the &quot;Transfer&quot; button to move money from this goal to a budget or DrawDown.
        </p>
      </div>
    );
  }

  return <DrawdownsList transfers={transfers} />;
}
