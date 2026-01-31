-- Family Money Tracker - Complete Database Schema for Supabase
-- Based on the Salesforce Family Money Tracker App
-- Run this SQL in the Supabase SQL Editor

-- ============================================
-- CLEANUP (Drop existing tables if re-running)
-- ============================================
DROP TABLE IF EXISTS investment_transactions CASCADE;
DROP TABLE IF EXISTS investment_holdings CASCADE;
DROP TABLE IF EXISTS financial_sub_goals CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS income_sources CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS financial_goals CASCADE;
DROP TABLE IF EXISTS monthly_overviews CASCADE;

DROP TYPE IF EXISTS bank_type CASCADE;
DROP TYPE IF EXISTS person_type CASCADE;
DROP TYPE IF EXISTS frequency_type CASCADE;
DROP TYPE IF EXISTS status_type CASCADE;
DROP TYPE IF EXISTS subscription_status_type CASCADE;
DROP TYPE IF EXISTS priority_type CASCADE;
DROP TYPE IF EXISTS goal_type CASCADE;
DROP TYPE IF EXISTS income_source_type CASCADE;
DROP TYPE IF EXISTS expense_sub_category_type CASCADE;
DROP TYPE IF EXISTS subscription_type CASCADE;
DROP TYPE IF EXISTS investment_type CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS platform_type CASCADE;

-- ============================================
-- ENUM TYPES (Global Value Sets)
-- ============================================

-- Banks
CREATE TYPE bank_type AS ENUM (
  'AIB', 'Revolut', 'N26', 'Wise', 'Bank of Ireland', 'Ulster Bank', 'Cash', 'Other'
);

-- Family Members
CREATE TYPE person_type AS ENUM (
  'Kene', 'Ify', 'Joint', 'Other'
);

-- Frequency options
CREATE TYPE frequency_type AS ENUM (
  'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually', 'One-Time'
);

-- Status for goals/sub-goals
CREATE TYPE status_type AS ENUM (
  'Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'
);

-- Status for subscriptions
CREATE TYPE subscription_status_type AS ENUM (
  'Active', 'Paused', 'Cancelled', 'Ended'
);

-- Priority levels
CREATE TYPE priority_type AS ENUM (
  'Low', 'Medium', 'High', 'Critical'
);

-- Goal types
CREATE TYPE goal_type AS ENUM (
  'Emergency Fund', 'Vacation', 'Home', 'Car', 'Education', 'Wedding', 'Retirement', 'Investment', 'Other'
);

-- Income sources
CREATE TYPE income_source_type AS ENUM (
  'Salary', 'Freelance', 'Side Hustle', 'Investment', 'Gift', 'Refund', 'Other'
);

-- Expense sub-categories
CREATE TYPE expense_sub_category_type AS ENUM (
  'Rent', 'Electricity', 'Gas', 'Water', 'Internet', 'Phone', 'Groceries', 'Dining Out',
  'Transport', 'Fuel', 'Parking', 'Toll', 'Insurance', 'Medical', 'Pharmacy',
  'Clothing', 'Personal Care', 'Entertainment', 'Subscriptions', 'Gifts',
  'Tithe', 'Offering', 'Charity', 'Education', 'Childcare', 'Pet', 'Home Maintenance',
  'Furniture', 'Electronics', 'Travel', 'Vacation', 'Investment', 'Savings', 'Other'
);

-- Subscription types
CREATE TYPE subscription_type AS ENUM (
  'Streaming', 'Software', 'Membership', 'Insurance', 'Utility', 'News', 'Gaming', 'Health', 'Other'
);

-- Investment types
CREATE TYPE investment_type AS ENUM (
  'Stocks', 'ETF', 'Bonds', 'Crypto', 'Real Estate', 'Mutual Fund', 'Pension', 'Savings Account', 'Other'
);

-- Transaction types
CREATE TYPE transaction_type AS ENUM (
  'Buy', 'Sell', 'Deposit', 'Withdrawal', 'Dividend', 'Interest'
);

-- Investment platforms
CREATE TYPE platform_type AS ENUM (
  'Degiro', 'Trading 212', 'Revolut', 'eToro', 'Interactive Brokers', 'Binance', 'Coinbase', 'Other'
);

