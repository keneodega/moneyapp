'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoanService, SettingsService } from '@/lib/services';
import { 
  FrequencyType, 
  LoanStatusType,
  LoanType,
} from '@/lib/supabase/database.types';
import { Card, Button, Input, PageHeader } from '@/components/ui';

const frequencies: FrequencyType[] = ['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually'];
const statuses: LoanStatusType[] = ['Active', 'Paid Off', 'Defaulted', 'Refinanced', 'Closed'];
const loanTypes: LoanType[] = ['Mortgage', 'Car Loan', 'Personal Loan', 'Student Loan', 'Credit Card', 'Other'];

// Default fallbacks
const DEFAULT_PAYMENT_METHODS = [
  { value: 'AIB', label: 'AIB' },
  { value: 'Revolut', label: 'Revolut' },
  { value: 'N26', label: 'N26' },
  { value: 'Wise', label: 'Wise' },
  { value: 'Bank of Ireland', label: 'Bank of Ireland' },
  { value: 'Ulster Bank', label: 'Ulster Bank' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];

const DEFAULT_PERSONS = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

export default function NewLoanPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic options from Settings
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [persons, setPersons] = useState(DEFAULT_PERSONS);
  
  const [formData, setFormData] = useState({
    name: '',
    loan_type: 'Other' as LoanType,
    original_amount: '',
    current_balance: '',
    interest_rate: '0',
    monthly_payment: '',
    payment_frequency: 'Monthly' as FrequencyType,
    status: 'Active' as LoanStatusType,
    bank: '',
    lender_name: '',
    person: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    payment_method: '',
    description: '',
  });

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsService = new SettingsService(supabase);
        
        const [methods, people] = await Promise.all([
          settingsService.getPaymentMethods(),
          settingsService.getPeople(),
        ]);
        
        if (methods.length > 0) setPaymentMethods(methods);
        if (people.length > 0) setPersons(people);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const service = new LoanService(supabase);
      await service.create({
        name: formData.name,
        loan_type: formData.loan_type,
        original_amount: parseFloat(formData.original_amount),
        current_balance: formData.current_balance 
          ? parseFloat(formData.current_balance) 
          : parseFloat(formData.original_amount),
        interest_rate: parseFloat(formData.interest_rate) || 0,
        monthly_payment: parseFloat(formData.monthly_payment),
        payment_frequency: formData.payment_frequency,
        status: formData.status,
        bank: formData.bank || null,
        lender_name: formData.lender_name || null,
        person: formData.person || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        payment_method: formData.payment_method || null,
        description: formData.description || null,
      });
      router.push('/loans');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Add Loan"
        subtitle="Track a new loan or debt"
        actions={
          <Link
            href="/loans"
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
          </Link>
        }
      />

      <Card variant="outlined" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/50 text-red-400">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Loan Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Car Loan - Toyota"
              required
            />
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Loan Type
              </label>
              <select
                value={formData.loan_type}
                onChange={(e) => setFormData({ ...formData, loan_type: e.target.value as LoanType })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              >
                {loanTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Original Loan Amount (€)"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.original_amount}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ 
                  ...formData, 
                  original_amount: value,
                  current_balance: formData.current_balance || value
                });
              }}
              placeholder="10000.00"
              required
            />
            
            <Input
              label="Current Balance (€)"
              type="number"
              step="0.01"
              min="0"
              value={formData.current_balance}
              onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
              placeholder="Auto-filled from original amount"
              required
            />
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Monthly Payment (€)"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.monthly_payment}
              onChange={(e) => setFormData({ ...formData, monthly_payment: e.target.value })}
              placeholder="500.00"
              required
            />
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Payment Frequency
              </label>
              <select
                value={formData.payment_frequency}
                onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value as FrequencyType })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {frequencies.map((freq) => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interest Rate */}
          <Input
            label="Interest Rate (Annual %)"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.interest_rate}
            onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
            placeholder="5.5"
          />

          {/* Lender and Bank */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Lender Name"
              value={formData.lender_name}
              onChange={(e) => setFormData({ ...formData, lender_name: e.target.value })}
              placeholder="e.g., Bank of Ireland, Credit Union"
            />
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Bank/Institution
              </label>
              <select
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method and Person */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Person
              </label>
              <select
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {persons.map((person) => (
                  <option key={person.value} value={person.value}>{person.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            
            <Input
              label="End Date / Maturity Date (optional)"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as LoanStatusType })}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add any notes about this loan..."
              rows={3}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Loan'}
            </Button>
            <Link href="/loans">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}
