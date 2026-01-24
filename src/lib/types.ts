/**
 * Core data types for MoneyApp
 */

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  balance: number;
  currency: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  parentId?: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netWorth: number;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  topCategories: {
    categoryId: string;
    categoryName: string;
    total: number;
    percentage: number;
  }[];
}

// API Request/Response types
export interface CreateTransactionRequest {
  accountId: string;
  categoryId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  date: string;
}

export interface UpdateTransactionRequest extends Partial<CreateTransactionRequest> {}

export interface CreateAccountRequest {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  balance: number;
  currency?: string;
  color?: string;
  icon?: string;
}

export interface UpdateAccountRequest extends Partial<CreateAccountRequest> {}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
