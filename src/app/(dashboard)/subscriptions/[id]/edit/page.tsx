'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SubscriptionService, SettingsService } from '@/lib/services';
import { 
  FrequencyType, 
  SubscriptionStatusType,
  Subscription
} from '@/lib/supabase/database.types';
import { Card, Button, Input } from '@/components/ui';

const frequencies: FrequencyType[] = ['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually'];
const statuses: SubscriptionStatusType[] = ['Active', 'Paused', 'Cancelled', 'Ended'];

// Default fallbacks
const DEFAULT_SUBSCRIPTION_TYPES = [
  { value: 'Streaming', label: 'Streaming' },
  { value: 'Software', label: 'Software' },
  { value: 'Membership', label: 'Membership' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Utility', label: 'Utility' },
  { value: 'Other', label: 'Other' },
];

const DEFAULT_PAYMENT_METHODS = [
  { value: 'AIB', label: 'AIB' },
  { value: 'Revolut', label: 'Revolut' },
  { value: 'N26', label: 'N26' },
  { value: 'Wise', label: 'Wise' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];

const DEFAULT_PERSONS = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

export default function EditSubscriptionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseBrowserClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  
  // Dynamic options from Settings
  const [subscriptionTypes, setSubscriptionTypes] = useState(DEFAULT_SUBSCRIPTION_TYPES);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [persons, setPersons] = useState(DEFAULT_PERSONS);
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'Monthly' as FrequencyType,
    subscription_type: '',
    status: 'Active' as SubscriptionStatusType,
    bank: '',
    person: '',
    collection_day: '',
    start_date: '',
    end_date: '',
    description: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings first
        const settingsService = new SettingsService(supabase);
        const [types, methods, people] = await Promise.all([
          settingsService.getSubscriptionTypes(),
          settingsService.getPaymentMethods(),
          settingsService.getPeople(),
        ]);
        
        if (types.length > 0) setSubscriptionTypes(types);
        if (methods.length > 0) setPaymentMethods(methods);
        if (people.length > 0) setPersons(people);

        // Load subscription data
        const service = new SubscriptionService(supabase);
        const data = await service.getById(id);
        setSubscription(data);
        setFormData({
          name: data.name,
          amount: data.amount.toString(),
          frequency: data.frequency,
          subscription_type: data.subscription_type || '',
          status: data.status,
          bank: data.bank || '',
          person: data.person || '',
          collection_day: data.collection_day?.toString() || '',
          start_date: data.start_date || '',
          end_date: data.end_date || '',
          description: data.description || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const service = new SubscriptionService(supabase);
      await service.update(id, {
        name: formData.name,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        subscription_type: formData.subscription_type || null,
        status: formData.status,
        bank: formData.bank || null,
        person: formData.person || null,
        collection_day: formData.collection_day ? parseInt(formData.collection_day) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        description: formData.description || null,
      } as any);
      router.push('/subscriptions');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card variant="outlined" padding="lg" className="text-center">
        <h2 className="text-title text-[var(--color-text)] mb-2">Subscription Not Found</h2>
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          The subscription you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/subscriptions">
          <Button variant="secondary">Back to Subscriptions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link
          href="/subscriptions"
          className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
        </Link>
        <div>
          <h1 className="text-display text-[var(--color-text)]">Edit Subscription</h1>
          <p className="text-body text-[var(--color-text-muted)]">
            Update {subscription.name}
          </p>
        </div>
      </div>

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

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="End Date (if cancelled)"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Link href="/subscriptions">
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
