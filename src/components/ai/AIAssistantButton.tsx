'use client';

import { useAIAssistant } from './AIAssistantProvider';
import { AIAssistantPanel } from './AIAssistantPanel';
import { AICommandBar } from './AICommandBar';

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
      <path d="M5 3v4" />
      <path d="M3 5h4" />
      <path d="M19 17v4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function AIAssistantButton() {
  const { isOpen, isCommandBarOpen, open, close } = useAIAssistant();

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={isOpen ? close : open}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-sunken)]'
            : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] animate-pulse-soft'
        }`}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {isOpen ? (
          <CloseIcon className="w-5 h-5" />
        ) : (
          <SparklesIcon className="w-6 h-6" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && <AIAssistantPanel />}

      {/* Command Bar */}
      {isCommandBarOpen && <AICommandBar />}
    </>
  );
}
