'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Subscription, SubscriptionStatusType } from '@/lib/supabase/database.types';
import { SubscriptionService } from '@/lib/services';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, BulkActionsBar } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import { useSelection } from '@/lib/hooks/useSelection';

interface SubscriptionListProps {
  subscriptions: Subscription[];
}

const statusColors: Record<SubscriptionStatusType, string> = {
  Active: 'bg-green-500/10 text-green-400',
  Paused: 'bg-yellow-500/10 text-yellow-400',
  Cancelled: 'bg-red-500/10 text-red-400',
  Ended: 'bg-gray-500/10 text-gray-400',
};

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
  const [loading, setLoading] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const filteredSubscriptions = subscriptions.filter(s => {
    // Status filter
    if (filter !== 'all' && s.status !== filter) return false;
    // Essential filter
    if (essentialFilter === 'essential' && !s.is_essential) return false;
    if (essentialFilter === 'non-essential' && s.is_essential) return false;
    return true;
  });

  const selection = useSelection(filteredSubscriptions);

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
        <BulkActionsBar
          selectedCount={selection.selectedCount}
          itemLabel="subscriptions"
          onClear={selection.clear}
          onDelete={handleBulkDelete}
          isDeleting={bulkDeleting}
        />
      )}
      {/* Filter Tabs */}
      <div className="space-y-3">
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
            No {filter === 'all' ? '' : filter.toLowerCase()} subscriptions found.
          </p>
        </Card>
      )}
    </div>
  );
}
