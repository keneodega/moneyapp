'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteButtonProps {
  onDelete: () => Promise<void>;
  itemName?: string;
  redirectTo?: string;
  variant?: 'icon' | 'text' | 'full';
  className?: string;
}

export function DeleteButton({ 
  onDelete, 
  itemName = 'item',
  redirectTo,
  variant = 'full',
  className = ''
}: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-small text-[var(--color-text-muted)]">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Yes'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className={`p-2 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors ${className}`}
        title={`Delete ${itemName}`}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className={`text-small text-red-400 hover:text-red-300 transition-colors ${className}`}
      >
        Delete
      </button>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border border-red-500/50 text-red-400 font-medium hover:bg-red-500/10 transition-colors ${className}`}
    >
      <TrashIcon className="w-4 h-4" />
      Delete
    </button>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
