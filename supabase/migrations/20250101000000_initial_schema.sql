-- MoneyApp: Consolidated Initial Schema
-- This single migration creates the complete database schema.
-- Generated from schema.sql + all incremental migrations.

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE frequency_type AS ENUM (
  'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually', 'One-Time'
);

CREATE TYPE status_type AS ENUM (
  'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'
);

CREATE TYPE subscription_status_type AS ENUM (
  'Active', 'Paused', 'Cancelled', 'Ended'
);

CREATE TYPE priority_type AS ENUM (
  'Low', 'Medium', 'High', 'Critical'
);

CREATE TYPE goal_type AS ENUM (
  'Short Term', 'Medium Term', 'Long Term'
);

CREATE TYPE expense_sub_category_type AS ENUM (
  'Rent', 'Electricity', 'Gas', 'Water', 'Internet', 'Phone', 'Groceries', 'Dining Out',
  'Transport', 'Fuel', 'Parking', 'Toll', 'Insurance', 'Medical', 'Pharmacy',
  'Clothing', 'Personal Care', 'Entertainment', 'Subscriptions', 'Gifts',
  'Tithe', 'Offering', 'Charity', 'Education', 'Childcare', 'Pet', 'Home Maintenance',
  'Furniture', 'Electronics', 'Travel', 'Vacation', 'Investment', 'Savings', 'Other'
);

CREATE TYPE investment_type AS ENUM (
  'Stocks', 'ETF', 'Bonds', 'Crypto', 'Real Estate', 'Mutual Fund', 'Pension', 'Savings Account', 'Other'
);

CREATE TYPE transaction_type AS ENUM (
  'Buy', 'Sell', 'Deposit', 'Withdrawal', 'Dividend', 'Interest'
);

CREATE TYPE platform_type AS ENUM (
  'Degiro', 'Trading 212', 'Revolut', 'eToro', 'Interactive Brokers', 'Binance', 'Coinbase', 'Other'
);

CREATE TYPE transfer_type AS ENUM (
  'budget_to_budget', 'goal_to_budget', 'goal_drawdown'
);

CREATE TYPE loan_status_type AS ENUM (
  'Active', 'Paid Off', 'Defaulted', 'Refinanced', 'Closed'
);

CREATE TYPE loan_type AS ENUM (
  'Mortgage', 'Car Loan', 'Personal Loan', 'Student Loan', 'Credit Card', 'Other'
);

CREATE TYPE budget_type AS ENUM (
  'Fixed', 'Variable'
);

-- ============================================
-- TABLES
-- ============================================

-- 1. MONTHLY OVERVIEWS
CREATE TABLE monthly_overviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 2. MASTER BUDGETS (templates)
CREATE TABLE master_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  budget_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  budget_type budget_type NOT NULL DEFAULT 'Fixed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT master_budgets_user_name_unique UNIQUE (user_id, name)
);

-- 3. BUDGETS (per month, linked to master)
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  budget_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  master_budget_id UUID REFERENCES master_budgets(id) ON DELETE SET NULL,
  override_amount DECIMAL(12, 2),
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT budgets_budget_amount_non_negative CHECK (budget_amount >= 0),
  CONSTRAINT budgets_override_reason_required CHECK (
    (override_amount IS NULL AND override_reason IS NULL) OR
    (override_amount IS NOT NULL AND override_reason IS NOT NULL AND LENGTH(TRIM(override_reason)) > 0)
  )
);

-- 4. EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  sub_category expense_sub_category_type,
  bank TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency frequency_type,
  financial_goal_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT expenses_amount_positive CHECK (amount > 0)
);

-- 5. INCOME SOURCES
CREATE TABLE income_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  source TEXT NOT NULL,
  person TEXT,
  bank TEXT,
  date_paid DATE NOT NULL,
  tithe_deduction BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT income_sources_amount_positive CHECK (amount > 0)
);

