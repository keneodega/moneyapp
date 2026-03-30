'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIAssistant } from './AIAssistantProvider';
import { ActionPreview } from './ActionPreview';
import { InsightResponse } from './InsightResponse';

const dataEntryIntents = ['add_expense', 'add_income', 'add_debtor', 'create_transfer'];

export function AICommandBar() {
  const { messages, isProcessing, sendMessage, closeCommandBar } = useAIAssistant();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) {
      closeCommandBar();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  }

  // Get the most recent assistant message for display
  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-lg mx-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-lg overflow-hidden animate-fade-in-scale">
        {/* Input */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <svg className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... e.g., Spent €60 at Tesco on food"
              disabled={isProcessing}
              className="flex-1 text-body bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
            />
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-caption font-mono rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
              Esc
            </kbd>
          </div>
        </form>

        {/* Response area */}
        {(isProcessing || latestAssistant) && (
          <div className="px-4 py-3 max-h-[40vh] overflow-y-auto">
            {isProcessing && !latestAssistant && (
              <div className="flex items-center gap-2 text-small text-[var(--color-text-muted)]">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            )}

            {latestAssistant && (
              <div className="space-y-1">
                <p className="text-small text-[var(--color-text)]">{latestAssistant.content}</p>
                {latestAssistant.response?.action && dataEntryIntents.includes(latestAssistant.response.intent) && (
                  <ActionPreview
                    messageId={latestAssistant.id}
                    response={latestAssistant.response}
                    confirmed={latestAssistant.confirmed}
                  />
                )}
                {latestAssistant.response && !dataEntryIntents.includes(latestAssistant.response.intent) && (
                  <InsightResponse response={latestAssistant.response} />
                )}
              </div>
            )}

            {isProcessing && latestAssistant && (
              <div className="mt-3 flex items-center gap-2 text-small text-[var(--color-text-muted)]">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            )}
          </div>
        )}

        {/* Empty state with hints */}
        {!isProcessing && !latestAssistant && (
          <div className="px-4 py-3 border-t border-[var(--color-border)]">
            <div className="flex flex-wrap gap-2 text-caption text-[var(--color-text-muted)]">
              <span className="opacity-60">Try:</span>
              {['Spent €60 on food', 'Budget overview', 'Who owes me?'].map(hint => (
                <button
                  key={hint}
                  onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                  className="px-2 py-0.5 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
