'use client';

import { useState, useEffect, useCallback } from 'react';

interface Insight {
  type: 'warning' | 'success' | 'info' | 'tip';
  title: string;
  message: string;
  category?: string;
  priority: number;
}

interface InsightsResponse {
  insights: Insight[];
  generatedAt: string;
}

export function AIInsightsWidget() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/insights');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch insights');
      }

      const data: InsightsResponse = await response.json();
      setInsights(data.insights);
      setLastUpdated(data.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const getInsightStyles = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-[var(--color-warning)]/10',
          border: 'border-[var(--color-warning)]/30',
          icon: 'text-[var(--color-warning)]',
          iconBg: 'bg-[var(--color-warning)]/20',
        };
      case 'success':
        return {
          bg: 'bg-[var(--color-success)]/10',
          border: 'border-[var(--color-success)]/30',
          icon: 'text-[var(--color-success)]',
          iconBg: 'bg-[var(--color-success)]/20',
        };
      case 'tip':
        return {
          bg: 'bg-[var(--color-primary)]/10',
          border: 'border-[var(--color-primary)]/30',
          icon: 'text-[var(--color-primary)]',
          iconBg: 'bg-[var(--color-primary)]/20',
        };
      default:
        return {
          bg: 'bg-[var(--color-surface-sunken)]',
          border: 'border-[var(--color-border)]',
          icon: 'text-[var(--color-text-muted)]',
          iconBg: 'bg-[var(--color-surface-raised)]',
        };
    }
  };

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'tip':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 animate-pulse" />
          <div className="h-4 w-32 bg-[var(--color-surface-sunken)] rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] animate-pulse">
            <div className="h-4 w-3/4 bg-[var(--color-border)] rounded mb-2" />
            <div className="h-3 w-full bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-small text-[var(--color-danger)]">{error}</span>
        </div>
        <button
          onClick={fetchInsights}
          className="mt-2 text-small text-[var(--color-primary)] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-center">
        <p className="text-small text-[var(--color-text-muted)]">
          No insights available. Add more financial data to get personalized recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <SparklesIcon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          </div>
          <span className="text-small font-medium text-[var(--color-text)]">AI Insights</span>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-1"
        >
          <RefreshIcon className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => {
          const styles = getInsightStyles(insight.type);
          return (
            <div
              key={index}
              className={`p-3 rounded-[var(--radius-md)] ${styles.bg} border ${styles.border} transition-all hover:scale-[1.01]`}
            >
              <div className="flex gap-3">
                <div className={`shrink-0 w-7 h-7 rounded-full ${styles.iconBg} flex items-center justify-center ${styles.icon}`}>
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-small font-medium text-[var(--color-text)] leading-tight">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                    {insight.message}
                  </p>
                  {insight.category && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-xs rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
                      {insight.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdated && (
        <p className="text-xs text-[var(--color-text-muted)] text-right">
          Updated {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}