-- 6. FINANCIAL GOALS
CREATE TABLE financial_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  base_amount DECIMAL(12, 2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status status_type DEFAULT 'Not Started',
  person TEXT,
  priority priority_type DEFAULT 'Medium',
  goal_type goal_type,
  estimated_contributions DECIMAL(12, 2),
  estimated_frequency frequency_type,
  description TEXT,
  product_link TEXT,
  has_sub_goals BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_goal_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- FK from expenses to financial_goals
ALTER TABLE expenses ADD CONSTRAINT fk_expense_goal
  FOREIGN KEY (financial_goal_id) REFERENCES financial_goals(id) ON DELETE SET NULL;

-- 7. FINANCIAL SUB-GOALS
CREATE TABLE financial_sub_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  estimated_cost DECIMAL(12, 2),
  actual_cost DECIMAL(12, 2),
  status status_type DEFAULT 'Not Started',
  priority priority_type DEFAULT 'Medium',
  responsible_person TEXT,
  start_date DATE,
  end_date DATE,
  progress DECIMAL(5, 2) DEFAULT 0,
  description TEXT,
  product_link TEXT,
  contribution_frequency frequency_type,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency frequency_type NOT NULL,
  status subscription_status_type DEFAULT 'Active',
  person TEXT,
  bank TEXT,
  subscription_type TEXT,
  is_essential BOOLEAN DEFAULT TRUE NOT NULL,
  start_date DATE,
  end_date DATE,
  collection_day INTEGER CHECK (collection_day >= 1 AND collection_day <= 31),
  last_collection_date DATE,
  next_collection_date DATE,
  paid_this_period BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. INVESTMENT HOLDINGS
CREATE TABLE investment_holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  investment_type investment_type NOT NULL,
  current_value DECIMAL(12, 2) DEFAULT 0,
  last_valued_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INVESTMENT TRANSACTIONS
CREATE TABLE investment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investment_holding_id UUID REFERENCES investment_holdings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type transaction_type NOT NULL,
  transaction_date DATE NOT NULL,
  platform platform_type,
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. APP SETTINGS
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_type, value)
);

-- 12. GOAL CONTRIBUTIONS
CREATE TABLE goal_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  bank TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT goal_contributions_amount_positive CHECK (amount > 0)
);

-- 13. GOAL DRAWDOWNS (legacy, kept for reference)
CREATE TABLE goal_drawdowns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  bank TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT goal_drawdowns_amount_positive CHECK (amount > 0)
);

-- 14. TRANSFERS
CREATE TABLE transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  transfer_type transfer_type NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  bank TEXT,
  from_budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  to_budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  from_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT transfers_amount_positive CHECK (amount > 0),
  CONSTRAINT transfers_budget_to_budget CHECK (
    (transfer_type = 'budget_to_budget') = (from_budget_id IS NOT NULL AND to_budget_id IS NOT NULL AND from_goal_id IS NULL)
  ),
  CONSTRAINT transfers_goal_to_budget CHECK (
    (transfer_type = 'goal_to_budget') = (from_goal_id IS NOT NULL AND to_budget_id IS NOT NULL AND from_budget_id IS NULL)
  ),
  CONSTRAINT transfers_goal_drawdown CHECK (
    (transfer_type = 'goal_drawdown') = (from_goal_id IS NOT NULL AND from_budget_id IS NULL AND to_budget_id IS NULL)
  )
);

-- 15. LOANS
CREATE TABLE loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  loan_type loan_type NOT NULL DEFAULT 'Other',
  original_amount DECIMAL(12, 2) NOT NULL,
  current_balance DECIMAL(12, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  monthly_payment DECIMAL(12, 2) NOT NULL,
  payment_frequency frequency_type NOT NULL DEFAULT 'Monthly',
  status loan_status_type DEFAULT 'Active',
  person TEXT,
  bank TEXT,
  lender_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  next_payment_date DATE,
  last_payment_date DATE,
  payment_method TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT loans_original_amount_positive CHECK (original_amount > 0),
  CONSTRAINT loans_current_balance_non_negative CHECK (current_balance >= 0),
  CONSTRAINT loans_interest_rate_non_negative CHECK (interest_rate >= 0),
  CONSTRAINT loans_monthly_payment_positive CHECK (monthly_payment > 0),
  CONSTRAINT loans_valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 16. LOAN PAYMENTS
CREATE TABLE loan_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_amount DECIMAL(12, 2) NOT NULL,
  principal_amount DECIMAL(12, 2) NOT NULL,
  interest_amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT loan_payments_amount_positive CHECK (payment_amount > 0),
  CONSTRAINT loan_payments_amounts_match CHECK (payment_amount = principal_amount + interest_amount)
);

