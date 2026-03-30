import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LifeEventService } from '@/lib/services';
import { LifeEvent, LifeEventStatus } from '@/lib/supabase/database.types';
import { PageHeader, Button } from '@/components/ui';

const CATEGORY_ICONS: Record<string, string> = {
  baby: '👶',
  property: '🏠',
  vehicle: '🚗',
  career: '💼',
  education: '🎓',
  other: '📋',
};

const CATEGORY_LABELS: Record<string, string> = {
  baby: 'Baby',
  property: 'Property',
  vehicle: 'Vehicle',
  career: 'Career',
  education: 'Education',
  other: 'Other',
};

const STATUS_STYLES: Record<LifeEventStatus, string> = {
  planned: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  in_progress: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  completed: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  cancelled: 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]',
};

const STATUS_LABELS: Record<LifeEventStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatExpectedDate(date: string, confidence: string): string {
  const d = new Date(date);
  if (confidence === 'year') {
    return d.toLocaleDateString('en-IE', { year: 'numeric' });
  }
  if (confidence === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });
}

function getTimeFromNow(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Past';
  if (diffDays === 0) return 'Today';
  if (diffDays < 30) return `${diffDays}d away`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)}mo away`;
  const years = diffDays / 365;
  return `${years < 1.5 ? '~1' : Math.round(years)}yr away`;
}

async function getLifeEvents() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const service = new LifeEventService(supabase);
    return await service.getAll();
  } catch {
    return [];
  }
}

function EventCard({ event }: { event: LifeEvent }) {
  const hasOneTimeCost = event.one_time_cost > 0;
  const hasOneTimeIncome = event.one_time_income > 0;
  const hasRecurring = event.recurring_monthly_change !== 0;
  const hasIncomeChange = event.income_monthly_change !== 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]/40 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Icon */}
          <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center text-2xl shrink-0">
            {event.icon || CATEGORY_ICONS[event.category] || '📋'}
          </div>

          {/* Main info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-body font-semibold text-[var(--color-text)]">{event.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-caption ${STATUS_STYLES[event.status]}`}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-caption text-[var(--color-text-muted)]">
                {CATEGORY_LABELS[event.category]}
              </span>
              <span className="text-caption text-[var(--color-text-muted)]">·</span>
              <span className="text-caption text-[var(--color-text-muted)]">
                {formatExpectedDate(event.expected_date, event.date_confidence)}
              </span>
              <span className="text-caption font-medium text-[var(--color-primary)]">
                ({getTimeFromNow(event.expected_date)})
              </span>
            </div>
            {event.description && (
              <p className="text-small text-[var(--color-text-muted)] mt-1 truncate max-w-md">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Edit link */}
        <Link
          href={`/forecast/${event.id}/edit`}
          className="text-small text-[var(--color-primary)] hover:underline shrink-0"
        >
          Edit
        </Link>
      </div>

      {/* Financial impact summary */}
      {(hasOneTimeCost || hasOneTimeIncome || hasRecurring || hasIncomeChange) && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3">
          {hasOneTimeCost && (
            <div>
              <p className="text-caption text-[var(--color-text-muted)]">One-time cost</p>
              <p className="text-small font-semibold text-[var(--color-danger)]">
                -{formatCurrency(event.one_time_cost)}
              </p>
            </div>
          )}
          {hasOneTimeIncome && (
            <div>
              <p className="text-caption text-[var(--color-text-muted)]">One-time income</p>
              <p className="text-small font-semibold text-[var(--color-success)]">
                +{formatCurrency(event.one_time_income)}
              </p>
            </div>
          )}
          {hasRecurring && (
            <div>
              <p className="text-caption text-[var(--color-text-muted)]">
                {event.recurring_description || 'Monthly change'}
              </p>
              <p className={`text-small font-semibold ${event.recurring_monthly_change > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {event.recurring_monthly_change > 0 ? '+' : ''}{formatCurrency(event.recurring_monthly_change)}/mo
              </p>
            </div>
          )}
          {hasIncomeChange && (
            <div>
              <p className="text-caption text-[var(--color-text-muted)]">
                {event.income_change_description || 'Income change'}
                {event.income_change_duration_months ? ` (${event.income_change_duration_months}mo)` : ''}
              </p>
              <p className={`text-small font-semibold ${event.income_monthly_change >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {event.income_monthly_change >= 0 ? '+' : ''}{formatCurrency(event.income_monthly_change)}/mo
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ForecastPage() {
  const events = await getLifeEvents();

  const activeEvents = events.filter(e => e.status === 'planned' || e.status === 'in_progress');
  const completedEvents = events.filter(e => e.status === 'completed' || e.status === 'cancelled');

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Forecast"
        subtitle="Plan for major life events and their financial impact"
        actions={
          <Link href="/forecast/new">
            <Button variant="primary" size="sm">+ Add Life Event</Button>
          </Link>
        }
      />

      {events.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-16 text-center">
          <div className="text-5xl mb-4">🔭</div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No life events yet</h3>
          <p className="text-body text-[var(--color-text-muted)] mb-6 max-w-sm mx-auto">
            Add your planned milestones — a new baby, buying a home, changing your car — and track their financial impact over time.
          </p>
          <Link href="/forecast/new">
            <Button variant="primary">Add your first life event</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active / Planned */}
          {activeEvents.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-body font-medium text-[var(--color-text)]">
                Upcoming & In Progress
                <span className="ml-2 px-2 py-0.5 rounded-full text-caption bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
                  {activeEvents.length}
                </span>
              </h2>
              {activeEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </section>
          )}

          {/* Completed / Cancelled */}
          {completedEvents.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-body font-medium text-[var(--color-text-muted)]">
                Completed & Cancelled
                <span className="ml-2 px-2 py-0.5 rounded-full text-caption bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
                  {completedEvents.length}
                </span>
              </h2>
              {completedEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
