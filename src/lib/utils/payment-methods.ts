/**
 * Payment Methods Utility
 * 
 * Filters and validates payment methods to ensure they match valid bank_type enum values.
 * Custom payment methods from settings may not match the enum, so we need to filter/map them.
 */

export interface PaymentMethod {
  value: string;
  label: string;
}

/**
 * Filter payment methods to remove duplicates.
 *
 * Since bank columns were migrated from enum to TEXT, custom values are
 * stored as-is. No mapping is needed.
 *
 * @param methods - Array of payment methods from settings
 * @returns Deduplicated array of payment methods
 */
export function filterValidPaymentMethods(methods: PaymentMethod[]): PaymentMethod[] {
  return methods.filter((method, index, self) =>
    index === self.findIndex(m => m.value === method.value)
  );
}

/**
 * Validate a bank value for storage.
 *
 * Since bank columns were migrated from enum to TEXT, this now passes through
 * the raw value. Custom payment methods (e.g., "Starling") are stored as-is.
 *
 * @param bankValue - The bank value to validate
 * @returns The bank value trimmed, or undefined if empty
 */
export function validateBankType(bankValue: string | null | undefined): string | undefined {
  if (!bankValue || !bankValue.trim()) {
    return undefined;
  }
  return bankValue.trim();
}

/**
 * Default payment methods (valid enum values)
 */
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { value: 'AIB', label: 'AIB' },
  { value: 'Revolut', label: 'Revolut' },
  { value: 'N26', label: 'N26' },
  { value: 'Wise', label: 'Wise' },
  { value: 'Bank of Ireland', label: 'Bank of Ireland' },
  { value: 'Ulster Bank', label: 'Ulster Bank' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];
