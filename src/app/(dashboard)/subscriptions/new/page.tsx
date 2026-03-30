'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SubscriptionService, SettingsService } from '@/lib/services';
import { 
  FrequencyType, 
  SubscriptionStatusType,
} from '@/lib/supabase/database.types';
import { Card, Button, Input, PageHeader } from '@/components/ui';
import { validateBankType } from '@/lib/utils/payment-methods';

const frequencies: FrequencyType[] = ['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually'];
const statuses: SubscriptionStatusType[] = ['Active', 'Paused', 'Cancelled', 'Ended'];

export default function NewSubscriptionPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic options from Settings (loaded in useEffect, service provides fallback defaults)
  const [subscriptionTypes, setSubscriptionTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ value: string; label: string }>>([]);
  const [persons, setPersons] = useState<Array<{ value: string; label: string }>>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'Monthly' as FrequencyType,
    subscription_type: '',
    status: 'Active' as SubscriptionStatusType,
    bank: '',
    person: '',
    is_essential: true,
    is_company_paid: false,
    collection_day: '',
    start_date: new Date().toISOString().split('T')[0],
    last_collection_date: '',
    description: '',
  });

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsService = new SettingsService(supabase);
        
        const [types, methods, people] = await Promise.all([
          settingsService.getSubscriptionTypes(),
          settingsService.getPaymentMethods(),
          settingsService.getPeople(),
        ]);
        
        setSubscriptionTypes(types);
        setPaymentMethods(methods);
        setPersons(people);
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
      const service = new SubscriptionService(supabase);
      await service.create({
        name: formData.name,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        subscription_type: formData.subscription_type || null,
        status: formData.status,
        bank: validateBankType(formData.bank) ?? null,
        person: formData.person || null,
        is_essential: formData.is_essential,
        is_company_paid: formData.is_company_paid,
        collection_day: formData.collection_day ? parseInt(formData.collection_day) : null,
        start_date: formData.start_date || null,
        last_collection_date: formData.last_collection_date || null,
        description: formData.description || null,
      } as any);
      router.push('/subscriptions');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Add Subscription"
        subtitle="Track a new recurring payment"
        actions={
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
          </button>
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
              label="Subscription Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Netflix, Spotify"
              required
            />
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Type
              </label>
              <select
                value={formData.subscription_type}
                onChange={(e) => setFormData({ ...formData, subscription_type: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {subscriptionTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount and Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Amount (€)"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="9.99"
              required
            />
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as FrequencyType })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {frequencies.map((freq) => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Payment Method
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
            
            <Input
              label="Collection Day (1-31)"
              type="number"
              min="1"
              max="31"
              value={formData.collection_day}
              onChange={(e) => setFormData({ ...formData, collection_day: e.target.value })}
              placeholder="e.g., 15"
            />
          </div>

          {/* Person and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as SubscriptionStatusType })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Essential/Non-Essential */}
          <div>
            <label className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.is_essential}
                onChange={(e) => setFormData({ ...formData, is_essential: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
              />
              <div>
                <div className="text-small font-medium text-[var(--color-text)]">
                  Essential Subscription
                </div>
                <div className="text-caption text-[var(--color-text-muted)]">
                  Uncheck if this is a non-essential subscription (e.g., entertainment, optional services)
                </div>
              </div>
            </label>
          </div>

          {/* Company Paid */}
          <div>
            <label className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formData.is_company_paid}
                onChange={(e) => setFormData({ ...formData, is_company_paid: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
              />
              <div>
                <div className="text-small font-medium text-[var(--color-text)]">
                  Company Paid (KHO)
                </div>
                <div className="text-caption text-[var(--color-text-muted)]">
                  Check if this subscription is paid by KHO before your salary
                </div>
              </div>
            </label>
          </div>

          {/* Start Date and Last Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="Last Payment Date"
              type="date"
              value={formData.last_collection_date}
              onChange={(e) => setFormData({ ...formData, last_collection_date: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add any notes about this subscription..."
              rows={3}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Subscription'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
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
