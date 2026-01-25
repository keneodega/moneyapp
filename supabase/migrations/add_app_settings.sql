-- App Settings Migration
-- Run this in the Supabase SQL Editor to add configurable settings
-- This allows you to manage payment methods, budget categories, etc. from the dashboard

-- ============================================
-- APP SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL, -- 'payment_method', 'budget_category', 'income_source', 'person'
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, setting_type, value)
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
  ON app_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON app_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON app_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON app_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_app_settings_user_type ON app_settings(user_id, setting_type);

-- ============================================
-- FUNCTION TO INITIALIZE DEFAULT SETTINGS
-- ============================================
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Default Payment Methods
  INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
    (NEW.id, 'payment_method', 'AIB', 'AIB', 1),
    (NEW.id, 'payment_method', 'Revolut', 'Revolut', 2),
    (NEW.id, 'payment_method', 'N26', 'N26', 3),
    (NEW.id, 'payment_method', 'Wise', 'Wise', 4),
    (NEW.id, 'payment_method', 'Bank of Ireland', 'Bank of Ireland', 5),
    (NEW.id, 'payment_method', 'Ulster Bank', 'Ulster Bank', 6),
    (NEW.id, 'payment_method', 'Cash', 'Cash', 7),
    (NEW.id, 'payment_method', 'Other', 'Other', 99);

  -- Default Budget Categories
  INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
    (NEW.id, 'budget_category', 'Tithe', 'Tithe', 1),
    (NEW.id, 'budget_category', 'Offering', 'Offering', 2),
    (NEW.id, 'budget_category', 'Housing', 'Housing', 3),
    (NEW.id, 'budget_category', 'Food', 'Food', 4),
    (NEW.id, 'budget_category', 'Transport', 'Transport', 5),
    (NEW.id, 'budget_category', 'Personal Care', 'Personal Care', 6),
    (NEW.id, 'budget_category', 'Household', 'Household', 7),
    (NEW.id, 'budget_category', 'Savings', 'Savings', 8),
    (NEW.id, 'budget_category', 'Investments', 'Investments', 9),
    (NEW.id, 'budget_category', 'Subscriptions', 'Subscriptions', 10),
    (NEW.id, 'budget_category', 'Health', 'Health', 11),
    (NEW.id, 'budget_category', 'Travel', 'Travel', 12),
    (NEW.id, 'budget_category', 'Entertainment', 'Entertainment', 13),
    (NEW.id, 'budget_category', 'Education', 'Education', 14),
    (NEW.id, 'budget_category', 'Charity', 'Charity', 15),
    (NEW.id, 'budget_category', 'Miscellaneous', 'Miscellaneous', 99);

  -- Default Income Sources
  INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
    (NEW.id, 'income_source', 'Salary', 'Salary', 1),
    (NEW.id, 'income_source', 'Bonus', 'Bonus', 2),
    (NEW.id, 'income_source', 'Freelance', 'Freelance', 3),
    (NEW.id, 'income_source', 'Investment', 'Investment', 4),
    (NEW.id, 'income_source', 'Gift', 'Gift', 5),
    (NEW.id, 'income_source', 'Refund', 'Refund', 6),
    (NEW.id, 'income_source', 'Other', 'Other', 99);

  -- Default People
  INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
    (NEW.id, 'person', 'Kene', 'Kene', 1),
    (NEW.id, 'person', 'Ify', 'Ify', 2),
    (NEW.id, 'person', 'Joint', 'Joint', 3),
    (NEW.id, 'person', 'Other', 'Other', 99);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create settings for new users
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_settings();

-- ============================================
-- INITIALIZE SETTINGS FOR EXISTING USERS
-- ============================================
-- Run this to add default settings for any existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Only insert if user doesn't have settings yet
    IF NOT EXISTS (SELECT 1 FROM app_settings WHERE user_id = user_record.id LIMIT 1) THEN
      -- Payment Methods
      INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
        (user_record.id, 'payment_method', 'AIB', 'AIB', 1),
        (user_record.id, 'payment_method', 'Revolut', 'Revolut', 2),
        (user_record.id, 'payment_method', 'N26', 'N26', 3),
        (user_record.id, 'payment_method', 'Wise', 'Wise', 4),
        (user_record.id, 'payment_method', 'Bank of Ireland', 'Bank of Ireland', 5),
        (user_record.id, 'payment_method', 'Ulster Bank', 'Ulster Bank', 6),
        (user_record.id, 'payment_method', 'Cash', 'Cash', 7),
        (user_record.id, 'payment_method', 'Other', 'Other', 99);

      -- Budget Categories
      INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
        (user_record.id, 'budget_category', 'Tithe', 'Tithe', 1),
        (user_record.id, 'budget_category', 'Offering', 'Offering', 2),
        (user_record.id, 'budget_category', 'Housing', 'Housing', 3),
        (user_record.id, 'budget_category', 'Food', 'Food', 4),
        (user_record.id, 'budget_category', 'Transport', 'Transport', 5),
        (user_record.id, 'budget_category', 'Personal Care', 'Personal Care', 6),
        (user_record.id, 'budget_category', 'Household', 'Household', 7),
        (user_record.id, 'budget_category', 'Savings', 'Savings', 8),
        (user_record.id, 'budget_category', 'Investments', 'Investments', 9),
        (user_record.id, 'budget_category', 'Subscriptions', 'Subscriptions', 10),
        (user_record.id, 'budget_category', 'Health', 'Health', 11),
        (user_record.id, 'budget_category', 'Travel', 'Travel', 12),
        (user_record.id, 'budget_category', 'Entertainment', 'Entertainment', 13),
        (user_record.id, 'budget_category', 'Education', 'Education', 14),
        (user_record.id, 'budget_category', 'Charity', 'Charity', 15),
        (user_record.id, 'budget_category', 'Miscellaneous', 'Miscellaneous', 99);

      -- Income Sources
      INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
        (user_record.id, 'income_source', 'Salary', 'Salary', 1),
        (user_record.id, 'income_source', 'Bonus', 'Bonus', 2),
        (user_record.id, 'income_source', 'Freelance', 'Freelance', 3),
        (user_record.id, 'income_source', 'Investment', 'Investment', 4),
        (user_record.id, 'income_source', 'Gift', 'Gift', 5),
        (user_record.id, 'income_source', 'Refund', 'Refund', 6),
        (user_record.id, 'income_source', 'Other', 'Other', 99);

      -- People
      INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
        (user_record.id, 'person', 'Kene', 'Kene', 1),
        (user_record.id, 'person', 'Ify', 'Ify', 2),
        (user_record.id, 'person', 'Joint', 'Joint', 3),
        (user_record.id, 'person', 'Other', 'Other', 99);
    END IF;
  END LOOP;
END $$;
