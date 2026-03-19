'use client';

import { useCallback } from 'react';
import { useReportExportDialog } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { exportMonthReport } from '@/lib/utils/export';

interface MonthOption {
  id: string;
  name: string;
  start_date: string;
}

export function ReportButton({ months }: { months: MonthOption[] }) {
  const { showReportExportDialog } = useReportExportDialog();

  const handleClick = useCallback(() => {
    showReportExportDialog({
      months,
      onExport: async (monthIds, format) => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await exportMonthReport(supabase, user.id, monthIds, format);
      },
    });
  }, [months, showReportExportDialog]);

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] text-[var(--color-text)] font-medium hover:bg-[var(--color-border)] transition-colors"
    >
      <DownloadIcon className="w-5 h-5" />
      Report
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
