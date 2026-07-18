-- ============================================
-- Add Giving/Family and Travel/Leisure master-budget categories
--
-- The Revolut importer surfaced two spend clusters with no home in the existing
-- 13 categories: remittances + tithes/offering (Taptap Send, LemFi, church),
-- and hotels/stays (Bellinter House, Airbnb, Burrendale). Both are recurring
-- enough to track on their own line.
--
-- Already applied to the production account via the service-role client on
-- 2026-07-17; this file records the change and makes it reproducible for any
-- other environment. Idempotent — the unique (user_id, name) constraint plus
-- ON CONFLICT means re-running is a no-op.
-- ============================================

INSERT INTO master_budgets (user_id, name, budget_amount, is_active, budget_type, description)
VALUES
  ('5b53d910-46ee-4873-8624-1e89bbd5a0e9', 'Giving/Family', 0, true, 'Variable', 'Remittances, tithes/offering, family support'),
  ('5b53d910-46ee-4873-8624-1e89bbd5a0e9', 'Travel/Leisure', 0, true, 'Variable', 'Hotels, Airbnb, trips, leisure')
ON CONFLICT (user_id, name) DO NOTHING;
