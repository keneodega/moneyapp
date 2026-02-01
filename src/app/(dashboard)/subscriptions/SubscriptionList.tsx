'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Subscription, SubscriptionStatusType } from '@/lib/supabase/database.types';
import { SubscriptionService } from '@/lib/services';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, BulkActionsBar } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import { useSelection } from '@/lib/hooks/useSelection';

type SortOption = 'name_asc' | 'name_desc' | 'amount_asc' | 'amount_desc' | 'monthly_asc' | 'monthly_desc' | 'next_date_asc' | 'next_date_desc' | 'payment_method_asc' | 'payment_method_desc' | 'frequency_asc' | 'frequency_desc';

interface SubscriptionListProps {
  subscriptions: Subscription[];
}

const statusColors: Record<SubscriptionStatusType, string> = {
  Active: 'bg-green-500/10 text-green-400',
  Paused: 'bg-yellow-500/10 text-yellow-400',
  Cancelled: 'bg-red-500/10 text-red-400',
  Ended: 'bg-gray-500/10 text-gray-400',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'amount_asc', label: 'Amount (Low–High)' },
  { value: 'amount_desc', label: 'Amount (High–Low)' },
  { value: 'monthly_asc', label: 'Monthly cost (Low–High)' },
  { value: 'monthly_desc', label: 'Monthly cost (High–Low)' },
  { value: 'next_date_asc', label: 'Next payment (Soonest)' },
  { value: 'next_date_desc', label: 'Next payment (Latest)' },
  { value: 'payment_method_asc', label: 'Payment method (A–Z)' },
  { value: 'payment_method_desc', label: 'Payment method (Z–A)' },
  { value: 'frequency_asc', label: 'Frequency (Shortest–Longest)' },
  { value: 'frequency_desc', label: 'Frequency (Longest–Shortest)' },
];

const typeIcons: Record<string, string> = {
  Streaming: '🎬',
  Software: '💻',
  Membership: '🏋️',
  Insurance: '🛡️',
  Utility: '💡',
  News: '📰',
  Gaming: '🎮',
  Health: '❤️',
  Other: '📦',
};

