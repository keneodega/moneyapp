'use client';

import { useAIAssistant } from './AIAssistantProvider';
import type { AssistantResponse } from '@/app/api/ai/assistant/route';

interface InsightResponseProps {
  response: AssistantResponse;
}

const statusStyles: Record<string, string> = {
  good: 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-accent)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning)]/5 text-[var(--color-warning)]',
  danger: 'border-[var(--color-danger)] bg-[var(--color-danger)]/5 text-[var(--color-danger)]',
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]',
};

export function InsightResponse({ response }: InsightResponseProps) {
  const { sendMessage } = useAIAssistant();
  const { data_points, suggestions } = response;

  return (
    <div className="mt-2 space-y-2">
      {/* Data Points */}
      {data_points && data_points.length > 0 && (
        <div className="grid gap-2">
          {data_points.map((dp, i) => (
            <div
              key={i}
              className={`rounded-[var(--radius-sm)] border px-3 py-2 flex items-center justify-between ${statusStyles[dp.status]}`}
            >
              <span className="text-small">{dp.label}</span>
              <span className="text-small font-semibold">{dp.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions as tappable chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => sendMessage(suggestion)}
              className="px-3 py-1.5 text-caption rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
