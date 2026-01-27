-- Add Savings Buckets and Transactions Tables
-- This migration creates the savings system that can link to financial goals

-- ============================================
-- SAVINGS BUCKETS
-- ============================================
CREATE TABLE IF NOT EXISTS savings_buckets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2),
  current_amount DECIMAL(12, 2) DEFAULT 0,
  linked_goal_id UUID REFERENCES financial_goals(id) ON DELETE SET NULL,
  monthly_contribution DECIMAL(12, 2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT positive_target CHECK (target_amount IS NULL OR target_amount >= 0),
  CONSTRAINT positive_current CHECK (current_amount >= 0),
  CONSTRAINT positive_contribution CHECK (monthly_contribution IS NULL OR monthly_contribution >= 0)
);

-- ============================================
-- SAVINGS TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS savings_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  savings_bucket_id UUID REFERENCES savings_buckets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out')) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_savings_buckets_user_id ON savings_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_buckets_goal_id ON savings_buckets(linked_goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_bucket_id ON savings_transactions(savings_bucket_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_date ON savings_transactions(date);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE savings_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)

-- Users can only see their own savings buckets
DROP POLICY IF EXISTS "Users can view own savings buckets" ON savings_buckets;
CREATE POLICY "Users can view own savings buckets"
  ON savings_buckets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own savings buckets
DROP POLICY IF EXISTS "Users can insert own savings buckets" ON savings_buckets;
CREATE POLICY "Users can insert own savings buckets"
  ON savings_buckets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own savings buckets
DROP POLICY IF EXISTS "Users can update own savings buckets" ON savings_buckets;
CREATE POLICY "Users can update own savings buckets"
  ON savings_buckets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own savings buckets
DROP POLICY IF EXISTS "Users can delete own savings buckets" ON savings_buckets;
CREATE POLICY "Users can delete own savings buckets"
  ON savings_buckets FOR DELETE
  USING (auth.uid() = user_id);

-- Users can view transactions for their own buckets
DROP POLICY IF EXISTS "Users can view own savings transactions" ON savings_transactions;
CREATE POLICY "Users can view own savings transactions"
  ON savings_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM savings_buckets
      WHERE savings_buckets.id = savings_transactions.savings_bucket_id
      AND savings_buckets.user_id = auth.uid()
    )
  );

-- Users can insert transactions for their own buckets
DROP POLICY IF EXISTS "Users can insert own savings transactions" ON savings_transactions;
CREATE POLICY "Users can insert own savings transactions"
  ON savings_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_buckets
      WHERE savings_buckets.id = savings_transactions.savings_bucket_id
      AND savings_buckets.user_id = auth.uid()
    )
  );

-- Users can update transactions for their own buckets
DROP POLICY IF EXISTS "Users can update own savings transactions" ON savings_transactions;
CREATE POLICY "Users can update own savings transactions"
  ON savings_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_buckets
      WHERE savings_buckets.id = savings_transactions.savings_bucket_id
      AND savings_buckets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_buckets
      WHERE savings_buckets.id = savings_transactions.savings_bucket_id
      AND savings_buckets.user_id = auth.uid()
    )
  );

-- Users can delete transactions for their own buckets
DROP POLICY IF EXISTS "Users can delete own savings transactions" ON savings_transactions;
CREATE POLICY "Users can delete own savings transactions"
  ON savings_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_buckets
      WHERE savings_buckets.id = savings_transactions.savings_bucket_id
      AND savings_buckets.user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_savings_buckets_updated_at
  BEFORE UPDATE ON savings_buckets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update bucket current_amount when transaction is added/updated/deleted
CREATE OR REPLACE FUNCTION update_savings_bucket_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE savings_buckets
    SET current_amount = current_amount + 
      CASE 
        WHEN NEW.transaction_type IN ('deposit', 'transfer_in') THEN NEW.amount
        WHEN NEW.transaction_type IN ('withdrawal', 'transfer_out') THEN -NEW.amount
        ELSE 0
      END
    WHERE id = NEW.savings_bucket_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Remove old transaction impact
    UPDATE savings_buckets
    SET current_amount = current_amount - 
      CASE 
        WHEN OLD.transaction_type IN ('deposit', 'transfer_in') THEN OLD.amount
        WHEN OLD.transaction_type IN ('withdrawal', 'transfer_out') THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.savings_bucket_id;
    -- Add new transaction impact
    UPDATE savings_buckets
    SET current_amount = current_amount + 
      CASE 
        WHEN NEW.transaction_type IN ('deposit', 'transfer_in') THEN NEW.amount
        WHEN NEW.transaction_type IN ('withdrawal', 'transfer_out') THEN -NEW.amount
        ELSE 0
      END
    WHERE id = NEW.savings_bucket_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE savings_buckets
    SET current_amount = current_amount - 
      CASE 
        WHEN OLD.transaction_type IN ('deposit', 'transfer_in') THEN OLD.amount
        WHEN OLD.transaction_type IN ('withdrawal', 'transfer_out') THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.savings_bucket_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bucket_on_transaction
  AFTER INSERT OR UPDATE OR DELETE ON savings_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_bucket_amount();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE savings_buckets IS 'Savings buckets/pots that can optionally link to financial goals';
COMMENT ON TABLE savings_transactions IS 'Transactions (deposits/withdrawals) for savings buckets';
COMMENT ON COLUMN savings_buckets.linked_goal_id IS 'Optional link to a financial goal this bucket is saving toward';
COMMENT ON COLUMN savings_buckets.monthly_contribution IS 'Target monthly contribution amount';
