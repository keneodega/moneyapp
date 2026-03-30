-- Subscription snapshots per month
-- Captures subscription state when a month is first viewed after its end date,
-- so that past months retain historically accurate subscription data.

CREATE TABLE month_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID REFERENCES monthly_overviews(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency frequency_type NOT NULL,
  status subscription_status_type NOT NULL,
  is_company_paid BOOLEAN DEFAULT FALSE NOT NULL,
  is_essential BOOLEAN DEFAULT TRUE NOT NULL,
  collection_day INTEGER,
  start_date DATE,
  end_date DATE,
  next_collection_date DATE,
  total_due DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_month_subscription UNIQUE (month_id, subscription_id)
);

-- RLS
ALTER TABLE month_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own month_subscriptions" ON month_subscriptions
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own month_subscriptions" ON month_subscriptions
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own month_subscriptions" ON month_subscriptions
  FOR UPDATE USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own month_subscriptions" ON month_subscriptions
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Index for fast lookup by month
CREATE INDEX idx_month_subscriptions_month_id ON month_subscriptions(month_id);
CREATE INDEX idx_month_subscriptions_user_id ON month_subscriptions(user_id);
