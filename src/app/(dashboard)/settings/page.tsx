'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SettingsService } from '@/lib/services';
import type { AppSetting } from '@/lib/services/settings.service';

type SettingType = 'payment_method' | 'budget_category' | 'income_source' | 'person';

const SETTING_LABELS: Record<SettingType, { title: string; description: string }> = {
  payment_method: {
    title: 'Payment Methods',
    description: 'Banks and payment methods for tracking expenses',
  },
  budget_category: {
    title: 'Budget Categories',
    description: 'Categories available when creating new budgets',
  },
  income_source: {
    title: 'Income Sources',
    description: 'Types of income sources',
  },
  person: {
    title: 'People',
    description: 'Family members for tracking who income/expenses belong to',
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<SettingType, AppSetting[]>>({
    payment_method: [],
    budget_category: [],
    income_source: [],
    person: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [newValues, setNewValues] = useState<Record<SettingType, string>>({
    payment_method: '',
    budget_category: '',
    income_source: '',
    person: '',
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        const settingsService = new SettingsService(supabase);
        const allSettings = await settingsService.getAllSettings();
        setSettings(allSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  const handleAdd = async (type: SettingType) => {
    const value = newValues[type].trim();
    if (!value) return;

    setSaving(type);
    try {
      const supabase = createSupabaseBrowserClient();
      const settingsService = new SettingsService(supabase);
      await settingsService.addSetting(type, value);
      
      // Refresh settings
      const allSettings = await settingsService.getAllSettings();
      setSettings(allSettings);
      setNewValues(prev => ({ ...prev, [type]: '' }));
    } catch (error) {
      console.error('Failed to add setting:', error);
      alert('Failed to add. It may already exist.');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, type: SettingType) => {
    if (!confirm('Are you sure you want to delete this?')) return;

    setSaving(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const settingsService = new SettingsService(supabase);
      await settingsService.deleteSetting(id);
      
      // Refresh settings
      const allSettings = await settingsService.getAllSettings();
      setSettings(allSettings);
    } catch (error) {
      console.error('Failed to delete setting:', error);
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading settings...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display text-[var(--color-text)]">Settings</h1>
        <p className="text-body text-[var(--color-text-muted)] mt-2">
          Customize your app options. Changes are saved automatically.
        </p>
      </div>

      {/* Settings Sections */}
      {(Object.keys(SETTING_LABELS) as SettingType[]).map((type) => (
        <Card key={type} variant="outlined" padding="lg">
          <div className="mb-4">
            <h2 className="text-title text-[var(--color-text)]">
              {SETTING_LABELS[type].title}
            </h2>
            <p className="text-small text-[var(--color-text-muted)]">
              {SETTING_LABELS[type].description}
            </p>
          </div>

          {/* Current Items */}
          <div className="flex flex-wrap gap-2 mb-4">
            {settings[type].map((setting) => (
              <span
                key={setting.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-sunken)] text-small text-[var(--color-text)]"
              >
                {setting.label}
                <button
                  onClick={() => handleDelete(setting.id, type)}
                  disabled={saving === setting.id}
                  className="w-4 h-4 rounded-full hover:bg-red-500/20 flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  {saving === setting.id ? '...' : '×'}
                </button>
              </span>
            ))}
            {settings[type].length === 0 && (
              <span className="text-small text-[var(--color-text-muted)]">
                No items yet. Add some below.
              </span>
            )}
          </div>

          {/* Add New */}
          <div className="flex gap-2">
            <Input
              placeholder={`Add new ${SETTING_LABELS[type].title.toLowerCase().slice(0, -1)}...`}
              value={newValues[type]}
              onChange={(e) => setNewValues(prev => ({ ...prev, [type]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd(type)}
              className="flex-1"
            />
            <Button
              onClick={() => handleAdd(type)}
              disabled={!newValues[type].trim() || saving === type}
              size="md"
            >
              {saving === type ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </Card>
      ))}

      {/* Info */}
      <Card variant="default" padding="md" className="bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20">
        <p className="text-small text-[var(--color-text-muted)]">
          <strong>Tip:</strong> You can also manage these settings directly in your{' '}
          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--color-primary)] hover:underline"
          >
            Supabase Dashboard
          </a>{' '}
          → Table Editor → app_settings
        </p>
      </Card>
    </div>
  );
}
