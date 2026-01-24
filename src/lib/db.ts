/**
 * In-memory data store for development
 * Replace with a real database (Prisma, Drizzle, etc.) in production
 */

import { Transaction, Account, Category } from './types';

// Mock Categories
export const categories: Category[] = [
  { id: 'cat-1', name: 'Salary', type: 'income', icon: '💰', color: '#22c55e' },
  { id: 'cat-2', name: 'Freelance', type: 'income', icon: '💻', color: '#3b82f6' },
  { id: 'cat-3', name: 'Investments', type: 'income', icon: '📈', color: '#8b5cf6' },
  { id: 'cat-4', name: 'Groceries', type: 'expense', icon: '🛒', color: '#f97316' },
  { id: 'cat-5', name: 'Transportation', type: 'expense', icon: '🚗', color: '#ef4444' },
  { id: 'cat-6', name: 'Entertainment', type: 'expense', icon: '🎬', color: '#ec4899' },
  { id: 'cat-7', name: 'Utilities', type: 'expense', icon: '💡', color: '#f59e0b' },
  { id: 'cat-8', name: 'Dining', type: 'expense', icon: '🍽️', color: '#14b8a6' },
  { id: 'cat-9', name: 'Shopping', type: 'expense', icon: '🛍️', color: '#6366f1' },
  { id: 'cat-10', name: 'Healthcare', type: 'expense', icon: '🏥', color: '#06b6d4' },
];

// Mock Accounts
export const accounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'checking',
    balance: 5420.50,
    currency: 'USD',
    color: '#3b82f6',
    icon: '🏦',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'acc-2',
    name: 'Savings',
    type: 'savings',
    balance: 12750.00,
    currency: 'USD',
    color: '#22c55e',
    icon: '🐷',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'acc-3',
    name: 'Credit Card',
    type: 'credit',
    balance: -1250.75,
    currency: 'USD',
    color: '#ef4444',
    icon: '💳',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
  },
];

// Mock Transactions
export const transactions: Transaction[] = [
  {
    id: 'txn-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: 'income',
    amount: 4500.00,
    description: 'Monthly salary',
    date: '2024-01-15',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
  },
  {
    id: 'txn-2',
    accountId: 'acc-1',
    categoryId: 'cat-4',
    type: 'expense',
    amount: 156.32,
    description: 'Weekly groceries',
    date: '2024-01-16',
    createdAt: '2024-01-16T14:30:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
  },
  {
    id: 'txn-3',
    accountId: 'acc-3',
    categoryId: 'cat-8',
    type: 'expense',
    amount: 45.00,
    description: 'Dinner with friends',
    date: '2024-01-17',
    createdAt: '2024-01-17T20:00:00Z',
    updatedAt: '2024-01-17T20:00:00Z',
  },
  {
    id: 'txn-4',
    accountId: 'acc-1',
    categoryId: 'cat-5',
    type: 'expense',
    amount: 55.00,
    description: 'Gas station',
    date: '2024-01-18',
    createdAt: '2024-01-18T08:15:00Z',
    updatedAt: '2024-01-18T08:15:00Z',
  },
  {
    id: 'txn-5',
    accountId: 'acc-2',
    categoryId: 'cat-3',
    type: 'income',
    amount: 250.00,
    description: 'Dividend payment',
    date: '2024-01-18',
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T10:00:00Z',
  },
];

// Helper functions for data manipulation
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
