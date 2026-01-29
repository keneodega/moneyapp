import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GoalDrawdownService } from '@/lib/services';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function getDrawdowns(goalId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    const drawdownService = new GoalDrawdownService(supabase);
    const drawdowns = await drawdownService.getByGoal(goalId);
    
    // Limit to latest 10
    return drawdowns.slice(0, 10);
  } catch (error) {
    console.error('Error fetching drawdowns:', error);
    return [];
  }
}

export async function Drawdowns({ goalId }: { goalId: string }) {
  const drawdowns = await getDrawdowns(goalId);

  if (drawdowns.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No drawdowns from this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Use the "Drawdown" button to withdraw money from this goal.
        </p>
      </div>
    );
  }

  const totalDrawdowns = drawdowns.reduce((sum, drawdown) => {
    const amount = typeof drawdown.amount === 'string' ? parseFloat(drawdown.amount) : Number(drawdown.amount || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20">
        <div className="flex justify-between items-center">
          <span className="text-small text-[var(--color-text-muted)]">Total Drawdowns</span>
          <span className="text-body font-medium text-[var(--color-danger)] tabular-nums">
            {formatCurrency(totalDrawdowns)}
          </span>
        </div>
      </div>

      {/* Drawdowns List */}
      <div className="space-y-2">
        {drawdowns.map((drawdown: any) => {
          const monthlyOverview = drawdown.monthly_overview as any;
          const monthId = monthlyOverview?.id || '';
          const monthName = monthlyOverview?.name || 'Unknown Month';
          
          // Link to month detail page
          const monthUrl = monthId ? `/months/${monthId}` : '#';
          
          return (
            <Link
              key={drawdown.id}
              href={monthUrl}
              className="block p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {drawdown.description || 'Goal Drawdown'}
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {monthName} • {formatDate(drawdown.date)}
                    {drawdown.bank && ` • ${drawdown.bank}`}
                  </p>
                  {drawdown.notes && (
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">
                      {drawdown.notes}
                    </p>
                  )}
                </div>
                <span className="text-body font-medium text-[var(--color-danger)] tabular-nums ml-4">
                  {formatCurrency(typeof drawdown.amount === 'string' ? parseFloat(drawdown.amount) : Number(drawdown.amount || 0))}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {drawdowns.length >= 10 && (
        <p className="text-caption text-[var(--color-text-muted)] text-center pt-2">
          Showing latest 10 drawdowns
        </p>
      )}
    </div>
  );
}
