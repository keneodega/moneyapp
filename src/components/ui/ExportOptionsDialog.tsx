'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

export interface ExportOptions {
  months: boolean;
  masterBudgets: boolean;
  goals: boolean;
  subscriptions: boolean;
  expenses: boolean;
  income: boolean;
  budgets: boolean;
}

interface ExportOptionsDialogOptions {
  onExport: (options: ExportOptions, format: 'csv' | 'json' | 'pdf') => void | Promise<void>;
  onCancel?: () => void;
}

interface ExportOptionsDialogContextValue {
  showExportDialog: (options: ExportOptionsDialogOptions) => void;
}

const ExportOptionsDialogContext = createContext<ExportOptionsDialogContextValue | undefined>(undefined);

export function useExportOptionsDialog() {
  const context = useContext(ExportOptionsDialogContext);
  if (!context) {
    throw new Error('useExportOptionsDialog must be used within ExportOptionsDialogProvider');
  }
  return context;
}

export function ExportOptionsDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptionsDialogOptions | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ExportOptions>({
    months: true,
    masterBudgets: true,
    goals: true,
    subscriptions: true,
    expenses: true,
    income: true,
    budgets: true,
  });
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const showExportDialog = useCallback((newOptions: ExportOptionsDialogOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
    // Reset to all selected
    setSelectedOptions({
      months: true,
      masterBudgets: true,
      goals: true,
      subscriptions: true,
      expenses: true,
      income: true,
      budgets: true,
    });
    setSelectedFormat('csv');
  }, []);

  const handleExport = async () => {
    if (!options) return;
    
    // Check if at least one option is selected
    const hasSelection = Object.values(selectedOptions).some(v => v);
    if (!hasSelection) {
      alert('Please select at least one data type to export');
      return;
    }

    setIsExporting(true);
    try {
      await options.onExport(selectedOptions, selectedFormat);
      setIsOpen(false);
      setOptions(null);
    } catch (error) {
      console.error('Error exporting:', error);
      // Keep dialog open on error
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
    setOptions(null);
    setIsExporting(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const toggleOption = (key: keyof ExportOptions) => {
    setSelectedOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    setSelectedOptions({
      months: true,
      masterBudgets: true,
      goals: true,
      subscriptions: true,
      expenses: true,
      income: true,
      budgets: true,
    });
  };

  const deselectAll = () => {
    setSelectedOptions({
      months: false,
      masterBudgets: false,
      goals: false,
      subscriptions: false,
      expenses: false,
      income: false,
      budgets: false,
    });
  };

  const exportOptions: Array<{ key: keyof ExportOptions; label: string; description: string }> = [
    { key: 'months', label: 'Months', description: 'Monthly overviews and periods' },
    { key: 'masterBudgets', label: 'Master Budgets', description: 'Baseline budget categories' },
    { key: 'goals', label: 'Financial Goals', description: 'Savings goals and targets' },
    { key: 'subscriptions', label: 'Subscriptions', description: 'Recurring payments' },
    { key: 'expenses', label: 'Expenses', description: 'All expense transactions' },
    { key: 'income', label: 'Income', description: 'All income sources' },
    { key: 'budgets', label: 'Budgets', description: 'Monthly budget allocations' },
  ];

  return (
    <ExportOptionsDialogContext.Provider value={{ showExportDialog }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="export-dialog-title"
              className="text-title text-[var(--color-text)] mb-2"
            >
              Export Data
            </h2>
            <p className="text-small text-[var(--color-text-muted)] mb-6">
              Select what data you want to export and choose a format.
            </p>

            {/* Format Selection */}
            <div className="mb-6">
              <label className="block text-small font-medium text-[var(--color-text)] mb-3">
                Export Format
              </label>
              <div className="flex gap-2">
                {(['csv', 'json', 'pdf'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`
                      flex-1 px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors
                      ${selectedFormat === format
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }
                    `}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-small font-medium text-[var(--color-text)]">
                  Select Data Types
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-small text-[var(--color-primary)] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-small text-[var(--color-primary)] hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {exportOptions.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions[option.key]}
                      onChange={() => toggleOption(option.key)}
                      className="mt-1 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <div className="text-small font-medium text-[var(--color-text)]">
                        {option.label}
                      </div>
                      <div className="text-caption text-[var(--color-text-muted)]">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExport}
                isLoading={isExporting}
                disabled={!Object.values(selectedOptions).some(v => v)}
              >
                Export {selectedFormat.toUpperCase()}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ExportOptionsDialogContext.Provider>
  );
}
