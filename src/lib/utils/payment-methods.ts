/**
 * Payment Methods Utility
 * 
 * Filters and validates payment methods to ensure they match valid bank_type enum values.
 * Custom payment methods from settings may not match the enum, so we need to filter/map them.
 */

// Valid bank_type enum values
const VALID_BANK_TYPES: string[] = [
  'AIB', 'Revolut', 'N26', 'Wise', 'Bank of Ireland', 'Ulster Bank', 'Cash', 'Other'
];

export interface PaymentMethod {
  value: string;
  label: string;
}

/**
 * Filter and map payment methods to valid bank_type enum values
 * 
 * @param methods - Array of payment methods from settings
 * @returns Filtered array with only valid bank_type enum values
 */
export function filterValidPaymentMethods(methods: PaymentMethod[]): PaymentMethod[] {
  return methods
    .map(method => {
      // If value is exactly a valid enum, use it
      if (VALID_BANK_TYPES.includes(method.value)) {
        return method;
      }
      // Try to map similar values (e.g., "AIB Havilah" -> "AIB")
      const upperValue = method.value.toUpperCase();
      if (upperValue.startsWith('AIB')) {
        return { value: 'AIB', label: method.label };
      }
      if (upperValue.includes('REVOLUT')) {
        return { value: 'Revolut', label: method.label };
      }
      if (upperValue.includes('N26')) {
        return { value: 'N26', label: method.label };
      }
      if (upperValue.includes('WISE')) {
        return { value: 'Wise', label: method.label };
      }
      if (upperValue.includes('BANK OF IRELAND') || upperValue.includes('BOI')) {
        return { value: 'Bank of Ireland', label: method.label };
      }
      if (upperValue.includes('ULSTER')) {
        return { value: 'Ulster Bank', label: method.label };
      }
      if (upperValue.includes('CASH')) {
        return { value: 'Cash', label: method.label };
      }
      // Default to "Other" for unrecognized values
      return { value: 'Other', label: method.label };
    })
    .filter((method, index, self) => 
      // Remove duplicates
      index === self.findIndex(m => m.value === method.value)
    );
}

/**
 * Validate and map a bank value to a valid bank_type enum value
 * 
 * @param bankValue - The bank value to validate/map
 * @returns A valid bank_type enum value
 */
export function validateBankType(bankValue: string | null | undefined): string | undefined {
  if (!bankValue) {
    return undefined;
  }

  // If value is exactly a valid enum, return it
  if (VALID_BANK_TYPES.includes(bankValue)) {
    return bankValue;
  }

  // Try to map similar values
  const upperValue = bankValue.toUpperCase();
  if (upperValue.startsWith('AIB')) {
    return 'AIB';
  }
  if (upperValue.includes('REVOLUT')) {
    return 'Revolut';
  }
  if (upperValue.includes('N26')) {
    return 'N26';
  }
  if (upperValue.includes('WISE')) {
    return 'Wise';
  }
  if (upperValue.includes('BANK OF IRELAND') || upperValue.includes('BOI')) {
    return 'Bank of Ireland';
  }
  if (upperValue.includes('ULSTER')) {
    return 'Ulster Bank';
  }
  if (upperValue.includes('CASH')) {
    return 'Cash';
  }
  
  // Default to "Other" for unrecognized values
  return 'Other';
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
