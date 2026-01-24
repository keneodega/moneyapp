import { Card } from '@/components/ui';

export default function SubscriptionsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-display text-[var(--color-text)]">Subscriptions</h1>
        <p className="text-body text-[var(--color-text-muted)] mt-2">
          Manage your recurring payments and subscriptions
        </p>
      </div>

      <Card variant="outlined" padding="lg" className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
          <RepeatIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
        </div>
        <h3 className="text-title text-[var(--color-text)] mb-2">Coming Soon</h3>
        <p className="text-body text-[var(--color-text-muted)] max-w-md mx-auto">
          Subscription tracking feature is under development. Track Netflix, Spotify, and all your recurring payments.
        </p>
      </Card>
    </div>
  );
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
    </svg>
  );
}
