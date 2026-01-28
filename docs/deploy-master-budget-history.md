# Deploy Master Budget History

To see the **History** section on the Master Budgets page, do these two steps.

## 1. Run the migration in Supabase

1. Open your **Supabase Dashboard** → your project.
2. Go to **SQL Editor**.
3. Copy the full contents of:
   ```
   supabase/migrations/add_master_budget_history.sql
   ```
4. Paste into the SQL Editor and click **Run** (or Cmd/Ctrl + Enter).
5. Confirm you see a success message.

This creates the `master_budget_history` table and triggers so every create/update/delete on master budgets is recorded.

## 2. Deploy the app

Your app code already includes the History section. Deploy so that code is live:

**If you deploy via Git (e.g. Vercel):**

```bash
git add .
git commit -m "Add master budget history tracking"
git push origin main
```

**If you use Vercel CLI:**

```bash
vercel --prod
```

## 3. Check it works

1. Open your app and go to **Master Budgets**.
2. Scroll down: you should see a **History** section.
3. Add, edit, or delete a budget category and confirm new entries appear in History.

---

**Note:** History only includes changes that happen *after* the migration. Existing master budgets are not backfilled.
