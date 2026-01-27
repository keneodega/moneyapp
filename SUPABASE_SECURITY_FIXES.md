# Supabase Security Fixes

This document outlines the security warnings from Supabase linter and how to fix them.

## 1. Function Search Path Mutable Warnings

### Issue
Three functions have mutable `search_path`, which is a security risk. The `search_path` determines which schemas are searched when resolving unqualified names.

### Functions to Fix
1. `get_effective_budget_amount` - Returns effective budget amount (override or master)
2. `get_budget_deviation` - Calculates deviation from master budget
3. `update_updated_at_column` - Auto-updates updated_at timestamp

### Solution

Run these SQL migrations in the Supabase SQL Editor (in order):

1. **`supabase/migrations/fix_function_search_path.sql`** - Fixes `update_updated_at_column()` and other core functions
2. **`supabase/migrations/fix_master_budget_functions_search_path.sql`** - Fixes `get_effective_budget_amount()` and `get_budget_deviation()`

### How to Run

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file
4. Run each migration
5. Verify the warnings are gone by checking the Database Linter

## 2. Leaked Password Protection Disabled

### Issue
Supabase Auth's leaked password protection is currently disabled. This feature checks passwords against HaveIBeenPwned.org to prevent the use of compromised passwords.

### Solution

Enable this feature in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll down to **Password Strength** section
4. Enable **"Leaked Password Protection"**
5. Save changes

### Benefits
- Prevents users from using passwords that have been compromised in data breaches
- Enhances overall security of user accounts
- Works automatically - no code changes needed

## Verification

After running the migrations and enabling leaked password protection:

1. Go to **Database** → **Linter** in Supabase Dashboard
2. Verify that the warnings are resolved
3. The linter should show no warnings for these issues

## Notes

- These migrations are **idempotent** - safe to run multiple times
- The `SET search_path = ''` ensures functions use fully qualified names (e.g., `public.table_name`)
- All table references in the functions have been updated to use `public.` prefix
