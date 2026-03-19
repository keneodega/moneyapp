-- Migration: Add loans table for tracking loans and debts
-- Similar structure to subscriptions but with loan-specific fields

-- ============================================
-- Step 1: Create loan status enum type
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status_type') THEN
    CREATE TYPE loan_status_type AS ENUM (
      'Active', 'Paid Off', 'Defaulted', 'Refinanced', 'Closed'
    );
  END IF;
END $$;

-- ============================================
-- Step 2: Create loan type enum
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_type') THEN
    CREATE TYPE loan_type AS ENUM (
      'Mortgage', 'Car Loan', 'Personal Loan', 'Student Loan', 'Credit Card', 'Other'
    );
  END IF;
END $$;

-- ============================================
-- Step 3: Create loans table
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  loan_type loan_type NOT NULL DEFAULT 'Other',
  original_amount DECIMAL(12, 2) NOT NULL,
  current_balance DECIMAL(12, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Annual percentage rate
  monthly_payment DECIMAL(12, 2) NOT NULL,
  payment_frequency frequency_type NOT NULL DEFAULT 'Monthly',
  status loan_status_type DEFAULT 'Active',
  person person_type,
  bank bank_type,
  lender_name TEXT, -- Name of the lending institution
  start_date DATE NOT NULL,
  end_date DATE, -- Maturity/end date
  next_payment_date DATE,
  last_payment_date DATE,
  payment_method bank_type, -- Which bank/account payments come from
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT loans_original_amount_positive CHECK (original_amount > 0),
  CONSTRAINT loans_current_balance_non_negative CHECK (current_balance >= 0),
  CONSTRAINT loans_interest_rate_non_negative CHECK (interest_rate >= 0),
  CONSTRAINT loans_monthly_payment_positive CHECK (monthly_payment > 0),
  CONSTRAINT loans_valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================
-- Step 4: Create loan payments table
-- ============================================
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_amount DECIMAL(12, 2) NOT NULL,
  principal_amount DECIMAL(12, 2) NOT NULL, -- Portion that goes to principal
  interest_amount DECIMAL(12, 2) NOT NULL, -- Portion that goes to interest
  payment_date DATE NOT NULL,
  payment_method bank_type,
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL, -- Optional link to expense
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT loan_payments_amount_positive CHECK (payment_amount > 0),
  CONSTRAINT loan_payments_amounts_match CHECK (payment_amount = principal_amount + interest_amount)
);

-- ============================================
-- Step 5: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_next_payment ON loans(user_id, next_payment_date) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(payment_date);

-- ============================================
-- Step 6: Create function to update loan balance after payment
-- ============================================
CREATE OR REPLACE FUNCTION update_loan_balance_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the loan's current balance when a payment is made
  UPDATE loans
  SET 
    current_balance = GREATEST(0, current_balance - NEW.principal_amount),
    last_payment_date = NEW.payment_date,
    next_payment_date = CASE 
      WHEN payment_frequency = 'Monthly' THEN NEW.payment_date + INTERVAL '1 month'
      WHEN payment_frequency = 'Bi-Weekly' THEN NEW.payment_date + INTERVAL '14 days'
      WHEN payment_frequency = 'Weekly' THEN NEW.payment_date + INTERVAL '7 days'
      WHEN payment_frequency = 'Quarterly' THEN NEW.payment_date + INTERVAL '3 months'
      ELSE NEW.payment_date + INTERVAL '1 month'
    END,
    status = CASE 
      WHEN current_balance - NEW.principal_amount <= 0 THEN 'Paid Off'::loan_status_type
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.loan_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Create trigger for auto-updating loan balance
-- ============================================
DROP TRIGGER IF EXISTS update_loan_balance_trigger ON loan_payments;
CREATE TRIGGER update_loan_balance_trigger
  AFTER INSERT ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_balance_after_payment();

-- ============================================
-- Step 8: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_loans_updated_at_trigger ON loans;
CREATE TRIGGER update_loans_updated_at_trigger
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_loans_updated_at();

DROP TRIGGER IF EXISTS update_loan_payments_updated_at_trigger ON loan_payments;
CREATE TRIGGER update_loan_payments_updated_at_trigger
  BEFORE UPDATE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_loans_updated_at();

-- ============================================
-- Step 9: Add RLS policies
-- ============================================
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own loans
CREATE POLICY "Users can view their own loans"
  ON loans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own loans
CREATE POLICY "Users can insert their own loans"
  ON loans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own loans
CREATE POLICY "Users can update their own loans"
  ON loans FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own loans
CREATE POLICY "Users can delete their own loans"
  ON loans FOR DELETE
  USING (auth.uid() = user_id);

-- Users can only see their own loan payments
CREATE POLICY "Users can view their own loan payments"
  ON loan_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own loan payments
CREATE POLICY "Users can insert their own loan payments"
  ON loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own loan payments
CREATE POLICY "Users can update their own loan payments"
  ON loan_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own loan payments
CREATE POLICY "Users can delete their own loan payments"
  ON loan_payments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 10: Add comments
-- ============================================
COMMENT ON TABLE loans IS 'Tracks all loans and debts including mortgages, car loans, personal loans, etc.';
COMMENT ON TABLE loan_payments IS 'Tracks individual payments made towards loans, with principal and interest breakdown';
COMMENT ON COLUMN loans.original_amount IS 'The original loan amount when it was taken out';
COMMENT ON COLUMN loans.current_balance IS 'The remaining balance on the loan';
COMMENT ON COLUMN loans.interest_rate IS 'Annual percentage rate (APR)';
COMMENT ON COLUMN loan_payments.principal_amount IS 'Portion of payment that reduces the loan balance';
COMMENT ON COLUMN loan_payments.interest_amount IS 'Portion of payment that goes to interest';
