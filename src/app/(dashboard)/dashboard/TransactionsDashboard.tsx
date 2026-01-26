'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

interface DateRange {
  start: Date;
  end: Date;
}

interface TransactionsDashboardProps {
  dateRange: DateRange;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string;
  category?: string;
  monthName?: string;
}

export function TransactionsDashboard({ dateRange }: TransactionsDashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'income' | 'expenses'>('all');

  useEffect(() => {
    loadTransactions();
  }, [dateRange, filter]);

  async function loadTransactions() {
    try {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const allTransactions: Transaction[] = [];

      // Load income
      if (filter === 'all' || filter === 'income') {
        const { data: income } = await supabase
          .from('income_sources')
          .select(`
            id,
            amount,
            date_paid,
            description,
            source,
            monthly_overviews(
              name
            )
          `)
          .eq('user_id', user.id)
          .gte('date_paid', dateRange.start.toISOString().split('T')[0])
          .lte('date_paid', dateRange.end.toISOString().split('T')[0])
          .order('date_paid', { ascending: false });

        if (income) {
          income.forEach((inc: any) => {
            const monthlyOverview = inc.monthly_overviews as any;
            allTransactions.push({
              id: inc.id,
              type: 'income',
              amount: Number(inc.amount || 0),
              date: inc.date_paid,
              description: inc.description || inc.source || 'Income',
              category: inc.source,
              monthName: monthlyOverview?.name,
            });
          });
        }
      }

      // Load expenses
      if (filter === 'all' || filter === 'expenses') {
        const { data: expenses } = await supabase
          .from('expenses')
          .select(`
            id,
            amount,
            date,
            description,
            budgets(
              name,
              monthly_overview_id,
              monthly_overviews(name)
            )
          `)
          .eq('user_id', user.id)
          .gte('date', dateRange.start.toISOString().split('T')[0])
          .lte('date', dateRange.end.toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (expenses) {
          expenses.forEach((exp: any) => {
            const budget = exp.budgets as any;
            allTransactions.push({
              id: exp.id,
              type: 'expense',
              amount: Number(exp.amount || 0),
              date: exp.date,
              description: exp.description || budget?.name || 'Expense',
              category: budget?.name,
              monthName: budget?.monthly_overviews?.name,
            });
          });
        }
      }

      // Sort by date (newest first)
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpenses;

  if (loading) {
    return <div className="text-body text-[var(--color-text-muted)]">Loading transactions...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Income</p>
          <p className="text-headline text-[var(--color-success)] mt-1 tabular-nums">
            {formatCurrency(totalIncome)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Expenses</p>
          <p className="text-headline text-[var(--color-danger)] mt-1 tabular-nums">
            {formatCurrency(totalExpenses)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Net</p>
          <p className={`text-headline mt-1 tabular-nums ${
            net >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}>
            {formatCurrency(net)}
          </p>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('income')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
            filter === 'income'
              ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Income
        </button>
        <button
          onClick={() => setFilter('expenses')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
            filter === 'expenses'
              ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Expenses
        </button>
      </div>

      {/* Transactions List */}
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)]">No transactions in this period</p>
        ) : (
          transactions.map((transaction) => (
            <Card
              key={`${transaction.type}-${transaction.id}`}
              variant="outlined"
              padding="md"
              hover
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        transaction.type === 'income'
                          ? 'bg-[var(--color-success)]'
                          : 'bg-[var(--color-danger)]'
                      }`}
                    />
                    <p className="text-body font-medium text-[var(--color-text)]">
                      {transaction.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {transaction.category && (
                      <span className="text-caption text-[var(--color-text-muted)]">
                        {transaction.category}
                      </span>
                    )}
                    {transaction.monthName && (
                      <>
                        <span className="text-caption text-[var(--color-text-muted)]">•</span>
                        <span className="text-caption text-[var(--color-text-muted)]">
                          {transaction.monthName}
                        </span>
                      </>
                    )}
                    <span className="text-caption text-[var(--color-text-muted)]">•</span>
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {formatDate(transaction.date)}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-body font-medium tabular-nums ml-4 ${
                    transaction.type === 'income'
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-danger)]'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
