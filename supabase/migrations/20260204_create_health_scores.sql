-- Financial Health Scores table
-- Tracks monthly financial health assessments with AI recommendations

CREATE TABLE financial_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_overview_id UUID REFERENCES monthly_overviews(id) ON DELETE SET NULL,

  -- Overall score (0-100)
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  score_label VARCHAR(50) NOT NULL,

  -- Individual metric scores
  savings_rate_score INTEGER NOT NULL CHECK (savings_rate_score >= 0 AND savings_rate_score <= 40),
  debt_to_income_score INTEGER NOT NULL CHECK (debt_to_income_score >= 0 AND debt_to_income_score <= 30),
  budget_adherence_score INTEGER NOT NULL CHECK (budget_adherence_score >= 0 AND budget_adherence_score <= 30),

  -- Raw metric values (percentages)
  savings_rate DECIMAL(5,2),
  debt_to_income_ratio DECIMAL(5,2),
  budget_adherence_rate DECIMAL(5,2),

  -- Financial snapshot
  total_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_debt_payments DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- AI recommendations (cached)
  ai_recommendations JSONB,
  recommendations_generated_at TIMESTAMPTZ,

  -- Month this score represents
  calculated_for_month DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One score per user per month
  UNIQUE(user_id, calculated_for_month)
);

-- Indexes for efficient queries
CREATE INDEX idx_health_scores_user_month ON financial_health_scores(user_id, calculated_for_month DESC);
CREATE INDEX idx_health_scores_user_created ON financial_health_scores(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own health scores"
  ON financial_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health scores"
  ON financial_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own health scores"
  ON financial_health_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own health scores"
  ON financial_health_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON financial_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
