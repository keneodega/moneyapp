'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScoreGauge, ProgressBar } from '@/components/ui';
import type {
  FinancialHealthScore,
  AIHealthRecommendation,
} from '@/lib/supabase/database.types';

interface HealthScoreResponse {
  score: FinancialHealthScore | null;
  canCalculate: boolean;
  missingData?: {
    hasIncome: boolean;
    hasBudgets: boolean;
    message: string;
  };
  previousScore?: number;
  trend?: 'up' | 'down' | 'stable';
  generatedAt: string;
}

const categoryIcons: Record<string, string> = {
  savings: '💰',
  debt: '💳',
  budget: '📊',
  general: '💡',
};

const categoryColors: Record<string, string> = {
  savings: 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
  debt: 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20',
  budget: 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
  general: 'bg-[var(--color-info)]/10 border-[var(--color-info)]/20',
};

export function FinancialHealthWidget() {
  const [data, setData] = useState<HealthScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchScore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/health-score');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch health score');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Health score fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health score');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-[var(--color-success)]">↑</span>;
      case 'down':
        return <span className="text-[var(--color-danger)]">↓</span>;
      default:
        return <span className="text-[var(--color-text-muted)]">→</span>;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[var(--color-success)]/20 animate-pulse" />
            <div className="h-4 w-32 bg-[var(--color-surface-sunken)] rounded animate-pulse" />
          </div>
        </div>
        <div className="flex justify-center py-4">
          <div className="w-24 h-24 rounded-full bg-[var(--color-surface-sunken)] animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-[var(--color-surface-sunken)] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-danger)]">⚠️</span>
          <span className="text-small font-medium text-[var(--color-text)]">
            Financial Health
          </span>
        </div>
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
          <p className="text-small text-[var(--color-danger)]">{error}</p>
        </div>
        <button
          onClick={fetchScore}
          className="text-small font-medium text-[var(--color-primary)] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Can't calculate state
  if (!data?.canCalculate || !data?.score) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">📊</span>
          <span className="text-small font-medium text-[var(--color-text)]">
            Financial Health
          </span>
        </div>
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-center">
          <p className="text-small text-[var(--color-text-muted)]">
            {data?.missingData?.message || 'Add financial data to see your health score.'}
          </p>
        </div>
      </div>
    );
  }

  const score = data.score;
  const recommendations = score.ai_recommendations || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-success)]">💚</span>
          <span className="text-small font-medium text-[var(--color-text)]">
            Financial Health
          </span>
        </div>
        <button
          onClick={fetchScore}
          disabled={loading}
          className="text-caption text-[var(--color-primary)] hover:underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Score Gauge */}
      <div className="flex flex-col items-center py-2">
        <ScoreGauge score={score.overall_score} size="md" label={score.score_label} />
        {data.previousScore !== undefined && (
          <div className="flex items-center gap-1 mt-2 text-caption text-[var(--color-text-muted)]">
            {getTrendIcon(data.trend)}
            <span>
              {data.trend === 'up'
                ? `+${score.overall_score - data.previousScore}`
                : data.trend === 'down'
                  ? `${score.overall_score - data.previousScore}`
                  : 'No change'}{' '}
              from last month
            </span>
          </div>
        )}
      </div>

      {/* Metric Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-caption">
          <span className="text-[var(--color-text-muted)]">Savings Rate</span>
          <span className="font-medium text-[var(--color-text)] tabular-nums">
            {score.savings_rate_score}/40
          </span>
        </div>
        <ProgressBar
          value={score.savings_rate_score}
          max={40}
          size="sm"
          colorMode="default"
        />

        <div className="flex items-center justify-between text-caption mt-2">
          <span className="text-[var(--color-text-muted)]">Debt-to-Income</span>
          <span className="font-medium text-[var(--color-text)] tabular-nums">
            {score.debt_to_income_score}/30
          </span>
        </div>
        <ProgressBar
          value={score.debt_to_income_score}
          max={30}
          size="sm"
          colorMode="default"
        />

        <div className="flex items-center justify-between text-caption mt-2">
          <span className="text-[var(--color-text-muted)]">Budget Adherence</span>
          <span className="font-medium text-[var(--color-text)] tabular-nums">
            {score.budget_adherence_score}/30
          </span>
        </div>
        <ProgressBar
          value={score.budget_adherence_score}
          max={30}
          size="sm"
          colorMode="default"
        />
      </div>

      {/* Expand/Collapse Button */}
      {recommendations.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-small font-medium text-[var(--color-primary)] hover:underline"
        >
          {expanded ? 'Hide recommendations' : `View ${recommendations.length} recommendations`}
        </button>
      )}

      {/* AI Recommendations (Expanded) */}
      {expanded && recommendations.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
          <p className="text-caption font-medium text-[var(--color-text-muted)]">
            AI Recommendations
          </p>
          {recommendations
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 3)
            .map((rec, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-[var(--radius-md)] border ${categoryColors[rec.category] || categoryColors.general}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base">{categoryIcons[rec.category] || '💡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-small font-medium text-[var(--color-text)]">
                      {rec.title}
                    </p>
                    <p className="text-caption text-[var(--color-text-muted)] mt-0.5">
                      {rec.description}
                    </p>
                    {rec.potential_impact && (
                      <p className="text-caption text-[var(--color-success)] mt-1 font-medium">
                        {rec.potential_impact}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Last Updated */}
      <p className="text-caption text-[var(--color-text-subtle)] text-center">
        Updated{' '}
        {new Date(data.generatedAt).toLocaleDateString('en-IE', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}
