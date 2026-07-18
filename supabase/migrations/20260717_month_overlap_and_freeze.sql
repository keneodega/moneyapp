-- ============================================
-- Month boundary integrity + freeze historical months
--
-- Run this once in the Supabase SQL Editor (this repo applies migrations
-- manually — see CLAUDE.md). Idempotent: safe to re-run.
--
-- Three things, in dependency order:
--   1. Fix the May/June boundary overlap (both touched 2026-05-31).
--   2. Add an exclusion constraint so month ranges can never overlap again.
--   3. Add a `status` column and freeze Feb–June 2026 as historical.
-- ============================================

-- 1. Fix the overlap FIRST — the constraint in step 2 would reject the current
--    data otherwise. May ended on the same day June started.
UPDATE monthly_overviews
SET end_date = '2026-05-30'
WHERE name = 'May 2026'
  AND end_date = '2026-05-31';

-- 2. Prevent any future overlap. A shared boundary day is an overlap (inclusive
--    range '[]'), which is what silently broke the "current month" lookup.
--    btree_gist is required to mix the equality (user_id) and range operators.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE monthly_overviews
  DROP CONSTRAINT IF EXISTS monthly_overviews_no_overlap;

ALTER TABLE monthly_overviews
  ADD CONSTRAINT monthly_overviews_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  );

-- 3. Freeze the historical months. Feb–June 2026 were kept but are not trusted;
--    July onward runs on the new system. 'open' is the default for every month
--    created from here on.
ALTER TABLE monthly_overviews
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'frozen'));

UPDATE monthly_overviews
SET status = 'frozen'
WHERE name IN ('February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026');

-- Verification (all should look right):
--   SELECT name, start_date, end_date, status FROM monthly_overviews ORDER BY start_date;
--   -- no two rows for the same user should share or overlap a date range
--   -- Feb–June = frozen, July = open
