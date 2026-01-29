'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface SearchResult {
  type: 'expense' | 'budget' | 'goal';
  id: string;
  title: string;
  subtitle?: string;
  amount?: number;
  date?: string;
  href: string;
}

interface GlobalSearchProps {
  onResultClick?: () => void;
}

export function GlobalSearch({ onResultClick }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setResults([]);
        return;
      }

      const searchTerm = `%${searchQuery.toLowerCase()}%`;
      const allResults: SearchResult[] = [];

      // Search expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          date,
          budgets!inner(
            id,
            name,
            monthly_overview_id,
            monthly_overviews!inner(id, name)
          )
        `)
        .eq('user_id', user.id)
        .or(`description.ilike.${searchTerm}`)
        .limit(10);

      if (expenses) {
        expenses.forEach((exp: any) => {
          allResults.push({
            type: 'expense',
            id: exp.id,
            title: exp.description || 'Expense',
            subtitle: exp.budgets?.name,
            amount: Number(exp.amount),
            date: exp.date,
            href: `/months/${exp.budgets?.monthly_overviews?.id}/budgets/${exp.budgets?.id}`,
          });
        });
      }

      // Search budgets
      const { data: budgets } = await supabase
        .from('budgets')
        .select(`
          id,
          name,
          monthly_overview_id,
          monthly_overviews!inner(id, name, user_id)
        `)
        .eq('monthly_overviews.user_id', user.id)
        .ilike('name', searchTerm)
        .limit(10);

      if (budgets) {
        budgets.forEach((budget: any) => {
          allResults.push({
            type: 'budget',
            id: budget.id,
            title: budget.name,
            subtitle: budget.monthly_overviews?.name,
            href: `/months/${budget.monthly_overview_id}/budgets/${budget.id}`,
          });
        });
      }

      // Search goals
      const { data: goals } = await supabase
        .from('financial_goals')
        .select('id, name, target_amount, current_amount')
        .eq('user_id', user.id)
        .ilike('name', searchTerm)
        .limit(10);

      if (goals) {
        goals.forEach((goal: any) => {
          allResults.push({
            type: 'goal',
            id: goal.id,
            title: goal.name,
            subtitle: `Target: €${Number(goal.target_amount).toLocaleString()}`,
            amount: Number(goal.current_amount),
            href: `/goals/${goal.id}`,
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  }, [search]);

  const handleResultClick = useCallback((href: string) => {
    router.push(href);
    setShowResults(false);
    setQuery('');
    onResultClick?.();
  }, [router, onResultClick]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="search"
          placeholder="Search expenses, budgets, goals..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setShowResults(true)}
          className="w-full h-12 pl-12 pr-4 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {showResults && (query || results.length > 0) && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowResults(false)}
          />
          <Card
            variant="raised"
            padding="none"
            className="absolute top-full mt-2 left-0 right-0 z-50 max-h-[400px] overflow-y-auto shadow-lg"
          >
            {results.length === 0 && query ? (
              <div className="p-4 text-center text-small text-[var(--color-text-muted)]">
                No results found
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result.href)}
                    className="w-full text-left p-4 hover:bg-[var(--color-surface-sunken)] transition-colors min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-caption px-2 py-0.5 rounded-full ${
                            result.type === 'expense' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' :
                            result.type === 'budget' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' :
                            'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                          }`}>
                            {result.type}
                          </span>
                          <p className="text-body font-medium text-[var(--color-text)] truncate">
                            {result.title}
                          </p>
                        </div>
                        {result.subtitle && (
                          <p className="text-small text-[var(--color-text-muted)] truncate">
                            {result.subtitle}
                          </p>
                        )}
                        {result.date && (
                          <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                            {new Date(result.date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {result.amount !== undefined && (
                        <span className="text-body font-medium text-[var(--color-text)] tabular-nums flex-shrink-0">
                          {formatCurrency(result.amount)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
