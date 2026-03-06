-- Add total_subscriptions snapshot column to monthly_overviews
-- Stores a snapshot of subscription costs so editing a subscription
-- does not retroactively change past months' displayed totals.
-- NULL means "not yet snapshotted" (distinct from a calculated zero).
ALTER TABLE monthly_overviews
  ADD COLUMN total_subscriptions DECIMAL(12, 2) DEFAULT NULL;
