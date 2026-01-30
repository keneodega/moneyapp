# MoneyApp – Deployment Status & Documentation Summary

**Generated:** Review of production readiness and local changes.

---

## 1. What Needs to Be Deployed

### Local changes not yet in production

Your branch is **up to date with `origin/main`**, but you have **uncommitted local changes** that are not deployed:

| Type | Files |
|------|--------|
| **Modified** | `package.json`, `package-lock.json` |
| **Modified** | `src/app/(dashboard)/months/[id]/budgets/[budgetId]/edit/page.tsx` |
| **Modified** | `src/app/(dashboard)/months/[id]/expense/new/page.tsx` |
| **Modified** | `src/app/(dashboard)/months/new/page.tsx` |
| **Untracked** | `src/lib/hooks/` (useFormToast.ts, useFormValidation.ts) |
| **Untracked** | `src/lib/validation/` (schemas.ts) |

**Summary:** Zod-based validation and form hooks have been added (new month, edit budget, new expense). These changes are only on your machine until you commit and push.

### To deploy these changes

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add Zod validation and form hooks for months, budgets, expenses"
   git push origin main
   ```
2. **Verify build:** Run `npm run build` locally before pushing.
3. **Vercel:** Will auto-deploy from `main` after push.

---

## 2. Documentation Overview

### Root-level docs

| File | Purpose |
|------|--------|
| **README.md** | Getting started, env vars, database setup, dev commands |
| **DEPLOYMENT_CHECKLIST.md** | Pre/post deploy checklist (Savings & Reports, migrations) |
| **DEPLOYMENT_STATUS.md** | This file – what’s deployed vs local |
| **MIGRATION_INSTRUCTIONS.md** | How to run DB migrations |
| **docs/deployment.md** | Full deployment guide (Vercel, Supabase, env, workflows) |
| **docs/production-prerequisites.md** | RLS, security, production readiness |
| **docs/production-hardening.md** | Hardening and security |
| **docs/nextjs-production-checklist.md** | Next.js production checklist |
| **docs/monitoring.md** | Monitoring and observability |
| **docs/uptime-monitoring.md** | Uptime monitoring |
| **docs/backups-restore.md** | Backups and restore |
| **docs/backups-quick-reference.md** | Quick backup reference |
| **docs/deploy-master-budget-history.md** | Master budget history deploy steps |

### Important deployment points from docs

- **Vercel:** Push to `main` → production deploy.
- **Supabase:** Use **SQL Editor** to run migrations (no CLI required). Test on staging first, then production.
- **Env vars (Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_ENV`.
- **Database:** Run migrations in order; see `supabase/migrations/` and any feature-specific docs (e.g. goal contributions, drawdowns, savings).

---

## 3. Database Migrations (Supabase)

Migrations live in **`supabase/migrations/`**. Production must have the ones your app uses applied (via SQL Editor). Examples that your app likely depends on:

- `add_goal_contributions_table.sql`
- `add_goal_drawdowns_table.sql`
- `update_goal_amount_trigger_for_drawdowns.sql`
- `migrate_expense_goal_links_to_contributions.sql`
- `add_master_budget_history.sql`, `add_budget_type_to_master_budgets.sql`
- `add_loans_table.sql`
- `add_subscription_essential_field.sql`
- Others as needed for features you use

**Action:** In Supabase (production and staging), confirm which of these have already been run and run any that are missing.

---

## 4. Quick Checklist Before Deploy

- [ ] Run `npm run build` locally – must succeed.
- [ ] Commit all intended changes (including `src/lib/hooks/`, `src/lib/validation/`).
- [ ] Push to `main` (or your production branch).
- [ ] Confirm required Supabase migrations are applied in production.
- [ ] Check Vercel env vars and deployment logs after push.

---

## 5. Summary

| Item | Status |
|------|--------|
| **Unpushed commits** | None (branch up to date with origin/main) |
| **Uncommitted changes** | Yes – Zod, validation schemas, form hooks, and updated month/budget/expense pages |
| **Production deploy** | Pending until you commit, push, and migrations are applied |
| **Docs** | README, deployment, prerequisites, migrations, and feature-specific guides are in place |

**Next step:** Commit and push the local changes above, then run any missing migrations in production Supabase so production matches the app.
