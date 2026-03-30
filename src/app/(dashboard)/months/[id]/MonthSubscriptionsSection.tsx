'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Subscription, MonthSubscription } from '@/lib/supabase/database.types';

type SubscriptionDisplay = Subscription | (MonthSubscription & { subscription_type?: string | null; bank?: string | null });

interface SubscriptionDue {
  subscription: SubscriptionDisplay;
  totalDue: number;
}

interface MonthSubscriptionsSectionProps {
  items: SubscriptionDue[];
  totalDue: number;
}

const statusColors: Record<string, string> = {
  Active: 'bg-green-500/10 text-green-400',
  Paused: 'bg-yellow-500/10 text-yellow-400',
  Cancelled: 'bg-red-500/10 text-red-400',
  Ended: 'bg-gray-500/10 text-gray-400',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function MonthSubscriptionsSection({ items, totalDue }: MonthSubscriptionsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const personalDue = items
    .filter(({ subscription }) => !subscription.is_company_paid)
    .reduce((sum, { totalDue: due }) => sum + due, 0);
  const companyDue = items
    .filter(({ subscription }) => subscription.is_company_paid)
    .reduce((sum, { totalDue: due }) => sum + due, 0);

  // Group subscriptions by payment method
  const groupedByBank = useMemo(() => {
    const groups: Record<string, { items: SubscriptionDue[]; total: number }> = {};
    for (const item of items) {
      const bank = item.subscription.bank || 'Unspecified';
      if (!groups[bank]) {
        groups[bank] = { items: [], total: 0 };
      }
      groups[bank].items.push(item);
      groups[bank].total += item.totalDue;
    }
    // Sort groups alphabetically, but put "Unspecified" last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unspecified') return 1;
      if (b === 'Unspecified') return -1;
      return a.localeCompare(b);
    });
  }, [items]);

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
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-small text-[var(--color-text-muted)] hidden sm:block">
            {formatCurrency(personalDue)} this month (personal)
            {companyDue > 0 && (
              <span className="ml-2 text-blue-400">
                + {formatCurrency(companyDue)} KHO
              </span>
            )}
          </span>
          <ChevronIcon className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-[var(--color-border)]">
          {items.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-body text-[var(--color-text-muted)]">No subscriptions due this month.</p>
            </div>
          ) : (
            <div>
              {groupedByBank.map(([bank, group]) => (
                <div key={bank}>
                  {/* Bank group header */}
                  <div className="px-6 py-2 bg-[var(--color-surface-sunken)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BankIcon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                      <span className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                        {bank}
                      </span>
                      <span className="text-caption text-[var(--color-text-muted)]">
                        ({group.items.length})
                      </span>
                    </div>
                    <span className="text-caption font-semibold text-[var(--color-text-muted)]">
                      {formatCurrency(group.total)}
                    </span>
                  </div>
                  {/* Subscriptions in this group */}
                  <ul className="divide-y divide-[var(--color-border)]">
                    {group.items.map(({ subscription: sub, totalDue: due }) => (
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
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <div className="text-right">
                            <p className="text-small font-medium text-[var(--color-text)]">
                              {formatCurrency(due)}
                            </p>
                            <p className="text-caption text-[var(--color-text-muted)]">due this month</p>
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
                </div>
              ))}
            </div>
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

function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}