-- ============================================
-- TABLES
-- ============================================

-- 1. MONTHLY OVERVIEW (Budget Period)
CREATE TABLE monthly_overviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g., "January 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Computed fields will be handled via views or functions
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 2. BUDGETS (Categories per month)
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Category name
  budget_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPENSES
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  sub_category expense_sub_category_type,
  bank bank_type,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency frequency_type,
  financial_goal_id UUID, -- Will add FK after financial_goals table
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INCOME SOURCES
CREATE TABLE income_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  source income_source_type NOT NULL,
  person person_type,
  bank bank_type,
  date_paid DATE NOT NULL,
  tithe_deduction BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FINANCIAL GOALS
CREATE TABLE financial_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status status_type DEFAULT 'Not Started',
  person person_type,
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

-- Add FK from expenses to financial_goals
ALTER TABLE expenses ADD CONSTRAINT fk_expense_goal 
  FOREIGN KEY (financial_goal_id) REFERENCES financial_goals(id) ON DELETE SET NULL;

-- 6. FINANCIAL SUB-GOALS
CREATE TABLE financial_sub_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  financial_goal_id UUID REFERENCES financial_goals(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  estimated_cost DECIMAL(12, 2),
  actual_cost DECIMAL(12, 2),
  status status_type DEFAULT 'Not Started',
  priority priority_type DEFAULT 'Medium',
  responsible_person person_type,
  start_date DATE,
  end_date DATE,
  progress DECIMAL(5, 2) DEFAULT 0, -- Percentage 0-100
  description TEXT,
  product_link TEXT,
  contribution_frequency frequency_type,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency frequency_type NOT NULL,
  status subscription_status_type DEFAULT 'Active',
  person person_type,
  bank bank_type,
  subscription_type subscription_type,
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

-- 8. INVESTMENT HOLDINGS
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

-- 9. INVESTMENT TRANSACTIONS
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

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_monthly_overviews_user ON monthly_overviews(user_id);
CREATE INDEX idx_monthly_overviews_dates ON monthly_overviews(start_date, end_date);

CREATE INDEX idx_budgets_monthly_overview ON budgets(monthly_overview_id);

CREATE INDEX idx_expenses_budget ON expenses(budget_id);
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_goal ON expenses(financial_goal_id);

CREATE INDEX idx_income_sources_monthly ON income_sources(monthly_overview_id);
CREATE INDEX idx_income_sources_user ON income_sources(user_id);
CREATE INDEX idx_income_sources_date ON income_sources(date_paid DESC);

CREATE INDEX idx_financial_goals_user ON financial_goals(user_id);
CREATE INDEX idx_financial_goals_status ON financial_goals(status);

CREATE INDEX idx_sub_goals_goal ON financial_sub_goals(financial_goal_id);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_investment_holdings_user ON investment_holdings(user_id);

CREATE INDEX idx_investment_transactions_holding ON investment_transactions(investment_holding_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(transaction_date DESC);

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

-- Monthly Overviews policies
CREATE POLICY "Users can view own monthly overviews" ON monthly_overviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly overviews" ON monthly_overviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly overviews" ON monthly_overviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly overviews" ON monthly_overviews
  FOR DELETE USING (auth.uid() = user_id);

-- Budgets policies (via monthly_overview ownership)
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert own budgets" ON budgets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM monthly_overviews WHERE id = budgets.monthly_overview_id AND user_id = auth.uid())
  );

-- Expenses policies
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Income Sources policies
CREATE POLICY "Users can view own income sources" ON income_sources
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income sources" ON income_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income sources" ON income_sources
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income sources" ON income_sources
  FOR DELETE USING (auth.uid() = user_id);

-- Financial Goals policies
CREATE POLICY "Users can view own financial goals" ON financial_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own financial goals" ON financial_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own financial goals" ON financial_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own financial goals" ON financial_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Financial Sub-Goals policies (via goal ownership)
CREATE POLICY "Users can view own sub goals" ON financial_sub_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert own sub goals" ON financial_sub_goals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update own sub goals" ON financial_sub_goals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete own sub goals" ON financial_sub_goals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM financial_goals WHERE id = financial_sub_goals.financial_goal_id AND user_id = auth.uid())
  );

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Investment Holdings policies
CREATE POLICY "Users can view own holdings" ON investment_holdings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own holdings" ON investment_holdings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own holdings" ON investment_holdings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own holdings" ON investment_holdings
  FOR DELETE USING (auth.uid() = user_id);

