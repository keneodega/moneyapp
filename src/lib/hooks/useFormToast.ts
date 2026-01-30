/**
 * useFormToast Hook
 *
 * Automatically shows toast notifications based on ActionResult from Server Actions.
 * Integrates with the existing Toast system to provide consistent user feedback.
 *
 * @example
 * ```typescript
 * import { useFormState } from 'react-dom';
 * import { createExpense } from '@/app/actions/expense';
 * import { useFormToast } from '@/lib/hooks/useFormToast';
 *
 * const [state, formAction] = useFormState(createExpense, null);
 * useFormToast(state); // Auto-show toast on success/error
 * ```
 */

import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

interface UseFormToastOptions {
  /**
   * Custom success message. If not provided, uses a default message.
   */
  successMessage?: string;

  /**
   * Whether to show error toasts. Defaults to true.
   */
  showErrorToast?: boolean;

  /**
   * Callback function called on success
   */
  onSuccess?: () => void;

  /**
   * Callback function called on error
   */
  onError?: (error: string) => void;
}

/**
 * Hook to automatically show toasts based on action results
 */
export function useFormToast<T>(
  result: ActionResult<T> | null | undefined,
  options: UseFormToastOptions = {}
) {
  const { showToast } = useToast();
  const {
    successMessage = 'Operation completed successfully',
    showErrorToast = true,
    onSuccess,
    onError,
  } = options;

  useEffect(() => {
    if (!result) return;

    if (result.success) {
      // Show success toast
      showToast(successMessage, 'success');

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } else {
      // Show error toast if enabled
      if (showErrorToast) {
        showToast(result.error, 'error');
      }

      // Call error callback if provided
      if (onError) {
        onError(result.error);
      }
    }
  }, [result, showToast, successMessage, showErrorToast, onSuccess, onError]);
}

/**
 * Hook for showing toasts based on action results without automatic triggering.
 * Useful when you want more control over when toasts are shown.
 */
export function useFormToastActions() {
  const { showToast } = useToast();

  const showSuccessToast = (message: string = 'Operation completed successfully') => {
    showToast(message, 'success');
  };

  const showErrorToast = (message: string) => {
    showToast(message, 'error');
  };

  const showWarningToast = (message: string) => {
    showToast(message, 'warning');
  };

  const showInfoToast = (message: string) => {
    showToast(message, 'info');
  };

  return {
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
  };
}