-- 17. BUDGET HISTORY (audit log)
CREATE TABLE budget_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID,
  master_budget_id UUID REFERENCES master_budgets(id) ON DELETE SET NULL,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 18. MASTER BUDGET HISTORY (audit log)
CREATE TABLE master_budget_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  master_budget_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Monthly overviews
CREATE INDEX idx_monthly_overviews_user ON monthly_overviews(user_id);
CREATE INDEX idx_monthly_overviews_dates ON monthly_overviews(start_date, end_date);

-- Budgets
CREATE INDEX idx_budgets_monthly_overview ON budgets(monthly_overview_id);
CREATE INDEX idx_budgets_master_budget ON budgets(master_budget_id);

-- Expenses
CREATE INDEX idx_expenses_budget ON expenses(budget_id);
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_goal ON expenses(financial_goal_id);

-- Income sources
CREATE INDEX idx_income_sources_monthly ON income_sources(monthly_overview_id);
CREATE INDEX idx_income_sources_user ON income_sources(user_id);
CREATE INDEX idx_income_sources_date ON income_sources(date_paid DESC);

-- Financial goals
CREATE INDEX idx_financial_goals_user ON financial_goals(user_id);
CREATE INDEX idx_financial_goals_status ON financial_goals(status);

-- Sub goals
CREATE INDEX idx_sub_goals_goal ON financial_sub_goals(financial_goal_id);

-- Subscriptions
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_is_essential ON subscriptions(user_id, is_essential) WHERE status = 'Active';

-- Investments
CREATE INDEX idx_investment_holdings_user ON investment_holdings(user_id);
CREATE INDEX idx_investment_transactions_holding ON investment_transactions(investment_holding_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(transaction_date DESC);

-- App settings
CREATE INDEX idx_app_settings_user_type ON app_settings(user_id, setting_type);

-- Master budgets
CREATE INDEX idx_master_budgets_user ON master_budgets(user_id);
CREATE INDEX idx_master_budgets_user_active ON master_budgets(user_id, is_active);
CREATE INDEX idx_master_budgets_user_type ON master_budgets(user_id, budget_type);

-- Goal contributions
CREATE INDEX idx_goal_contributions_goal_id ON goal_contributions(financial_goal_id);
CREATE INDEX idx_goal_contributions_user_id ON goal_contributions(user_id);
CREATE INDEX idx_goal_contributions_monthly_overview ON goal_contributions(monthly_overview_id);
CREATE INDEX idx_goal_contributions_date ON goal_contributions(date);

-- Goal drawdowns
CREATE INDEX idx_goal_drawdowns_goal_id ON goal_drawdowns(financial_goal_id);
CREATE INDEX idx_goal_drawdowns_user_id ON goal_drawdowns(user_id);
CREATE INDEX idx_goal_drawdowns_monthly_overview ON goal_drawdowns(monthly_overview_id);
CREATE INDEX idx_goal_drawdowns_date ON goal_drawdowns(date);

-- Transfers
CREATE INDEX idx_transfers_user_id ON transfers(user_id);
CREATE INDEX idx_transfers_monthly_overview_id ON transfers(monthly_overview_id);
CREATE INDEX idx_transfers_date ON transfers(date);
CREATE INDEX idx_transfers_from_budget_id ON transfers(from_budget_id) WHERE from_budget_id IS NOT NULL;
CREATE INDEX idx_transfers_to_budget_id ON transfers(to_budget_id) WHERE to_budget_id IS NOT NULL;
CREATE INDEX idx_transfers_from_goal_id ON transfers(from_goal_id) WHERE from_goal_id IS NOT NULL;

-- Loans
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(user_id, status);
CREATE INDEX idx_loans_next_payment ON loans(user_id, next_payment_date) WHERE status = 'Active';
CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX idx_loan_payments_date ON loan_payments(payment_date);

-- Budget history
CREATE INDEX idx_budget_history_user_changed ON budget_history(user_id, changed_at DESC);
CREATE INDEX idx_budget_history_budget_id ON budget_history(budget_id) WHERE budget_id IS NOT NULL;
CREATE INDEX idx_budget_history_master_budget_id ON budget_history(master_budget_id) WHERE master_budget_id IS NOT NULL;
CREATE INDEX idx_budget_history_monthly_overview_id ON budget_history(monthly_overview_id) WHERE monthly_overview_id IS NOT NULL;

-- Master budget history
CREATE INDEX idx_master_budget_history_user_changed ON master_budget_history(user_id, changed_at DESC);
CREATE INDEX idx_master_budget_history_master_budget_id ON master_budget_history(master_budget_id) WHERE master_budget_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE monthly_overviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sub_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_drawdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_budget_history ENABLE ROW LEVEL SECURITY;

-- Monthly Overviews
CREATE POLICY "Users can view own monthly overviews" ON monthly_overviews
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own monthly overviews" ON monthly_overviews
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own monthly overviews" ON monthly_overviews
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own monthly overviews" ON monthly_overviews
  FOR DELETE USING (user_id = (select auth.uid()));

-- Budgets (via monthly_overview ownership)
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can insert own budgets" ON budgets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = (select auth.uid()))
  );

