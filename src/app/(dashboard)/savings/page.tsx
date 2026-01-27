'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, ProgressBar, SkeletonCard, useToast, useConfirmDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SavingsService, FinancialGoalService } from '@/lib/services';
import { SavingsBucketWithGoal } from '@/lib/services/savings.service';
import { CreateBucketModal } from './CreateBucketModal';
import { AddTransactionModal } from './AddTransactionModal';
import { BucketDetailModal } from './BucketDetailModal';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SavingsPage() {
  const [buckets, setBuckets] = useState<SavingsBucketWithGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  
  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  
  const supabase = createSupabaseBrowserClient();
  const savingsService = new SavingsService(supabase);

  const loadBuckets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await savingsService.getAllBuckets();
      setBuckets(data);
      
      // Calculate total savings
      const total = data.reduce((sum, bucket) => sum + (bucket.current_amount || 0), 0);
      setTotalSavings(total);
    } catch (error) {
      toast.error('Failed to load savings buckets');
      console.error('Error loading buckets:', error);
    } finally {
      setLoading(false);
    }
  }, [savingsService, toast]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  const handleDelete = async (bucketId: string, bucketName: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Savings Bucket',
      message: `Are you sure you want to delete "${bucketName}"? This will also delete all associated transactions.`,
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await savingsService.deleteBucket(bucketId);
      toast.success('Savings bucket deleted');
      loadBuckets();
    } catch (error) {
      toast.error('Failed to delete savings bucket');
      console.error('Error deleting bucket:', error);
    }
  };

  const handleBucketCreated = () => {
    setShowCreateModal(false);
    loadBuckets();
  };

  const handleTransactionAdded = () => {
    setShowTransactionModal(null);
    loadBuckets();
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display text-[var(--color-text)]">Savings</h1>
            <p className="text-body text-[var(--color-text-muted)] mt-2">
              Manage your savings buckets and track progress toward goals
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-[var(--color-text)]">Savings</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-2">
            Manage your savings buckets and track progress toward goals
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          variant="primary"
        >
          <PlusIcon className="w-5 h-5" />
          New Bucket
        </Button>
      </div>

      {/* Total Savings Summary */}
      <Card variant="raised" padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-small text-[var(--color-text-muted)]">Total Savings</p>
            <p className="text-display text-[var(--color-success)] mt-1">
              {formatCurrency(totalSavings)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-small text-[var(--color-text-muted)]">Active Buckets</p>
            <p className="text-headline text-[var(--color-text)] mt-1">
              {buckets.length}
            </p>
          </div>
        </div>
      </Card>

      {/* Buckets Grid */}
      {buckets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((bucket) => {
            const progress = bucket.target_amount && bucket.target_amount > 0
              ? (bucket.current_amount / bucket.target_amount) * 100
              : null;
            const remaining = bucket.target_amount
              ? bucket.target_amount - bucket.current_amount
              : null;

            return (
              <Card
                key={bucket.id}
                variant="raised"
                padding="md"
                hover
                className="cursor-pointer"
                onClick={() => setSelectedBucket(bucket.id)}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-title text-[var(--color-text)] mb-1">
                        {bucket.name}
                      </h3>
                      {bucket.linked_goal && (
                        <Link
                          href={`/goals/${bucket.linked_goal.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-caption text-[var(--color-primary)] hover:underline"
                        >
                          Linked to: {bucket.linked_goal.name}
                        </Link>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bucket.id, bucket.name);
                      }}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                      title="Delete bucket"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-headline font-medium text-[var(--color-success)]">
                      {formatCurrency(bucket.current_amount)}
                    </p>
                    {bucket.target_amount && (
                      <p className="text-caption text-[var(--color-text-muted)]">
                        of {formatCurrency(bucket.target_amount)} target
                      </p>
                    )}
                  </div>

                  {/* Progress */}
                  {progress !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-caption text-[var(--color-text-muted)]">Progress</span>
                        <span className="text-caption font-medium text-[var(--color-text)]">
                          {Math.min(100, Math.max(0, progress)).toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(100, Math.max(0, progress))}
                        max={100}
                        size="sm"
                        colorMode="budget"
                      />
                      {remaining !== null && (
                        <p className="text-caption text-[var(--color-text-muted)] mt-1">
                          {remaining > 0
                            ? `${formatCurrency(remaining)} remaining`
                            : 'Target reached!'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Monthly Contribution */}
                  {bucket.monthly_contribution && (
                    <div className="pt-2 border-t border-[var(--color-border)]">
                      <p className="text-caption text-[var(--color-text-muted)]">
                        Monthly Contribution
                      </p>
                      <p className="text-small font-medium text-[var(--color-text)]">
                        {formatCurrency(bucket.monthly_contribution)}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTransactionModal(bucket.id);
                      }}
                      className="flex-1"
                    >
                      Add Transaction
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBucket(bucket.id);
                      }}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <PiggyBankIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No savings buckets yet</h3>
          <p className="text-body text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            Create your first savings bucket to start tracking your savings. You can link buckets to financial goals to track progress.
          </p>
          <Button onClick={() => setShowCreateModal(true)} variant="primary">
            <PlusIcon className="w-4 h-4" />
            Create Bucket
          </Button>
        </Card>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateBucketModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleBucketCreated}
        />
      )}

      {showTransactionModal && (
        <AddTransactionModal
          bucketId={showTransactionModal}
          onClose={() => setShowTransactionModal(null)}
          onSuccess={handleTransactionAdded}
        />
      )}

      {selectedBucket && (
        <BucketDetailModal
          bucketId={selectedBucket}
          onClose={() => setSelectedBucket(null)}
          onUpdate={loadBuckets}
        />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function PiggyBankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