-- Investment Transactions policies
CREATE POLICY "Users can view own transactions" ON investment_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON investment_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON investment_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON investment_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================
-- VIEWS (Computed Fields)
-- ============================================

-- Monthly Overview with computed totals
CREATE OR REPLACE VIEW monthly_overview_summary
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
FROM monthly_overviews mo
LEFT JOIN (
  SELECT 
    monthly_overview_id,
    SUM(amount) AS total_income
  FROM income_sources
  GROUP BY monthly_overview_id
) income_totals ON income_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT 
    monthly_overview_id,
    SUM(budget_amount) AS total_budgeted
  FROM budgets
  GROUP BY monthly_overview_id
) budget_totals ON budget_totals.monthly_overview_id = mo.id
LEFT JOIN (
  SELECT 
    b.monthly_overview_id,
    SUM(e.amount) AS total_spent
  FROM budgets b
  LEFT JOIN expenses e ON e.budget_id = b.id
  GROUP BY b.monthly_overview_id
) expense_totals ON expense_totals.monthly_overview_id = mo.id;

-- Budget with spent amount and transfers
CREATE OR REPLACE VIEW budget_summary
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
    + COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.to_budget_id = b.id), 0)
    - COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.from_budget_id = b.id), 0)
    - COALESCE(SUM(e.amount), 0) AS amount_left,
  CASE 
    WHEN (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.from_budget_id = b.id), 0)) > 0
    THEN (COALESCE(SUM(e.amount), 0) / (b.budget_amount
      + COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.to_budget_id = b.id), 0)
      - COALESCE((SELECT SUM(t.amount) FROM transfers t WHERE t.from_budget_id = b.id), 0))) * 100
    ELSE 0 
  END AS percent_used,
  b.description,
  b.created_at,
  b.updated_at
FROM budgets b
LEFT JOIN expenses e ON e.budget_id = b.id
GROUP BY b.id;

-- Investment holding with totals
CREATE OR REPLACE VIEW investment_holding_summary
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
FROM investment_holdings ih
LEFT JOIN investment_transactions it ON it.investment_holding_id = ih.id
GROUP BY ih.id;

-- ============================================
-- DEFAULT BUDGET CATEGORIES FUNCTION
-- ============================================

-- Function to create default budgets when a new monthly overview is created
CREATE OR REPLACE FUNCTION create_default_budgets()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budgets (monthly_overview_id, name, budget_amount, description) VALUES
    (NEW.id, 'Tithe', 350.00, '10% of all income - giving back to God'),
    (NEW.id, 'Offering', 175.00, '5% of main income - additional giving'),
    (NEW.id, 'Housing', 2228.00, 'Rent, Electricity'),
    (NEW.id, 'Food', 350.00, 'Groceries & Snacks'),
    (NEW.id, 'Transport', 200.00, 'Toll, Parking, Fuel'),
    (NEW.id, 'Personal Care', 480.00, 'Personal allowances, Nails'),
    (NEW.id, 'Household', 130.00, 'Household items, Cleaning'),
    (NEW.id, 'Savings', 300.00, 'Monthly savings'),
    (NEW.id, 'Investments', 100.00, '401K, Stocks, Retirement contributions'),
    (NEW.id, 'Subscriptions', 75.00, 'Netflix, Spotify, and other recurring subscriptions'),
    (NEW.id, 'Health', 50.00, 'Medicine or health related'),
    (NEW.id, 'Travel', 50.00, 'Travel Allowance'),
    (NEW.id, 'Miscellaneous', 100.00, 'Unexpected expenses and other items');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_budgets_trigger
  AFTER INSERT ON monthly_overviews
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budgets();

-- ============================================
-- DONE!
-- ============================================