-- Expenses
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (user_id = (select auth.uid()));

-- Income Sources
CREATE POLICY "Users can view own income sources" ON income_sources
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own income sources" ON income_sources
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own income sources" ON income_sources
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own income sources" ON income_sources
  FOR DELETE USING (user_id = (select auth.uid()));

-- Financial Goals
CREATE POLICY "Users can view own financial goals" ON financial_goals
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own financial goals" ON financial_goals
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own financial goals" ON financial_goals
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own financial goals" ON financial_goals
  FOR DELETE USING (user_id = (select auth.uid()));

-- Financial Sub-Goals (via goal ownership)
CREATE POLICY "Users can view own sub goals" ON financial_sub_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can insert own sub goals" ON financial_sub_goals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can update own sub goals" ON financial_sub_goals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = (select auth.uid()))
  );
CREATE POLICY "Users can delete own sub goals" ON financial_sub_goals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = (select auth.uid()))
  );

-- Subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own subscriptions" ON subscriptions
  FOR DELETE USING (user_id = (select auth.uid()));

-- Investment Holdings
CREATE POLICY "Users can view own holdings" ON investment_holdings
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own holdings" ON investment_holdings
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own holdings" ON investment_holdings
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own holdings" ON investment_holdings
  FOR DELETE USING (user_id = (select auth.uid()));

-- Investment Transactions
CREATE POLICY "Users can view own transactions" ON investment_transactions
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own transactions" ON investment_transactions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own transactions" ON investment_transactions
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own transactions" ON investment_transactions
  FOR DELETE USING (user_id = (select auth.uid()));

-- App Settings
CREATE POLICY "Users can view their own settings" ON app_settings
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can create their own settings" ON app_settings
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own settings" ON app_settings
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own settings" ON app_settings
  FOR DELETE USING (user_id = (select auth.uid()));

-- Master Budgets
CREATE POLICY "Users can view their own master budgets" ON master_budgets
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own master budgets" ON master_budgets
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own master budgets" ON master_budgets
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own master budgets" ON master_budgets
  FOR DELETE USING (user_id = (select auth.uid()));

-- Goal Contributions
CREATE POLICY "Users can view their own goal contributions" ON goal_contributions
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own goal contributions" ON goal_contributions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own goal contributions" ON goal_contributions
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own goal contributions" ON goal_contributions
  FOR DELETE USING (user_id = (select auth.uid()));

