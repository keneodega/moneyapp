import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GoalContributionService } from '@/lib/services';

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

async function getContributions(goalId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    const contributionService = new GoalContributionService(supabase);
    const contributions = await contributionService.getByGoal(goalId);
    
    // Limit to latest 10
    return contributions.slice(0, 10);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    return [];
  }
}

export async function Contributions({ goalId }: { goalId: string }) {
  const contributions = await getContributions(goalId);

  if (contributions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No contributions to this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Use the "Fund Goal" button on a month page to add contributions.
        </p>
      </div>
    );
  }

  const totalContributions = contributions.reduce((sum, contrib) => {
    const amount = typeof contrib.amount === 'string' ? parseFloat(contrib.amount) : Number(contrib.amount || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
        <div className="flex justify-between items-center">
          <span className="text-small text-[var(--color-text-muted)]">Total Contributions</span>
          <span className="text-body font-medium text-[var(--color-primary)] tabular-nums">
            {formatCurrency(totalContributions)}
          </span>
        </div>
      </div>

      {/* Contributions List */}
      <div className="space-y-2">
        {contributions.map((contrib: any) => {
          const monthlyOverview = contrib.monthly_overview as any;
          const monthId = monthlyOverview?.id || '';
          const monthName = monthlyOverview?.name || 'Unknown Month';
          
          // Link to month detail page
          const monthUrl = monthId ? `/months/${monthId}` : '#';
          
          return (
            <Link
              key={contrib.id}
              href={monthUrl}
              className="block p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {contrib.description || 'Goal Contribution'}
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {monthName} • {formatDate(contrib.date)}
                    {contrib.bank && ` • ${contrib.bank}`}
                  </p>
                  {contrib.notes && (
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">
                      {contrib.notes}
                    </p>
                  )}
                </div>
                <span className="text-body font-medium text-[var(--color-success)] tabular-nums ml-4">
                  {formatCurrency(typeof contrib.amount === 'string' ? parseFloat(contrib.amount) : Number(contrib.amount || 0))}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {contributions.length >= 10 && (
        <p className="text-caption text-[var(--color-text-muted)] text-center pt-2">
          Showing latest 10 contributions
        </p>
      )}
    </div>
  );
}
