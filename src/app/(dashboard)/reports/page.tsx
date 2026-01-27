'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, SkeletonCard } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ReportsService, type TimePeriod, type DateRange } from '@/lib/services';
import { SpendingTrendsChart } from './SpendingTrendsChart';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { YearOverYearChart } from './YearOverYearChart';

type ReportTab = 'trends' | 'categories' | 'year-over-year';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('trends');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      startDate: startOfYear.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  });

  // Period for trends
  const [trendPeriod, setTrendPeriod] = useState<TimePeriod>('month');

  // Data state
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [yearOverYearData, setYearOverYearData] = useState<any[]>([]);

  const supabase = createSupabaseBrowserClient();
  const reportsService = new ReportsService(supabase);

  const loadTrendsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportsService.getSpendingTrends(trendPeriod, dateRange);
      setTrendsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spending trends');
      console.error('Error loading trends:', err);
    } finally {
      setLoading(false);
    }
  }, [trendPeriod, dateRange, reportsService]);

  const loadCategoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportsService.getCategoryBreakdown(dateRange);
      setCategoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category breakdown');
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, reportsService]);

  const loadYearOverYearData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportsService.getYearOverYearComparison();
      setYearOverYearData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load year-over-year data');
      console.error('Error loading year-over-year:', err);
    } finally {
      setLoading(false);
    }
  }, [reportsService]);

  // Load data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'trends':
        loadTrendsData();
        break;
      case 'categories':
        loadCategoryData();
        break;
      case 'year-over-year':
        loadYearOverYearData();
        break;
    }
  }, [activeTab, loadTrendsData, loadCategoryData, loadYearOverYearData]);

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
  };

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'trends', label: 'Spending Trends' },
    { id: 'categories', label: 'Category Breakdown' },
    { id: 'year-over-year', label: 'Year-over-Year' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-[var(--color-text)]">Reports & Analytics</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-2">
            Analyze your spending patterns and financial trends
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-small font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab !== 'year-over-year' && (
        <Card variant="outlined" padding="md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-small text-[var(--color-text-muted)]">From:</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  handleDateRangeChange(e.target.value, dateRange.endDate)
                }
                className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small min-h-[44px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-small text-[var(--color-text-muted)]">To:</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  handleDateRangeChange(dateRange.startDate, e.target.value)
                }
                className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small min-h-[44px]"
              />
            </div>
            {activeTab === 'trends' && (
              <div className="flex items-center gap-2">
                <label className="text-small text-[var(--color-text-muted)]">Period:</label>
                <select
                  value={trendPeriod}
                  onChange={(e) => setTrendPeriod(e.target.value as TimePeriod)}
                  className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small min-h-[44px]"
                >
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card variant="outlined" padding="md" className="border-[var(--color-danger)]">
          <p className="text-body text-[var(--color-danger)]">{error}</p>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {activeTab === 'trends' && <SpendingTrendsChart data={trendsData} period={trendPeriod} />}
          {activeTab === 'categories' && <CategoryBreakdownChart data={categoryData} />}
          {activeTab === 'year-over-year' && <YearOverYearChart data={yearOverYearData} />}
        </>
      )}
    </div>
  );
}