-- Goal Drawdowns
CREATE POLICY "Users can view their own goal drawdowns" ON goal_drawdowns
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own goal drawdowns" ON goal_drawdowns
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own goal drawdowns" ON goal_drawdowns
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own goal drawdowns" ON goal_drawdowns
  FOR DELETE USING (user_id = (select auth.uid()));

-- Transfers
CREATE POLICY "Users can view their own transfers" ON transfers
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own transfers" ON transfers
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own transfers" ON transfers
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own transfers" ON transfers
  FOR DELETE USING (user_id = (select auth.uid()));

-- Loans
CREATE POLICY "Users can view their own loans" ON loans
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own loans" ON loans
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own loans" ON loans
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own loans" ON loans
  FOR DELETE USING (user_id = (select auth.uid()));

-- Loan Payments
CREATE POLICY "Users can view their own loan payments" ON loan_payments
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert their own loan payments" ON loan_payments
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own loan payments" ON loan_payments
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own loan payments" ON loan_payments
  FOR DELETE USING (user_id = (select auth.uid()));

-- Budget History (append-only)
CREATE POLICY "Users can view their own budget history" ON budget_history
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Triggers can insert budget history" ON budget_history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR current_user IN ('postgres', 'supabase_admin'));

-- Master Budget History (append-only)
CREATE POLICY "Users can view their own master budget history" ON master_budget_history
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Triggers can insert master budget history" ON master_budget_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Validate expense date within monthly overview range
CREATE OR REPLACE FUNCTION validate_expense_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_month_name TEXT;
BEGIN
  SELECT mo.start_date, mo.end_date, mo.name
  INTO v_start_date, v_end_date, v_month_name
  FROM public.budgets b
  JOIN public.monthly_overviews mo ON mo.id = b.monthly_overview_id
  WHERE b.id = NEW.budget_id;

  IF NEW.date < v_start_date OR NEW.date > v_end_date THEN
    RAISE EXCEPTION 'The Expense Date (%) must be between the Start Date (%) and End Date (%) of the associated Monthly Overview (%).',
      NEW.date, v_start_date, v_end_date, v_month_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Validate no overspending
CREATE OR REPLACE FUNCTION validate_no_overspending()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_budget_amount DECIMAL(12, 2);
  v_current_spent DECIMAL(12, 2);
  v_budget_name TEXT;
  v_amount_left DECIMAL(12, 2);
BEGIN
  SELECT budget_amount, name INTO v_budget_amount, v_budget_name
  FROM public.budgets WHERE id = NEW.budget_id;

  IF TG_OP = 'UPDATE' AND OLD.budget_id = NEW.budget_id THEN
    -- exclude old amount
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_current_spent
  FROM public.expenses
  WHERE budget_id = NEW.budget_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  v_amount_left := v_budget_amount - v_current_spent - NEW.amount;

  IF v_amount_left < 0 THEN
    RAISE EXCEPTION 'Cannot add expense of %.2f to "%" budget. Budget would be negative by %.2f. Available: %.2f',
      NEW.amount, v_budget_name, ABS(v_amount_left), (v_budget_amount - v_current_spent)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Goal amount from contributions (consistent formula)
CREATE OR REPLACE FUNCTION update_goal_amount_from_contributions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Goal amount from drawdowns (consistent formula)
CREATE OR REPLACE FUNCTION update_goal_amount_from_drawdowns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.financial_goal_id, OLD.financial_goal_id);

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Goal amount from transfers (consistent formula)
CREATE OR REPLACE FUNCTION update_goal_amount_from_transfers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_goal_id UUID;
  v_base_amount DECIMAL(12, 2);
  v_total_contributions DECIMAL(12, 2);
  v_total_transfers_out DECIMAL(12, 2);
  v_new_current_amount DECIMAL(12, 2);
