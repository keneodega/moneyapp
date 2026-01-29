import Link from 'next/link';
import { Card, Button, ProgressBar, Currency } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FinancialGoalService } from '@/lib/services';
import { NotFoundError } from '@/lib/services/errors';
import { Contributions } from './Contributions';
import { Drawdowns } from './Drawdowns';
import { GoalActions } from './GoalActions';
import dynamic from 'next/dynamic';

// Load DrawdownButton dynamically (client component)
const DrawdownButton = dynamic(() => import('./DrawdownButton').then(mod => ({ default: mod.DrawdownButton })), {
  loading: () => <div className="text-small text-[var(--color-text-muted)]">Loading...</div>,
  ssr: false,
});

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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical':
      return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
    case 'High':
      return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';
    case 'Medium':
      return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]';
    default:
      return 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]';
  }
}

async function getGoal(id: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if ( !user) {
      return null;
    }

    const goalService = new FinancialGoalService(supabase);
    return await goalService.getById(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await getGoal(id);

  if ( !goal) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <h2 className="text-headline text-[var(--color-text)] mb-2">Goal Not Found</h2>
          <p className="text-body text-[var(--color-text-muted)] mb-6">
            The goal you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link
            href="/goals"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Back to Goals
          </Link>
        </Card>
      </div>
    );
  }

  const progress = goal.progress_percent || 0;
  const remaining = goal.target_amount - goal.current_amount;
  const daysRemaining = goal.end_date 
    ? Math.ceil((new Date(goal.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/goals"
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-display text-[var(--color-text)]">{goal.name}</h1>
          {goal.goal_type && (
            <p className="text-body text-[var(--color-text-muted)] mt-1">{goal.goal_type}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DrawdownButton 
            goalId={id} 
            goalName={goal.name}
            currentAmount={goal.current_amount}
          />
          <GoalActions goalId={id} />
        </div>
      </div>

      {/* Progress Overview */}
      <Card variant="raised" padding="lg">
        <div className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-small font-medium text-[var(--color-text-muted)]">Progress</span>
              <span className="text-body font-medium text-[var(--color-text)] tabular-nums">
                {progress.toFixed(1)}%
              </span>
            </div>
            <ProgressBar 
              value={progress} 
              max={100}
              size="lg"
              colorMode="budget"
            />
          </div>

          {/* Amounts Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Current</p>
              <p className="text-title font-medium text-[var(--color-success)] tabular-nums">
                {formatCurrency(goal.current_amount)}
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Target</p>
              <p className="text-title font-medium text-[var(--color-text)] tabular-nums">
                {formatCurrency(goal.target_amount)}
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Remaining</p>
              <p className={`text-title font-medium tabular-nums ${
                remaining <= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-text)]'
              }`}>
                {formatCurrency(Math.max(0, remaining))}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Goal Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <Card variant="outlined" padding="md">
            <h3 className="text-title text-[var(--color-text)] mb-4">Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Status</span>
                <span className={`px-2 py-1 rounded-full text-caption font-medium border ${getStatusColor(goal.status)}`}>
                  {goal.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Priority</span>
                <span className={`px-2 py-1 rounded-full text-caption font-medium ${getPriorityColor(goal.priority)}`}>
                  {goal.priority}
                </span>
              </div>
              {goal.person && (
                <div className="flex justify-between">
                  <span className="text-small text-[var(--color-text-muted)]">Person</span>
                  <span className="text-small font-medium text-[var(--color-text)]">{goal.person}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Start Date</span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {formatDate(goal.start_date)}
                </span>
              </div>
              {goal.end_date && (
                <div className="flex justify-between">
                  <span className="text-small text-[var(--color-text-muted)]">End Date</span>
                  <span className="text-small font-medium text-[var(--color-text)]">
                    {formatDate(goal.end_date)}
                  </span>
                </div>
              )}
              {daysRemaining !== null && (
                <div className="flex justify-between">
                  <span className="text-small text-[var(--color-text-muted)]">Days Remaining</span>
                  <span className={`text-small font-medium ${
                    daysRemaining < 0 ? 'text-[var(--color-danger)]' : 
                    daysRemaining < 30 ? 'text-[var(--color-warning)]' : 
                    'text-[var(--color-text)]'
                  }`}>
                    {daysRemaining > 0 ? `${daysRemaining} days` : 'Overdue'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {goal.description && (
            <Card variant="outlined" padding="md">
              <h3 className="text-title text-[var(--color-text)] mb-3">Description</h3>
              <p className="text-body text-[var(--color-text-muted)] whitespace-pre-wrap">
                {goal.description}
              </p>
            </Card>
          )}

          {goal.product_link && (
            <Card variant="outlined" padding="md">
              <h3 className="text-title text-[var(--color-text)] mb-3">Product Link</h3>
              <a
                href={goal.product_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-[var(--color-primary)] hover:underline flex items-center gap-2"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                View Product
              </a>
            </Card>
          )}
        </div>

        {/* Right Column - Sub-Goals and Linked Expenses */}
        <div className="space-y-6">
          {/* Contributions */}
          <Card variant="outlined" padding="md">
            <h3 className="text-title text-[var(--color-text)] mb-4">Contributions</h3>
            <Contributions goalId={id} />
          </Card>

          {/* Drawdowns */}
          <Card variant="outlined" padding="md">
            <h3 className="text-title text-[var(--color-text)] mb-4">Drawdowns</h3>
            <Drawdowns goalId={id} />
          </Card>

          {/* Sub-Goals */}
          <Card variant="outlined" padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title text-[var(--color-text)]">Sub-Goals</h3>
              <Link
                href={`/goals/${id}/sub-goals/new`}
                className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add Sub-Goal
              </Link>
            </div>

            {goal.sub_goals && goal.sub_goals.length > 0 ? (
              <div className="space-y-3">
                {goal.sub_goals.map((subGoal) => (
                  <Link
                    key={subGoal.id}
                    href={`/goals/${id}/sub-goals/${subGoal.id}/edit`}
                    className="block p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-body font-medium text-[var(--color-text)]">
                        {subGoal.name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-caption font-medium border ${getStatusColor(subGoal.status)}`}>
                        {subGoal.status}
                      </span>
                    </div>
                    {subGoal.estimated_cost && (
                      <p className="text-small text-[var(--color-text-muted)] mb-2">
                        Estimated: {formatCurrency(subGoal.estimated_cost)}
                      </p>
                    )}
                    {subGoal.progress > 0 && (
                      <div className="mt-2">
                        <ProgressBar 
                          value={subGoal.progress} 
                          max={100}
                          size="sm"
                          colorMode="budget"
                        />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-body text-[var(--color-text-muted)] mb-4">
                  No sub-goals yet. Break down your goal into smaller steps.
                </p>
                <Link
                  href={`/goals/${id}/sub-goals/new`}
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create First Sub-Goal
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}


function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}