export function SubscriptionList({ subscriptions }: SubscriptionListProps) {
  const [filter, setFilter] = useState<'all' | SubscriptionStatusType>('all');
  const [essentialFilter, setEssentialFilter] = useState<'all' | 'essential' | 'non-essential'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [loading, setLoading] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach(s => {
      const t = (s.subscription_type || 'Other').trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [subscriptions]);

  const uniquePersons = useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach(s => {
      const p = (s.person || '').trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    let list = subscriptions.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (essentialFilter === 'essential' && !s.is_essential) return false;
      if (essentialFilter === 'non-essential' && s.is_essential) return false;
      if (typeFilter !== 'all' && (s.subscription_type || 'Other').trim() !== typeFilter) return false;
      if (personFilter !== 'all' && (s.person || '').trim() !== personFilter) return false;
      return true;
    });

    const monthly = (s: Subscription) => SubscriptionService.calculateMonthlyCost(s.amount, s.frequency);
    const nextDate = (s: Subscription) => s.next_collection_date ? new Date(s.next_collection_date).getTime() : 0;
    const frequencyOrder: Record<string, number> = {
      'Weekly': 1,
      'Bi-Weekly': 2,
      'Monthly': 3,
      'Quarterly': 4,
      'Bi-Annually': 5,
      'Annually': 6,
      'One-Time': 7,
    };

    switch (sortBy) {
      case 'name_asc':
        list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name_desc':
        list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'amount_asc':
        list = [...list].sort((a, b) => a.amount - b.amount);
        break;
      case 'amount_desc':
        list = [...list].sort((a, b) => b.amount - a.amount);
        break;
      case 'monthly_asc':
        list = [...list].sort((a, b) => monthly(a) - monthly(b));
        break;
      case 'monthly_desc':
        list = [...list].sort((a, b) => monthly(b) - monthly(a));
        break;
      case 'next_date_asc':
        list = [...list].sort((a, b) => nextDate(a) - nextDate(b));
        break;
      case 'next_date_desc':
        list = [...list].sort((a, b) => nextDate(b) - nextDate(a));
        break;
      case 'payment_method_asc':
        list = [...list].sort((a, b) => (a.bank || '').localeCompare(b.bank || ''));
        break;
      case 'payment_method_desc':
        list = [...list].sort((a, b) => (b.bank || '').localeCompare(a.bank || ''));
        break;
      case 'frequency_asc':
        list = [...list].sort((a, b) => (frequencyOrder[a.frequency] || 99) - (frequencyOrder[b.frequency] || 99));
        break;
      case 'frequency_desc':
        list = [...list].sort((a, b) => (frequencyOrder[b.frequency] || 99) - (frequencyOrder[a.frequency] || 99));
        break;
      default:
        break;
    }
    return list;
  }, [subscriptions, filter, essentialFilter, typeFilter, personFilter, sortBy]);

  const selection = useSelection(filteredSubscriptions);

  const selectedSums = useMemo(() => {
    const selected = filteredSubscriptions.filter(s => selection.selectedIds.includes(s.id));
    const totalAmount = selected.reduce((sum, s) => sum + s.amount, 0);
    const totalMonthly = selected.reduce((sum, s) => sum + SubscriptionService.calculateMonthlyCost(s.amount, s.frequency), 0);
    const totalYearly = selected.reduce((sum, s) => sum + SubscriptionService.calculateYearlyCost(s.amount, s.frequency), 0);
    return { totalAmount, totalMonthly, totalYearly };
  }, [filteredSubscriptions, selection.selectedIds]);

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (!confirm(`Delete ${selection.selectedIds.length} subscription(s)?`)) return;
    setBulkDeleting(true);
    try {
      const service = new SubscriptionService(supabase);
      await service.deleteMany(selection.selectedIds);
      selection.clear();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete subscriptions:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete subscriptions.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    setLoading(id);
    try {
      const service = new SubscriptionService(supabase);
      switch (action) {
        case 'pause':
          await service.pause(id);
          break;
        case 'resume':
          await service.resume(id);
          break;
        case 'cancel':
          await service.cancel(id);
          break;
      }
      router.refresh();
    } catch (error) {
      console.error('Failed to update subscription:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    
    setLoading(id);
    try {
      const service = new SubscriptionService(supabase);
      await service.delete(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete subscription:', error);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IE', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-4">
      {filteredSubscriptions.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-small text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={selection.isAllSelected}
              onChange={selection.toggleAll}
              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            {selection.isAllSelected ? 'Deselect all' : 'Select all'}
          </label>
        </div>
      )}
      {selection.isSomeSelected && (
        <div className="space-y-2">
          <BulkActionsBar
            selectedCount={selection.selectedCount}
            itemLabel="subscriptions"
            onClear={selection.clear}
            onDelete={handleBulkDelete}
            isDeleting={bulkDeleting}
          />
          <div className="flex flex-wrap gap-4 py-2 px-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
            <div>
              <span className="text-small text-[var(--color-text-muted)]">Monthly: </span>
              <span className="text-small font-medium text-[var(--color-text)]">
                <Currency amount={selectedSums.totalMonthly} />
              </span>
            </div>
            <div>
              <span className="text-small text-[var(--color-text-muted)]">Yearly: </span>
              <span className="text-small font-medium text-[var(--color-text)]">
                <Currency amount={selectedSums.totalYearly} />
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Sort and filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="subscriptions-sort" className="text-small text-[var(--color-text-muted)] whitespace-nowrap">
              Sort by
            </label>
            <select
              id="subscriptions-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {uniqueTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="subscriptions-type" className="text-small text-[var(--color-text-muted)] whitespace-nowrap">
                Type
              </label>
              <select
                id="subscriptions-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="all">All types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {uniquePersons.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="subscriptions-person" className="text-small text-[var(--color-text-muted)] whitespace-nowrap">
                Person
              </label>
              <select
                id="subscriptions-person"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="all">All</option>
                {uniquePersons.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'Active', 'Paused', 'Cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
                filter === status
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {status === 'all' ? 'All' : status}
              <span className="ml-1 opacity-60">
                ({status === 'all' ? subscriptions.length : subscriptions.filter(s => s.status === status).length})
              </span>
            </button>
          ))}
        </div>
        
        {/* Essential Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'essential', 'non-essential'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setEssentialFilter(filterType)}
              className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
                essentialFilter === filterType
                  ? 'bg-blue-500 text-white'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {filterType === 'all' ? 'All Types' : filterType === 'essential' ? 'Essential' : 'Non-Essential'}
              <span className="ml-1 opacity-60">
                ({filterType === 'all' 
                  ? subscriptions.length 
                  : filterType === 'essential'
                    ? subscriptions.filter(s => s.is_essential).length
                    : subscriptions.filter(s => !s.is_essential).length
                })
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Subscription Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSubscriptions.map((subscription) => (
          <Card key={subscription.id} variant="outlined" padding="md" className="relative group">
            <div className="absolute top-4 left-4 z-10">
              <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selection.isSelected(subscription.id)}
                  onChange={() => selection.toggle(subscription.id)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            </div>
            {loading === subscription.id && (
              <div className="absolute inset-0 bg-[var(--color-surface)]/80 flex items-center justify-center rounded-[var(--radius-lg)] z-10">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            <div className="flex items-start justify-between pl-8">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center text-xl">
                  {typeIcons[subscription.subscription_type || 'Other']}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-title text-[var(--color-text)]">{subscription.name}</h3>
                    {subscription.is_essential ? (
                      <span className="px-2 py-0.5 rounded-full text-caption bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
                        Essential
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-caption bg-orange-500/15 text-orange-600 dark:text-orange-400 font-medium">
                        Non-Essential
                      </span>
                    )}
                  </div>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {subscription.subscription_type || 'Other'}
                    {subscription.person && ` · ${subscription.person}`}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-small ${statusColors[subscription.status]}`}>
                {subscription.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Amount</p>
                <p className="text-body font-medium text-[var(--color-text)]">
                  <Currency amount={subscription.amount} />
                  <span className="text-small text-[var(--color-text-muted)] font-normal">
                    /{subscription.frequency.toLowerCase()}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Monthly Cost</p>
                <p className="text-body font-medium text-[var(--color-text)]">
                  <Currency amount={SubscriptionService.calculateMonthlyCost(subscription.amount, subscription.frequency)} />
                </p>
              </div>
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Yearly Cost</p>
                <p className="text-body font-medium text-[var(--color-text)]">
                  <Currency amount={SubscriptionService.calculateYearlyCost(subscription.amount, subscription.frequency)} />
                </p>
              </div>
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Last Payment</p>
                <p className="text-body text-[var(--color-text)]">
                  {formatDate(subscription.last_collection_date)}
                </p>
              </div>
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Next Payment</p>
                <p className="text-body text-[var(--color-text)]">
                  {formatDate(subscription.next_collection_date)}
                </p>
              </div>
              <div>
                <p className="text-small text-[var(--color-text-muted)]">Payment Method</p>
                <p className="text-body text-[var(--color-text)]">
                  {subscription.bank || '-'}
                </p>
              </div>
              {subscription.person && (
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Person</p>
                  <p className="text-body text-[var(--color-text)]">
                    {subscription.person}
                  </p>
                </div>
              )}
            </div>

            {subscription.description && (
              <p className="mt-3 text-small text-[var(--color-text-muted)] line-clamp-2">
                {subscription.description}
              </p>
            )}

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center gap-2">
              <Link
                href={`/subscriptions/${subscription.id}/edit`}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Edit
              </Link>
              
              {subscription.status === 'Active' && (
                <button
                  onClick={() => handleStatusChange(subscription.id, 'pause')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                >
                  Pause
                </button>
              )}
              
              {subscription.status === 'Paused' && (
                <button
                  onClick={() => handleStatusChange(subscription.id, 'resume')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  Resume
                </button>
              )}
              
              {subscription.status !== 'Cancelled' && subscription.status !== 'Ended' && (
                <button
                  onClick={() => handleStatusChange(subscription.id, 'cancel')}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Cancel
                </button>
              )}
              
              <button
                onClick={() => handleDelete(subscription.id)}
                className="ml-auto px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>

      {filteredSubscriptions.length === 0 && (
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">
            {filter !== 'all' || essentialFilter !== 'all' || typeFilter !== 'all' || personFilter !== 'all'
              ? 'No subscriptions match your filters. Try changing the filters above.'
              : 'No subscriptions found.'}
          </p>
        </Card>
      )}
    </div>
  );
}
