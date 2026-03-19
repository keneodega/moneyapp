'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface MonthOption {
  id: string;
  name: string;
  start_date: string;
}

interface ReportExportDialogOptions {
  months: MonthOption[];
  preSelectedIds?: string[];
  onExport: (monthIds: string[], format: 'csv' | 'json' | 'pdf') => void | Promise<void>;
}

interface ReportExportDialogContextValue {
  showReportExportDialog: (options: ReportExportDialogOptions) => void;
}

const ReportExportDialogContext = createContext<ReportExportDialogContextValue | undefined>(undefined);

export function useReportExportDialog() {
  const context = useContext(ReportExportDialogContext);
  if (!context) {
    throw new Error('useReportExportDialog must be used within ReportExportDialogProvider');
  }
  return context;
}

function groupByYear(months: MonthOption[]): Record<string, MonthOption[]> {
  return months.reduce((acc, month) => {
    const year = new Date(month.start_date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(month);
    return acc;
  }, {} as Record<string, MonthOption[]>);
}

export function ReportExportDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ReportExportDialogOptions | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const showReportExportDialog = useCallback((newOptions: ReportExportDialogOptions) => {
    setOptions(newOptions);
    setSelectedIds(new Set(newOptions.preSelectedIds || []));
    setSelectedFormat('pdf');
    setIsOpen(true);
  }, []);

  const handleExport = async () => {
    if (!options || selectedIds.size === 0) return;

    setIsExporting(true);
    try {
      await options.onExport(Array.from(selectedIds), selectedFormat);
      setIsOpen(false);
      setOptions(null);
    } catch (error) {
      console.error('Report export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setOptions(null);
    setIsExporting(false);
  };

  const toggleMonth = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleYear = (yearMonths: MonthOption[]) => {
    const yearIds = yearMonths.map((m) => m.id);
    const allSelected = yearIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        yearIds.forEach((id) => next.delete(id));
      } else {
        yearIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (options) setSelectedIds(new Set(options.months.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const grouped = options ? groupByYear(options.months) : {};
  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  return (
    <ReportExportDialogContext.Provider value={{ showReportExportDialog }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-export-title"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="report-export-title" className="text-title text-[var(--color-text)] mb-1">
              Download Report
            </h2>
            <p className="text-small text-[var(--color-text-muted)] mb-6">
              Select the months to include and choose a format.
            </p>

            {/* Format Selection */}
            <div className="mb-6">
              <label className="block text-small font-medium text-[var(--color-text)] mb-3">
                Format
              </label>
              <div className="flex gap-2">
                {(['pdf', 'csv', 'json'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setSelectedFormat(format)}
                    className={`flex-1 px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors min-h-[44px] ${
                      selectedFormat === format
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-small font-medium text-[var(--color-text)]">
                  Select Months
                </label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-small text-[var(--color-primary)] hover:underline">
                    Select All
                  </button>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <button onClick={deselectAll} className="text-small text-[var(--color-primary)] hover:underline">
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {years.map((year) => {
                  const yearMonths = grouped[year];
                  const yearIds = yearMonths.map((m) => m.id);
                  const allYearSelected = yearIds.every((id) => selectedIds.has(id));
                  const someYearSelected = yearIds.some((id) => selectedIds.has(id));

                  return (
                    <div key={year}>
                      <label className="flex items-center gap-2 mb-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={allYearSelected}
                          ref={(el) => { if (el) el.indeterminate = someYearSelected && !allYearSelected; }}
                          onChange={() => toggleYear(yearMonths)}
                          className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                        />
                        <span className="text-small font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                          {year}
                        </span>
                        <span className="text-caption text-[var(--color-text-subtle)]">
                          ({yearMonths.length} month{yearMonths.length !== 1 ? 's' : ''})
                        </span>
                      </label>

                      <div className="ml-6 space-y-1">
                        {yearMonths.map((month) => (
                          <label
                            key={month.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-sunken)] cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(month.id)}
                              onChange={() => toggleMonth(month.id)}
                              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                            />
                            <span className="text-small text-[var(--color-text)]">{month.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedIds.size > 0 && (
              <p className="text-caption text-[var(--color-text-muted)] mb-4">
                {selectedIds.size} month{selectedIds.size !== 1 ? 's' : ''} selected
              </p>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
              <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExport}
                isLoading={isExporting}
                disabled={selectedIds.size === 0}
              >
                <DownloadIcon className="w-4 h-4" />
                Export {selectedFormat.toUpperCase()}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ReportExportDialogContext.Provider>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
