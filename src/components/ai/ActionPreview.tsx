'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { validateBankType } from '@/lib/utils/payment-methods';
import { useAIAssistant } from './AIAssistantProvider';
import type { AssistantResponse } from '@/app/api/ai/assistant/route';

interface ActionPreviewProps {
  messageId: string;
  response: AssistantResponse;
  confirmed?: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const typeLabels: Record<string, string> = {
  expense: 'Expense',
  income: 'Income',
  debtor: 'Debtor',
  transfer: 'Transfer',
};

const typeColors: Record<string, string> = {
  expense: 'text-[var(--color-danger)]',
  income: 'text-[var(--color-accent)]',
  debtor: 'text-[var(--color-info)]',
  transfer: 'text-[var(--color-warning)]',
};

export function ActionPreview({ messageId, response, confirmed }: ActionPreviewProps) {
  const { action, warnings } = response;
  const { markConfirmed, financialContext, close, closeCommandBar } = useAIAssistant();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action) return null;

  const matchedBudget = financialContext?.budgets.find(b => b.id === action.target_id);
  const isOverspending = action.type === 'expense' && matchedBudget && action.amount > matchedBudget.amount_left;
  const isLowConfidence = action.confidence < 0.7;

  async function handleConfirm() {
    if (!action || isOverspending) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (action.type === 'expense') {
        const { error: insertError } = await supabase.from('expenses').insert({
          budget_id: action.target_id,
          user_id: user.id,
          amount: action.amount,
          date: action.date,
          description: action.description || null,
          bank: action.bank ? (validateBankType(action.bank) ?? null) : null,
          is_recurring: false,
        });
        if (insertError) throw insertError;
      } else if (action.type === 'income') {
        const { error: insertError } = await supabase.from('income_sources').insert({
          monthly_overview_id: financialContext?.monthlyOverviewId || action.target_id,
          user_id: user.id,
          amount: action.amount,
          source: action.target_name || 'Other',
          date_paid: action.date,
          description: action.description || null,
          bank: action.bank ? (validateBankType(action.bank) ?? null) : null,
          tithe_deduction: false,
        });
        if (insertError) throw insertError;
      } else if (action.type === 'debtor') {
        const { error: insertError } = await supabase.from('debtors').insert({
          user_id: user.id,
          debtor_name: action.target_name,
          amount_owed: action.amount,
          date_lent: action.date,
          status: 'Pending',
          description: action.description || null,
        });
        if (insertError) throw insertError;
      } else if (action.type === 'transfer') {
        const { error: insertError } = await supabase.from('transfers').insert({
          user_id: user.id,
          amount: action.amount,
          date: action.date,
          description: action.description || null,
          from_budget_id: action.target_id || null,
          to_budget_id: action.secondary_target_id || null,
          transfer_type: 'budget_to_budget',
        });
        if (insertError) throw insertError;
      }

      markConfirmed(messageId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit() {
    if (!action || !financialContext) return;
    close();
    closeCommandBar();

    if (action.type === 'expense') {
      const params = new URLSearchParams();
      params.set('budget', action.target_id);
      if (action.description) params.set('description', action.description);
      router.push(`/months/${financialContext.monthlyOverviewId}/expense/new?${params.toString()}`);
    } else if (action.type === 'income') {
      router.push(`/months/${financialContext.monthlyOverviewId}`);
    } else if (action.type === 'debtor') {
      router.push('/debtors');
    }
  }

  if (confirmed) {
    return (
      <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-3">
        <div className="flex items-center gap-2 text-small text-[var(--color-accent)]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {typeLabels[action.type]} added successfully
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-caption font-semibold uppercase ${typeColors[action.type]}`}>
            {typeLabels[action.type]}
          </span>
          <span className="text-body font-medium text-[var(--color-text)]">
            {action.target_name}
          </span>
        </div>
        <span className="text-title font-semibold text-[var(--color-text)]">
          {formatCurrency(action.amount)}
        </span>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex justify-between text-small">
          <span className="text-[var(--color-text-muted)]">Date</span>
          <span className="text-[var(--color-text)]">{formatDate(action.date)}</span>
        </div>
        {action.description && (
          <div className="flex justify-between text-small">
            <span className="text-[var(--color-text-muted)]">Description</span>
            <span className="text-[var(--color-text)]">{action.description}</span>
          </div>
        )}
        {action.bank && (
          <div className="flex justify-between text-small">
            <span className="text-[var(--color-text-muted)]">Payment</span>
            <span className="text-[var(--color-text)]">{action.bank}</span>
          </div>
        )}
        {action.type === 'expense' && matchedBudget && (
          <div className="flex justify-between text-small">
            <span className="text-[var(--color-text-muted)]">Budget left</span>
            <span className="text-[var(--color-text)]">
              {formatCurrency(matchedBudget.amount_left)} → {formatCurrency(matchedBudget.amount_left - action.amount)}
            </span>
          </div>
        )}
        {action.type === 'transfer' && action.secondary_target_name && (
          <div className="flex justify-between text-small">
            <span className="text-[var(--color-text-muted)]">To</span>
            <span className="text-[var(--color-text)]">{action.secondary_target_name}</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {(isOverspending || isLowConfidence || warnings.length > 0) && (
        <div className="px-4 py-2 border-t border-[var(--color-border)]">
          {isOverspending && (
            <p className="text-caption text-[var(--color-danger)]">
              This exceeds the remaining budget of {formatCurrency(matchedBudget!.amount_left)}
            </p>
          )}
          {isLowConfidence && (
            <p className="text-caption text-[var(--color-warning)]">
              Low confidence match — please verify the category is correct
            </p>
          )}
          {warnings.map((w, i) => (
            <p key={i} className="text-caption text-[var(--color-warning)]">{w}</p>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 border-t border-[var(--color-border)]">
          <p className="text-caption text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-between gap-3">
        <button
          onClick={handleEdit}
          className="px-4 py-2 text-small font-medium rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || !!isOverspending}
          className="px-4 py-2 text-small font-medium rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Adding...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
