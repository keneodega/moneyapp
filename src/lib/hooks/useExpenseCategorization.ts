import { useState, useCallback, useRef } from 'react';

interface CategorizationResult {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface UseExpenseCategorizationOptions {
  debounceMs?: number;
  minDescriptionLength?: number;
}

export function useExpenseCategorization(options: UseExpenseCategorizationOptions = {}) {
  const { debounceMs = 500, minDescriptionLength = 3 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const categorize = useCallback(
    async (description: string, availableCategories: string[]) => {
      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state if description is too short
      if (description.trim().length < minDescriptionLength) {
        setSuggestion(null);
        setError(null);
        return;
      }

      // Debounce the API call
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        setError(null);

        abortControllerRef.current = new AbortController();

        try {
          const response = await fetch('/api/ai/categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, availableCategories }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to get suggestion');
          }

          const result: CategorizationResult = await response.json();
          setSuggestion(result);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // Request was aborted, ignore
            return;
          }
          setError(err instanceof Error ? err.message : 'Failed to categorize');
          setSuggestion(null);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs, minDescriptionLength]
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  return {
    categorize,
    clearSuggestion,
    suggestion,
    isLoading,
    error,
  };
}
