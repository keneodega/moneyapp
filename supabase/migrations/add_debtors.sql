-- Migration: Add Debtors feature
-- Tracks people who owe money TO the user
-- Run this in Supabase SQL Editor

-- ============================================
-- ENUM TYPE
-- ============================================

CREATE TYPE debtor_status_type AS ENUM (
  'Active', 'Partially Paid', 'Paid Off', 'Written Off'
);

-- ============================================
-- DEBTORS TABLE
-- ============================================

CREATE TABLE debtors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  debtor_name TEXT NOT NULL,
  amount_owed DECIMAL(12, 2) NOT NULL,
  amount_repaid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  date_lent DATE NOT NULL,
  expected_repayment_date DATE,
  status debtor_status_type DEFAULT 'Active',
  person TEXT,
  bank TEXT,
  payment_method TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT debtors_amount_owed_positive CHECK (amount_owed > 0),
  CONSTRAINT debtors_amount_repaid_non_negative CHECK (amount_repaid >= 0),
  CONSTRAINT debtors_repaid_not_exceed_owed CHECK (amount_repaid <= amount_owed),
  CONSTRAINT debtors_valid_date_range CHECK (
    expected_repayment_date IS NULL OR expected_repayment_date >= date_lent
  )
);

-- ============================================
-- DEBTOR PAYMENTS TABLE
-- ============================================

CREATE TABLE debtor_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT debtor_payments_amount_positive CHECK (payment_amount > 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_debtors_user_id ON debtors(user_id);
CREATE INDEX idx_debtors_status ON debtors(user_id, status);
CREATE INDEX idx_debtors_expected_repayment ON debtors(user_id, expected_repayment_date)
  WHERE status IN ('Active', 'Partially Paid');

CREATE INDEX idx_debtor_payments_debtor_id ON debtor_payments(debtor_id);
CREATE INDEX idx_debtor_payments_user_id ON debtor_payments(user_id);
CREATE INDEX idx_debtor_payments_date ON debtor_payments(payment_date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_payments ENABLE ROW LEVEL SECURITY;

-- Debtors policies
CREATE POLICY "Users can view their own debtors" ON debtors
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own debtors" ON debtors
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own debtors" ON debtors
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own debtors" ON debtors
  FOR DELETE USING (user_id = (select auth.uid()));

-- Debtor Payments policies
CREATE POLICY "Users can view their own debtor payments" ON debtor_payments
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own debtor payments" ON debtor_payments
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own debtor payments" ON debtor_payments
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own debtor payments" ON debtor_payments
  FOR DELETE USING (user_id = (select auth.uid()));

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_debtors_updated_at_trigger BEFORE UPDATE ON debtors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debtor_payments_updated_at_trigger BEFORE UPDATE ON debtor_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BALANCE UPDATE TRIGGERS
-- ============================================

-- Trigger function for INSERT and UPDATE on debtor_payments
CREATE OR REPLACE FUNCTION update_debtor_balance_after_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.debtors
  SET
    amount_repaid = (
      SELECT COALESCE(SUM(payment_amount), 0)
      FROM public.debtor_payments
      WHERE debtor_id = NEW.debtor_id
    ),
    status = CASE
      WHEN (
        SELECT COALESCE(SUM(payment_amount), 0)
        FROM public.debtor_payments
        WHERE debtor_id = NEW.debtor_id
      ) >= amount_owed THEN 'Paid Off'::public.debtor_status_type
      WHEN (
        SELECT COALESCE(SUM(payment_amount), 0)
        FROM public.debtor_payments
        WHERE debtor_id = NEW.debtor_id
      ) > 0 THEN 'Partially Paid'::public.debtor_status_type
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.debtor_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_debtor_balance_on_payment_insert
  AFTER INSERT ON debtor_payments
  FOR EACH ROW EXECUTE FUNCTION update_debtor_balance_after_payment();

CREATE TRIGGER update_debtor_balance_on_payment_update
  AFTER UPDATE ON debtor_payments
  FOR EACH ROW
  WHEN (OLD.payment_amount IS DISTINCT FROM NEW.payment_amount)
  EXECUTE FUNCTION update_debtor_balance_after_payment();

-- Trigger function for DELETE on debtor_payments
CREATE OR REPLACE FUNCTION update_debtor_balance_after_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.debtors
  SET
    amount_repaid = (
      SELECT COALESCE(SUM(payment_amount), 0)
      FROM public.debtor_payments
      WHERE debtor_id = OLD.debtor_id
    ),
    status = CASE
      WHEN (
        SELECT COALESCE(SUM(payment_amount), 0)
        FROM public.debtor_payments
        WHERE debtor_id = OLD.debtor_id
      ) >= amount_owed THEN 'Paid Off'::public.debtor_status_type
      WHEN (
        SELECT COALESCE(SUM(payment_amount), 0)
        FROM public.debtor_payments
        WHERE debtor_id = OLD.debtor_id
      ) > 0 THEN 'Partially Paid'::public.debtor_status_type
      ELSE 'Active'::public.debtor_status_type
    END,
    updated_at = NOW()
  WHERE id = OLD.debtor_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER update_debtor_balance_on_payment_delete
  AFTER DELETE ON debtor_payments
  FOR EACH ROW EXECUTE FUNCTION update_debtor_balance_after_payment_delete();

COMMENT ON TABLE debtors IS 'Tracks people who owe money to the user';
COMMENT ON TABLE debtor_payments IS 'Tracks individual repayments from debtors';