BEGIN
  v_goal_id := COALESCE(NEW.from_goal_id, OLD.from_goal_id);
  IF v_goal_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(base_amount, 0) INTO v_base_amount
  FROM public.financial_goals WHERE id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
  FROM public.goal_contributions WHERE financial_goal_id = v_goal_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_transfers_out
  FROM public.transfers WHERE from_goal_id = v_goal_id;

  v_new_current_amount := v_base_amount + v_total_contributions - v_total_transfers_out;

  UPDATE public.financial_goals
  SET current_amount = v_new_current_amount, updated_at = NOW()
  WHERE id = v_goal_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Loan balance after payment
CREATE OR REPLACE FUNCTION update_loan_balance_after_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.loans
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
      WHEN current_balance - NEW.principal_amount <= 0 THEN 'Paid Off'::public.loan_status_type
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.loan_id;
  RETURN NEW;
END;
$$;

-- Effective budget amount (uses override or master)
CREATE OR REPLACE FUNCTION get_effective_budget_amount(budget_row budgets)
RETURNS DECIMAL(12, 2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF budget_row.override_amount IS NOT NULL THEN
    RETURN budget_row.override_amount;
  ELSIF budget_row.master_budget_id IS NOT NULL THEN
    RETURN (SELECT budget_amount FROM public.master_budgets WHERE id = budget_row.master_budget_id);
  ELSE
    RETURN budget_row.budget_amount;
  END IF;
END;
$$;

-- Budget deviation from master
CREATE OR REPLACE FUNCTION get_budget_deviation(budget_row budgets)
RETURNS DECIMAL(12, 2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  master_amount DECIMAL(12, 2);
  effective_amount DECIMAL(12, 2);
BEGIN
  IF budget_row.master_budget_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT budget_amount INTO master_amount
  FROM public.master_budgets WHERE id = budget_row.master_budget_id;
  IF budget_row.override_amount IS NOT NULL THEN
    effective_amount := budget_row.override_amount;
  ELSE
    effective_amount := master_amount;
  END IF;
  RETURN effective_amount - master_amount;
END;
$$;

-- Budget history recorder
CREATE OR REPLACE FUNCTION record_budget_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_mo_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO v_user_id FROM monthly_overviews WHERE id = NEW.monthly_overview_id;
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.master_budget_id, NEW.monthly_overview_id, v_user_id, 'created', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT user_id INTO v_user_id FROM monthly_overviews WHERE id = NEW.monthly_overview_id;
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.master_budget_id, NEW.monthly_overview_id, v_user_id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_user_id FROM monthly_overviews WHERE id = OLD.monthly_overview_id;
    IF v_user_id IS NULL THEN
      v_user_id := auth.uid();
      v_mo_id := NULL;
    ELSE
      v_mo_id := OLD.monthly_overview_id;
    END IF;
    INSERT INTO budget_history (budget_id, master_budget_id, monthly_overview_id, user_id, action, old_data, new_data)
    VALUES (OLD.id, OLD.master_budget_id, v_mo_id, v_user_id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Master budget history recorder
CREATE OR REPLACE FUNCTION record_master_budget_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.user_id, 'created', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.user_id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO master_budget_history (master_budget_id, user_id, action, old_data, new_data)
    VALUES (OLD.id, OLD.user_id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Initialize default settings for new users
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app_settings (user_id, setting_type, value, label, sort_order) VALUES
    (NEW.id, 'payment_method', 'AIB', 'AIB', 1),
    (NEW.id, 'payment_method', 'Revolut', 'Revolut', 2),
    (NEW.id, 'payment_method', 'N26', 'N26', 3),
    (NEW.id, 'payment_method', 'Wise', 'Wise', 4),
    (NEW.id, 'payment_method', 'Bank of Ireland', 'Bank of Ireland', 5),
    (NEW.id, 'payment_method', 'Ulster Bank', 'Ulster Bank', 6),
    (NEW.id, 'payment_method', 'Cash', 'Cash', 7),
    (NEW.id, 'payment_method', 'Other', 'Other', 99),
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
    (NEW.id, 'budget_category', 'Miscellaneous', 'Miscellaneous', 99),
    (NEW.id, 'income_source', 'Salary', 'Salary', 1),
    (NEW.id, 'income_source', 'Bonus', 'Bonus', 2),
    (NEW.id, 'income_source', 'Freelance', 'Freelance', 3),
    (NEW.id, 'income_source', 'Investment', 'Investment', 4),
    (NEW.id, 'income_source', 'Gift', 'Gift', 5),
    (NEW.id, 'income_source', 'Refund', 'Refund', 6),
    (NEW.id, 'income_source', 'Other', 'Other', 99),
    (NEW.id, 'person', 'Kene', 'Kene', 1),
    (NEW.id, 'person', 'Ify', 'Ify', 2),
    (NEW.id, 'person', 'Joint', 'Joint', 3),
    (NEW.id, 'person', 'Other', 'Other', 99);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- updated_at triggers
CREATE TRIGGER update_monthly_overviews_updated_at BEFORE UPDATE ON monthly_overviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_income_sources_updated_at BEFORE UPDATE ON income_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_financial_goals_updated_at BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sub_goals_updated_at BEFORE UPDATE ON financial_sub_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON investment_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inv_transactions_updated_at BEFORE UPDATE ON investment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_master_budgets_updated_at BEFORE UPDATE ON master_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goal_contributions_updated_at_trigger BEFORE UPDATE ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goal_drawdowns_updated_at_trigger BEFORE UPDATE ON goal_drawdowns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at_trigger BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at_trigger BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_payments_updated_at_trigger BEFORE UPDATE ON loan_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Expense validation triggers
CREATE TRIGGER validate_expense_date_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION validate_expense_date();

CREATE TRIGGER validate_no_overspending_trigger
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION validate_no_overspending();

-- Goal contribution triggers
CREATE TRIGGER update_goal_on_contribution_insert
  AFTER INSERT ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION update_goal_amount_from_contributions();
CREATE TRIGGER update_goal_on_contribution_update
  AFTER UPDATE ON goal_contributions
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.financial_goal_id IS DISTINCT FROM NEW.financial_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_contributions();
CREATE TRIGGER update_goal_on_contribution_delete
  AFTER DELETE ON goal_contributions
  FOR EACH ROW EXECUTE FUNCTION update_goal_amount_from_contributions();

-- Goal drawdown triggers
CREATE TRIGGER update_goal_on_drawdown_insert
  AFTER INSERT ON goal_drawdowns
  FOR EACH ROW EXECUTE FUNCTION update_goal_amount_from_drawdowns();
CREATE TRIGGER update_goal_on_drawdown_update
  AFTER UPDATE ON goal_drawdowns
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.financial_goal_id IS DISTINCT FROM NEW.financial_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_drawdowns();
CREATE TRIGGER update_goal_on_drawdown_delete
  AFTER DELETE ON goal_drawdowns
  FOR EACH ROW EXECUTE FUNCTION update_goal_amount_from_drawdowns();

-- Transfer triggers (goal balance)
CREATE TRIGGER update_goal_on_transfer_insert
  AFTER INSERT ON transfers
  FOR EACH ROW
  WHEN (NEW.from_goal_id IS NOT NULL)
  EXECUTE FUNCTION update_goal_amount_from_transfers();
CREATE TRIGGER update_goal_on_transfer_update
  AFTER UPDATE ON transfers
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.from_goal_id IS DISTINCT FROM NEW.from_goal_id)
  EXECUTE FUNCTION update_goal_amount_from_transfers();
CREATE TRIGGER update_goal_on_transfer_delete
  AFTER DELETE ON transfers
  FOR EACH ROW
  WHEN (OLD.from_goal_id IS NOT NULL)
  EXECUTE FUNCTION update_goal_amount_from_transfers();

-- Loan payment trigger
CREATE TRIGGER update_loan_balance_trigger
  AFTER INSERT ON loan_payments
  FOR EACH ROW EXECUTE FUNCTION update_loan_balance_after_payment();

-- Budget history triggers
CREATE TRIGGER budget_history_insert
  AFTER INSERT ON budgets FOR EACH ROW EXECUTE FUNCTION record_budget_history();
CREATE TRIGGER budget_history_update
  AFTER UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION record_budget_history();
CREATE TRIGGER budget_history_delete
  AFTER DELETE ON budgets FOR EACH ROW EXECUTE FUNCTION record_budget_history();

-- Master budget history triggers
CREATE TRIGGER master_budget_history_insert
  AFTER INSERT ON master_budgets FOR EACH ROW EXECUTE FUNCTION record_master_budget_history();
CREATE TRIGGER master_budget_history_update
  AFTER UPDATE ON master_budgets FOR EACH ROW EXECUTE FUNCTION record_master_budget_history();
CREATE TRIGGER master_budget_history_delete
  AFTER DELETE ON master_budgets FOR EACH ROW EXECUTE FUNCTION record_master_budget_history();

-- Initialize settings for new users
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_settings();

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.monthly_overview_summary
WITH (security_invoker = true)
AS
SELECT
  mo.id,
  mo.user_id,
  mo.name,
  mo.start_date,
  mo.end_date,
  mo.notes,
  (mo.start_date <= CURRENT_DATE AND mo.end_date >= CURRENT_DATE) AS is_active,
  COALESCE(income_totals.total_income, 0) AS total_income,
  COALESCE(budget_totals.total_budgeted, 0) AS total_budgeted,
  COALESCE(expense_totals.total_spent, 0) AS total_spent,
  COALESCE(income_totals.total_income, 0) - COALESCE(budget_totals.total_budgeted, 0) AS amount_unallocated,
  mo.created_at,
  mo.updated_at
FROM public.monthly_overviews mo
LEFT JOIN (
  SELECT monthly_overview_id, SUM(amount) AS total_income
  FROM public.income_sources GROUP BY monthly_overview_id
) income_totals ON income_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT monthly_overview_id, SUM(budget_amount) AS total_budgeted
  FROM public.budgets GROUP BY monthly_overview_id
) budget_totals ON budget_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT b.monthly_overview_id, SUM(e.amount) AS total_spent
  FROM public.budgets b LEFT JOIN public.expenses e ON e.budget_id = b.id
  GROUP BY b.monthly_overview_id
) expense_totals ON expense_totals.monthly_overview_id = mo.id;

CREATE OR REPLACE VIEW public.budget_summary
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.monthly_overview_id,
  b.name,
  b.budget_amount,
  b.master_budget_id,
  b.override_amount,
  b.override_reason,
  COALESCE(SUM(e.amount), 0) AS amount_spent,
  b.budget_amount
    + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
    - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0)
    - COALESCE(SUM(e.amount), 0) AS amount_left,
  CASE
    WHEN (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0)) > 0
    THEN (COALESCE(SUM(e.amount), 0) / (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM public.transfers t WHERE t.from_budget_id = b.id), 0))) * 100
    ELSE 0
  END AS percent_used,
  b.description,
  b.created_at,
  b.updated_at
FROM public.budgets b
LEFT JOIN public.expenses e ON e.budget_id = b.id
GROUP BY b.id;

CREATE OR REPLACE VIEW public.investment_holding_summary
WITH (security_invoker = true)
AS
SELECT
  ih.id,
  ih.user_id,
  ih.name,
  ih.investment_type,
  ih.current_value,
  ih.last_valued_on,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) AS total_invested,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0) AS total_withdrawn,
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0) AS net_invested,
  ih.current_value - (
    COALESCE(SUM(CASE WHEN it.transaction_type IN ('Buy', 'Deposit') THEN it.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN it.transaction_type IN ('Sell', 'Withdrawal') THEN it.amount ELSE 0 END), 0)
  ) AS gain_loss,
  ih.notes,
  ih.created_at,
  ih.updated_at
FROM public.investment_holdings ih
LEFT JOIN public.investment_transactions it ON it.investment_holding_id = ih.id
GROUP BY ih.id;

-- Grant view access
GRANT SELECT ON public.monthly_overview_summary TO authenticated;
GRANT SELECT ON public.budget_summary TO authenticated;
GRANT SELECT ON public.investment_holding_summary TO authenticated;
