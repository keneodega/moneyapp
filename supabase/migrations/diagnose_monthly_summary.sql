-- Diagnostic Query: Check if monthly summary data exists
-- Run this in Supabase SQL Editor to see what data you have

-- 1. Check monthly overviews
SELECT 
  id, 
  name, 
  start_date, 
  end_date,
  user_id
FROM monthly_overviews
ORDER BY start_date DESC
LIMIT 5;

-- 2. Check budgets for a specific month (replace MONTH_ID with actual ID)
-- SELECT 
--   id,
--   name,
--   budget_amount,
--   monthly_overview_id
-- FROM budgets
-- WHERE monthly_overview_id = 'MONTH_ID'
-- ORDER BY name;

-- 3. Check income sources for a specific month
-- SELECT 
--   id,
--   amount,
--   source,
--   monthly_overview_id
-- FROM income_sources
-- WHERE monthly_overview_id = 'MONTH_ID'
-- ORDER BY date_paid DESC;

-- 4. Check if budgets are being created (count per month)
SELECT 
  mo.name,
  mo.id,
  COUNT(b.id) as budget_count,
  COALESCE(SUM(b.budget_amount), 0) as total_budgeted
FROM monthly_overviews mo
LEFT JOIN budgets b ON b.monthly_overview_id = mo.id
GROUP BY mo.id, mo.name
ORDER BY mo.start_date DESC;

-- 5. Check if income exists (count per month)
SELECT 
  mo.name,
  mo.id,
  COUNT(inc.id) as income_count,
  COALESCE(SUM(inc.amount), 0) as total_income
FROM monthly_overviews mo
LEFT JOIN income_sources inc ON inc.monthly_overview_id = mo.id
GROUP BY mo.id, mo.name
ORDER BY mo.start_date DESC;
