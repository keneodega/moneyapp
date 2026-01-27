'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmDialogContextValue {
  showConfirm: (options: ConfirmDialogOptions) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showConfirm = useCallback((newOptions: ConfirmDialogOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
  }, []);

  const handleConfirm = async () => {
    if (!options) return;
    
    setIsProcessing(true);
    try {
      await options.onConfirm();
      setIsOpen(false);
      setOptions(null);
    } catch (error) {
      console.error('Error in confirm action:', error);
      // Keep dialog open on error so user can retry
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (options?.onCancel) {
      options.onCancel();
    }
    setIsOpen(false);
    setOptions(null);
    setIsProcessing(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <ConfirmDialogContext.Provider value={{ showConfirm }}>
      {children}
      {isOpen && options && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <Card
            variant="raised"
            padding="lg"
            className="max-w-md w-full mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-dialog-title"
              className="text-title text-[var(--color-text)] mb-2"
            >
              {options.title}
            </h2>
            <p
              id="confirm-dialog-message"
              className="text-body text-[var(--color-text-muted)] mb-6"
            >
              {options.message}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                {options.cancelText || 'Cancel'}
              </Button>
              <Button
                variant={options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={handleConfirm}
                isLoading={isProcessing}
              >
                {options.confirmText || 'Confirm'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}
