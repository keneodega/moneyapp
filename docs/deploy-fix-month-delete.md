# Deploy: Fix Month Delete (Single & Bulk)

This migration fixes the bug where deleting one or more months failed because the `budget_history` trigger tried to read from an already-deleted `monthly_overviews` row.

## 1. Run the migration in Supabase

1. Open your **Supabase Dashboard** → your project.
2. Go to **SQL Editor**.
3. Copy the full contents of:
   ```
   supabase/migrations/fix_budget_history_on_month_delete.sql
   ```
4. Paste into the SQL Editor and click **Run** (or Cmd/Ctrl + Enter).
5. Confirm you see a success message (no errors).

No app code changes are required; the fix is database-only.

## 2. Verify

1. In the app, go to **Monthly Budgets**.
2. Select one or more months (or “Select all”) and click **Delete**.
3. Confirm the months are deleted without error.

## If you use staging

Run the same migration in your **staging** Supabase project first, then in **production**.
