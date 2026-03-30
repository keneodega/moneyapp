-- Add is_company_paid column to subscriptions table
-- Tracks subscriptions paid by KHO company before salary
ALTER TABLE subscriptions
  ADD COLUMN is_company_paid BOOLEAN DEFAULT FALSE NOT NULL;

-- Partial index for quick filtering of company-paid active subscriptions
CREATE INDEX idx_subscriptions_is_company_paid
  ON subscriptions(user_id, is_company_paid)
  WHERE status = 'Active';

-- Backfill: Mark existing subscriptions with bank = 'AIB KHO' as company-paid
UPDATE subscriptions
  SET is_company_paid = TRUE
  WHERE bank = 'AIB KHO';
