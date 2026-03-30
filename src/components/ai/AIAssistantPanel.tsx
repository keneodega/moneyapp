'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIAssistant } from './AIAssistantProvider';
import { ActionPreview } from './ActionPreview';
import { InsightResponse } from './InsightResponse';

const quickActions = [
  'Add an expense',
  'Budget overview',
  "What's due this month?",
  'Am I on track?',
];

const dataEntryIntents = ['add_expense', 'add_income', 'add_debtor', 'create_transfer'];

export function AIAssistantPanel() {
  const { messages, isProcessing, sendMessage, clearMessages, close } = useAIAssistant();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  }

  return (
    <div className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] max-h-[70vh] flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-lg animate-slide-up-panel overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <h3 className="text-body font-semibold text-[var(--color-text)]">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-caption text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={close}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-small text-[var(--color-text-muted)]">
              Ask me to add expenses, check budgets, or get financial insights.
            </p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-caption rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
            </div>
            <p className="text-caption text-[var(--color-text-muted)]">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-caption font-mono">Cmd+K</kbd> for command bar
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-small text-[var(--color-text)]">{msg.content}</p>
                  {msg.response?.action && dataEntryIntents.includes(msg.response.intent) && (
                    <ActionPreview
                      messageId={msg.id}
                      response={msg.response}
                      confirmed={msg.confirmed}
                    />
                  )}
                  {msg.response && !dataEntryIntents.includes(msg.response.intent) && (
                    <InsightResponse response={msg.response} />
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-small text-[var(--color-text-muted)]">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Spent €60 at Tesco on food..."
            disabled={isProcessing}
            className="flex-1 px-3 py-2 text-small rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
