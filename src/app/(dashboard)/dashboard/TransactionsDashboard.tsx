'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, DashboardTile, SkeletonCard, SkeletonTable } from '@/components/ui';

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

  const loadTransactions = useCallback(async () => {
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
  }, [dateRange, filter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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

  // Memoize filtered transactions and calculations
  const { totalIncome, totalExpenses, net, filteredTransactions } = useMemo(() => {
    const filtered = filter === 'all' 
      ? transactions 
      : transactions.filter((t) => t.type === filter);
    
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      net: income - expenses,
      filteredTransactions: filtered,
    };
  }, [transactions, filter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardTile
          title="Total Income"
          value={formatCurrency(totalIncome)}
          helper="Incoming cashflow"
          tone="success"
        />
        <DashboardTile
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          helper="Outgoing cashflow"
          tone="danger"
        />
        <DashboardTile
          title="Net"
          value={formatCurrency(net)}
          helper="Income minus expenses"
          tone={net >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Filter Buttons */}
      <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]/60 p-1 border border-[var(--color-border)]">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('income')}
          className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium transition-colors ${
            filter === 'income'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Income
        </button>
        <button
          onClick={() => setFilter('expenses')}
          className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium transition-colors ${
            filter === 'expenses'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Expenses
        </button>
      </div>

      {/* Transactions List */}
      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)]">No transactions in this period</p>
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 px-4 py-2 text-caption text-[var(--color-text-muted)]">
              <span>Description</span>
              <span>Category</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
            </div>
            {filteredTransactions.map((transaction) => (
              <Card
                key={`${transaction.type}-${transaction.id}`}
                variant="outlined"
                padding="md"
                hover
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
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
                    <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
                      {transaction.category && <span>{transaction.category}</span>}
                      {transaction.monthName && (
                        <>
                          <span>•</span>
                          <span>{transaction.monthName}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDate(transaction.date)}</span>
                    </div>
                  </div>
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 items-center text-caption text-[var(--color-text-muted)] min-w-[340px]">
                    <span>{transaction.category || '-'}</span>
                    <span>{formatDate(transaction.date)}</span>
                    <span className={`text-right text-body font-medium tabular-nums ${
                      transaction.type === 'income'
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-danger)]'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  <p
                    className={`sm:hidden text-body font-medium tabular-nums ml-4 ${
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
            ))}
          </>
        )}
      </div>
    </div>
  );
}
