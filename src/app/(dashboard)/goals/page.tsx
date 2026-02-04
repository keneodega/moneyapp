import Link from 'next/link';
import { Card, Button, PageHeader, ProgressBar } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FinancialGoalService } from '@/lib/services';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20';
    case 'In Progress':
      return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20';
    case 'On Hold':
      return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20';
    case 'Cancelled':
      return 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/20';
    default:
      return 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border)]';
  }
}

async function getGoals() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if ( !user) {
      return [];
    }

    const goalService = new FinancialGoalService(supabase);
    return await goalService.getAll();
  } catch {
    return [];
  }
}

export default async function GoalsPage() {
  const goals = await getGoals();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Savings"
        subtitle="Track your savings goals and financial targets"
        actions={
          <Link
            href="/goals/new"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Savings Goal
          </Link>
        }
      />

      {/* Goals Grid */}
      {goals.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const progress = goal.target_amount > 0 
              ? (goal.current_amount / goal.target_amount) * 100 
              : 0;
            const remaining = goal.target_amount - goal.current_amount;
            
            return (
              <Link 
                key={goal.id} 
                href={`/goals/${goal.id}`}
                className="animate-slide-up"
              >
                <Card 
                  variant="raised" 
                  hover 
                  padding="md"
                  className="h-full"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-title text-[var(--color-text)] mb-1">{goal.name}</h3>
                      {goal.goal_type && (
                        <span className="inline-block text-caption text-[var(--color-text-muted)] mb-2">
                          {goal.goal_type}
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-caption font-medium border ${getStatusColor(goal.status)}`}>
                      {goal.status}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-caption text-[var(--color-text-muted)]">Progress</span>
                        <span className="text-caption font-medium text-[var(--color-text)] tabular-nums">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar 
                        value={progress} 
                        max={100}
                        size="sm"
                        colorMode="budget"
                      />
                    </div>

                    {/* Amounts */}
                    <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
                      <div className="flex justify-between items-center">
                        <span className="text-small text-[var(--color-text-muted)]">Current</span>
                        <span className="text-small font-medium text-[var(--color-success)] tabular-nums">
                          {formatCurrency(goal.current_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-small text-[var(--color-text-muted)]">Target</span>
                        <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                          {formatCurrency(goal.target_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-body font-medium text-[var(--color-text)]">Remaining</span>
                        <span className={`text-body font-medium tabular-nums ${
                          remaining <= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text)]'
                        }`}>
                          {formatCurrency(Math.max(0, remaining))}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    {goal.end_date && (
                      <div className="pt-2 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>
                            Due: {new Date(goal.end_date).toLocaleDateString('en-IE', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Sub-savings indicator */}
                    {goal.has_sub_goals && (
                      <div className="pt-2 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-2 text-caption text-[var(--color-primary)]">
                          <ListIcon className="w-3.5 h-3.5" />
                          <span>Has sub-savings</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <TargetIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No savings yet</h3>
          <p className="text-body text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            Create your first savings goal to start tracking your savings targets, emergency funds, and major purchases.
          </p>
          <Link
            href="/goals/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Savings Goal
          </Link>
        </Card>
      )}
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}
