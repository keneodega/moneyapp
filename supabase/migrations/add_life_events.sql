-- ============================================
-- Life Events table for financial forecasting
-- ============================================
CREATE TABLE IF NOT EXISTS life_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('baby', 'property', 'vehicle', 'career', 'education', 'other')),
  expected_date DATE NOT NULL,
  date_confidence TEXT NOT NULL DEFAULT 'month'
    CHECK (date_confidence IN ('year', 'quarter', 'month')),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  -- One-time financial impact
  one_time_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  one_time_income DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Recurring monthly impact (positive = new cost added, negative = cost removed)
  recurring_monthly_change DECIMAL(12,2) NOT NULL DEFAULT 0,
  recurring_description TEXT,

  -- Income impact
  income_monthly_change DECIMAL(12,2) NOT NULL DEFAULT 0,
  income_change_duration_months INTEGER,
  income_change_description TEXT,

  -- Optional link to a savings goal
  linked_goal_id UUID REFERENCES financial_goals(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_life_events_user_id ON life_events(user_id);
CREATE INDEX IF NOT EXISTS idx_life_events_expected_date ON life_events(expected_date);
CREATE INDEX IF NOT EXISTS idx_life_events_status ON life_events(status);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own life events"
  ON life_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Auto-update timestamp trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_life_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS life_events_updated_at ON life_events;
CREATE TRIGGER life_events_updated_at
  BEFORE UPDATE ON life_events
  FOR EACH ROW EXECUTE FUNCTION update_life_events_updated_at();

COMMENT ON TABLE life_events IS 'Stores planned life events and their financial impact for forecasting';
COMMENT ON COLUMN life_events.one_time_cost IS 'Lump sum outflow at event date (e.g. deposit, car price, hospital costs)';
COMMENT ON COLUMN life_events.one_time_income IS 'Lump sum inflow at event date (e.g. car trade-in value)';
COMMENT ON COLUMN life_events.recurring_monthly_change IS 'Permanent monthly budget change after event (positive = new cost, negative = cost removed)';
COMMENT ON COLUMN life_events.income_monthly_change IS 'Monthly income change after event (negative = reduction, e.g. maternity leave)';
COMMENT ON COLUMN life_events.income_change_duration_months IS 'How many months the income change lasts; NULL means permanent';
