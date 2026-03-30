'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Subscription } from '@/lib/supabase/database.types';
import { SubscriptionService } from '@/lib/services';
import { Currency } from '@/components/ui/Currency';

interface SubscriptionsSectionProps {
  subscriptions: Subscription[];
}

const statusColors: Record<string, string> = {
  Active: 'bg-green-500/10 text-green-400',
  Paused: 'bg-yellow-500/10 text-yellow-400',
  Cancelled: 'bg-red-500/10 text-red-400',
  Ended: 'bg-gray-500/10 text-gray-400',
};

export function SubscriptionsSection({ subscriptions }: SubscriptionsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeSubscriptions = subscriptions.filter(s => SubscriptionService.isEffectivelyActive(s));
  const personalMonthly = activeSubscriptions
    .filter(s => !s.is_company_paid)
    .reduce((sum, s) => sum + SubscriptionService.calculateMonthlyCost(s.amount, s.frequency), 0);
  const companyPaidMonthly = activeSubscriptions
    .filter(s => s.is_company_paid)
    .reduce((sum, s) => sum + SubscriptionService.calculateMonthlyCost(s.amount, s.frequency), 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <RepeatIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
          <span className="text-title text-[var(--color-text)]">Subscriptions</span>
          <span className="px-2 py-0.5 rounded-full text-caption bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
            {subscriptions.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-small text-[var(--color-text-muted)] hidden sm:block">
            <Currency amount={personalMonthly} /> / month (personal)
            {companyPaidMonthly > 0 && (
              <span className="ml-2 text-blue-400">
                + <Currency amount={companyPaidMonthly} /> KHO
              </span>
            )}
          </span>
          <ChevronIcon className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-[var(--color-border)]">
          {subscriptions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-body text-[var(--color-text-muted)]">No subscriptions yet.</p>
              <Link
                href="/subscriptions/new"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                Add Subscription
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {subscriptions.map(sub => (
                <li key={sub.id} className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] flex items-center justify-center text-caption font-semibold text-[var(--color-text)] shrink-0">
                      {(sub.subscription_type || 'OT').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-small font-medium text-[var(--color-text)] truncate">
                        {sub.name}
                        {sub.is_company_paid && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-caption bg-blue-500/15 text-blue-400 font-medium">
                            KHO
                          </span>
                        )}
                      </p>
                      <p className="text-caption text-[var(--color-text-muted)]">
                        {sub.frequency}
                        {sub.bank ? ` · ${sub.bank}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-small font-medium text-[var(--color-text)]">
                        <Currency amount={sub.amount} />
                        <span className="text-caption text-[var(--color-text-muted)] font-normal">
                          /{sub.frequency.toLowerCase()}
                        </span>
                      </p>
                      <p className="text-caption text-[var(--color-text-muted)]">
                        <Currency amount={SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency)} /> /mo
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-caption ${statusColors[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                        {sub.status}
                      </span>
                      {sub.status === 'Cancelled' && sub.end_date && new Date(sub.end_date) >= new Date(new Date().toISOString().split('T')[0]) && (
                        <p className="text-caption text-[var(--color-text-muted)] mt-0.5">
                          Valid until {new Date(sub.end_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-6 py-3 border-t border-[var(--color-border)] flex justify-end">
            <Link
              href="/subscriptions"
              className="text-small text-[var(--color-primary)] hover:underline"
            >
              Manage subscriptions →
            </Link>
          </div>
        </div>
      )}
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
