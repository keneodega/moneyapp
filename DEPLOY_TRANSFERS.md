# Deploy: Transfer & Drawdown Redesign

## ⚠️ Run these migrations in Supabase **before** deploying

In **Supabase Dashboard → SQL Editor**, run in order:

1. **`supabase/migrations/add_transfers_table.sql`**  
   - Creates `transfers` table, enum, triggers, RLS.

2. **`supabase/migrations/update_budget_summary_with_transfers.sql`**  
   - Recreates `budget_summary` view with transfer‑aware `amount_left`.

3. **`supabase/migrations/migrate_goal_drawdowns_to_transfers.sql`**  
   - Copies `goal_drawdowns` → `transfers`, updates goal balance trigger.

## Deploy

Commit, push to `main`, and let Vercel deploy (or use `vercel --prod`).
