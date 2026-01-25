/**
 * Settings Service
 * 
 * Handles user-configurable app settings like payment methods, budget categories, etc.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from './errors';

export interface AppSetting {
  id: string;
  user_id: string;
  setting_type: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SettingType = 'payment_method' | 'budget_category' | 'income_source' | 'person';

// Default values as fallback
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

const DEFAULT_BUDGET_CATEGORIES = [
  'Tithe', 'Offering', 'Housing', 'Food', 'Transport', 'Personal Care',
  'Household', 'Savings', 'Investments', 'Subscriptions', 'Health',
  'Travel', 'Entertainment', 'Education', 'Charity', 'Miscellaneous',
];

const DEFAULT_INCOME_SOURCES = [
  { value: 'Salary', label: 'Salary' },
  { value: 'Bonus', label: 'Bonus' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Refund', label: 'Refund' },
  { value: 'Other', label: 'Other' },
];

const DEFAULT_PEOPLE = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

export class SettingsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get settings by type
   */
  async getByType(settingType: SettingType): Promise<{ value: string; label: string }[]> {
    try {
      await this.getUserId();

      const { data, error } = await this.supabase
        .from('app_settings')
        .select('value, label')
        .eq('setting_type', settingType)
        .eq('is_active', true)
        .order('sort_order');

      if (error || !data || data.length === 0) {
        // Return defaults if no settings found
        return this.getDefaults(settingType);
      }

      return data;
    } catch {
      return this.getDefaults(settingType);
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<{ value: string; label: string }[]> {
    return this.getByType('payment_method');
  }

  /**
   * Get budget categories
   */
  async getBudgetCategories(): Promise<string[]> {
    const settings = await this.getByType('budget_category');
    return settings.map(s => s.value);
  }

  /**
   * Get income sources
   */
  async getIncomeSources(): Promise<{ value: string; label: string }[]> {
    return this.getByType('income_source');
  }

  /**
   * Get people
   */
  async getPeople(): Promise<{ value: string; label: string }[]> {
    return this.getByType('person');
  }

  /**
   * Add a new setting
   */
  async addSetting(settingType: SettingType, value: string, label?: string): Promise<void> {
    const userId = await this.getUserId();

    // Get max sort_order for this type
    const { data: existing } = await this.supabase
      .from('app_settings')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('setting_type', settingType)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

    const { error } = await this.supabase
      .from('app_settings')
      .insert({
        user_id: userId,
        setting_type: settingType,
        value,
        label: label || value,
        sort_order: nextOrder,
      });

    if (error) {
      throw new Error(`Failed to add setting: ${error.message}`);
    }
  }

  /**
   * Update a setting
   */
  async updateSetting(id: string, updates: { value?: string; label?: string; is_active?: boolean }): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('app_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update setting: ${error.message}`);
    }
  }

  /**
   * Delete a setting
   */
  async deleteSetting(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('app_settings')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete setting: ${error.message}`);
    }
  }

  /**
   * Get all settings (for settings page)
   */
  async getAllSettings(): Promise<Record<SettingType, AppSetting[]>> {
    try {
      const userId = await this.getUserId();

      const { data, error } = await this.supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .order('setting_type')
        .order('sort_order');

      if (error || !data) {
        return {
          payment_method: [],
          budget_category: [],
          income_source: [],
          person: [],
        };
      }

      // Group by type, ensuring all keys exist
      const result: Record<SettingType, AppSetting[]> = {
        payment_method: [],
        budget_category: [],
        income_source: [],
        person: [],
      };

      data.forEach((setting) => {
        const type = setting.setting_type as SettingType;
        if (result[type]) {
          result[type].push(setting);
        }
      });

      return result;
    } catch {
      // Return empty settings on any error
      return {
        payment_method: [],
        budget_category: [],
        income_source: [],
        person: [],
      };
    }
  }

  /**
   * Get default values for a setting type
   */
  private getDefaults(settingType: SettingType): { value: string; label: string }[] {
    switch (settingType) {
      case 'payment_method':
        return DEFAULT_PAYMENT_METHODS;
      case 'budget_category':
        return DEFAULT_BUDGET_CATEGORIES.map(c => ({ value: c, label: c }));
      case 'income_source':
        return DEFAULT_INCOME_SOURCES;
      case 'person':
        return DEFAULT_PEOPLE;
      default:
        return [];
    }
  }
}
