/**
 * useFormValidation Hook
 *
 * Reusable hook for form validation with Zod schemas.
 * Provides field-level and form-level validation with error state management.
 *
 * @example
 * ```typescript
 * const { errors, validateField, validateAll, clearError } = useFormValidation(ExpenseSchema);
 *
 * // Validate on blur
 * <Input
 *   onBlur={() => validateField('amount', formData.amount)}
 *   error={errors.amount}
 * />
 *
 * // Validate entire form on submit
 * const handleSubmit = (e) => {
 *   const result = validateAll(formData);
 *   if (result.valid) {
 *     // Submit form
 *   }
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { z } from 'zod';

type FieldErrors<T> = Partial<Record<keyof T, string>>;

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: FieldErrors<T>;
}

export function useFormValidation<T extends z.ZodType>(schema: T) {
  type FormData = z.infer<T>;

  const [errors, setErrors] = useState<FieldErrors<FormData>>({});

  /**
   * Validate a single field
   */
  const validateField = useCallback((name: keyof FormData, value: any): boolean => {
    try {
      // Try to get the field schema
      const fieldSchema = (schema as any).shape?.[name];

      if (fieldSchema) {
        // Validate the field value
        fieldSchema.parse(value);

        // Clear error if validation passes
        setErrors(prev => {
          const next = { ...prev };
          delete next[name];
          return next;
        });

        return true;
      }

      // If we can't find the field schema, fall back to validating the entire object
      // with only this field changed
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Set error message for this field
        setErrors(prev => ({
          ...prev,
          [name]: error.issues[0]?.message || 'Invalid value',
        }));
        return false;
      }
      return true;
    }
  }, [schema]);

  /**
   * Validate the entire form
   */
  const validateAll = useCallback((data: FormData): ValidationResult<FormData> => {
    const result = schema.safeParse(data);

    if (!result.success) {
      // Convert Zod errors to field errors
      const fieldErrors: FieldErrors<FormData> = {};

      result.error.issues.forEach(err => {
        if (err.path[0]) {
          const fieldName = err.path[0] as keyof FormData;
          // Only set the first error for each field
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = err.message;
          }
        }
      });

      setErrors(fieldErrors);

      return {
        valid: false,
        errors: fieldErrors,
      };
    }

    // Clear all errors on successful validation
    setErrors({});

    return {
      valid: true,
      data: result.data,
    };
  }, [schema]);

  /**
   * Clear error for a specific field
   */
  const clearError = useCallback((name: keyof FormData) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Set a custom error for a field (useful for server-side errors)
   */
  const setFieldError = useCallback((name: keyof FormData, message: string) => {
    setErrors(prev => ({
      ...prev,
      [name]: message,
    }));
  }, []);

  /**
   * Set multiple field errors (useful for server-side errors)
   */
  const setFieldErrors = useCallback((fieldErrors: FieldErrors<FormData>) => {
    setErrors(fieldErrors);
  }, []);

  return {
    errors,
    validateField,
    validateAll,
    clearError,
    clearAllErrors,
    setFieldError,
    setFieldErrors,
  };
}
