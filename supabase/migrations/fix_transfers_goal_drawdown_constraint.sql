-- Fix transfers_goal_drawdown CHECK constraint.
-- Old version (from add_transfers_table.sql) only checked from_budget_id IS NULL,
-- which incorrectly rejected goal_to_budget transfers (from_goal_id set, to_budget_id set).
-- Strict version (from 20250101000000_initial_schema.sql) also requires to_budget_id IS NULL
-- so that the biconditional only matches genuine goal_drawdown rows.

ALTER TABLE public.transfers
  DROP CONSTRAINT IF EXISTS transfers_goal_drawdown;

ALTER TABLE public.transfers
  ADD CONSTRAINT transfers_goal_drawdown CHECK (
    (transfer_type = 'goal_drawdown') = (
      from_goal_id IS NOT NULL
      AND from_budget_id IS NULL
      AND to_budget_id IS NULL
    )
  );
