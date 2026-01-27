'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Button, useToast, useConfirmDialog, SkeletonCard } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SavingsService } from '@/lib/services';
import { SavingsBucketWithGoal, SavingsTransaction } from '@/lib/services/savings.service';
import { AddTransactionModal } from './AddTransactionModal';

interface BucketDetailModalProps {
  bucketId: string;
  onClose: () => void;
  onUpdate: () => void;
}

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

export function BucketDetailModal({ bucketId, onClose, onUpdate }: BucketDetailModalProps) {
  const [bucket, setBucket] = useState<SavingsBucketWithGoal | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  const supabase = createSupabaseBrowserClient();
  const savingsService = new SavingsService(supabase);

  useEffect(() => {
    async function loadData() {
      try {
        const [bucketData, transactionsData] = await Promise.all([
          savingsService.getBucketById(bucketId),
          savingsService.getBucketTransactions(bucketId),
        ]);
        setBucket(bucketData);
        setTransactions(transactionsData);
      } catch (error) {
        toast.showToast('Failed to load bucket details', 'error');
        console.error('Error loading bucket:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [bucketId, savingsService, toast]);

  const handleDeleteTransaction = async (transactionId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Transaction',
      message: 'Are you sure you want to delete this transaction?',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await savingsService.deleteTransaction(transactionId);
      toast.showToast('Transaction deleted', 'success');
      // Reload data
      const [bucketData, transactionsData] = await Promise.all([
        savingsService.getBucketById(bucketId),
        savingsService.getBucketTransactions(bucketId),
      ]);
      setBucket(bucketData);
      setTransactions(transactionsData);
      onUpdate();
    } catch (error) {
      toast.showToast('Failed to delete transaction', 'error');
      console.error('Error deleting transaction:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <Card variant="raised" padding="lg" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <SkeletonCard />
        </Card>
      </div>
    );
  }

  if (!bucket) {
    return null;
  }

  const progress = bucket.target_amount && bucket.target_amount > 0
    ? (bucket.current_amount / bucket.target_amount) * 100
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <Card variant="raised" padding="lg" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-headline text-[var(--color-text)]">{bucket.name}</h2>
                {bucket.linked_goal && (
                  <Link
                    href={`/goals/${bucket.linked_goal.id}`}
                    className="text-caption text-[var(--color-primary)] hover:underline mt-1"
                  >
                    Linked to: {bucket.linked_goal.name}
                  </Link>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-caption text-[var(--color-text-muted)]">Current Amount</p>
                <p className="text-headline font-medium text-[var(--color-success)] mt-1">
                  {formatCurrency(bucket.current_amount)}
                </p>
              </div>
              {bucket.target_amount && (
                <div>
                  <p className="text-caption text-[var(--color-text-muted)]">Target Amount</p>
                  <p className="text-headline font-medium text-[var(--color-text)] mt-1">
                    {formatCurrency(bucket.target_amount)}
                  </p>
                </div>
              )}
              {bucket.monthly_contribution && (
                <div>
                  <p className="text-caption text-[var(--color-text-muted)]">Monthly Contribution</p>
                  <p className="text-headline font-medium text-[var(--color-text)] mt-1">
                    {formatCurrency(bucket.monthly_contribution)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-caption text-[var(--color-text-muted)]">Transactions</p>
                <p className="text-headline font-medium text-[var(--color-text)] mt-1">
                  {transactions.length}
                </p>
              </div>
            </div>

            {/* Progress */}
            {progress !== null && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-small text-[var(--color-text-muted)]">Progress</span>
                  <span className="text-small font-medium text-[var(--color-text)]">
                    {Math.min(100, Math.max(0, progress)).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-success)] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            {bucket.description && (
              <div>
                <p className="text-small font-medium text-[var(--color-text)] mb-1">Description</p>
                <p className="text-body text-[var(--color-text-muted)]">{bucket.description}</p>
              </div>
            )}

            {/* Transactions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title text-[var(--color-text)]">Transactions</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddTransaction(true)}
                >
                  Add Transaction
                </Button>
              </div>

              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((transaction) => {
                    const isPositive = ['deposit', 'transfer_in'].includes(transaction.transaction_type);
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-small font-medium text-[var(--color-text)]">
                              {transaction.transaction_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="text-caption text-[var(--color-text-muted)]">
                              {formatDate(transaction.date)}
                            </span>
                          </div>
                          {transaction.description && (
                            <p className="text-caption text-[var(--color-text-muted)] mt-1">
                              {transaction.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-body font-medium ${
                              isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                            }`}
                          >
                            {isPositive ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                            title="Delete transaction"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <p>No transactions yet</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddTransaction(true)}
                    className="mt-4"
                  >
                    Add First Transaction
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {showAddTransaction && (
        <AddTransactionModal
          bucketId={bucketId}
          onClose={() => setShowAddTransaction(false)}
          onSuccess={() => {
            setShowAddTransaction(false);
            // Reload data
            savingsService.getBucketById(bucketId).then(setBucket);
            savingsService.getBucketTransactions(bucketId).then(setTransactions);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
