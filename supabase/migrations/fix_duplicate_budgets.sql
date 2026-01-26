-- Migration: Fix duplicate budget creation
-- This adds a unique constraint and ensures the trigger handles conflicts properly

-- ============================================
-- Step 1: Add unique constraint to prevent duplicates
-- ============================================
-- This ensures that each monthly overview can only have one budget with a given name
ALTER TABLE budgets 
  ADD CONSTRAINT budgets_monthly_overview_name_unique 
  UNIQUE (monthly_overview_id, name);

-- ============================================
-- Step 2: Update the trigger function to handle conflicts
-- ============================================
CREATE OR REPLACE FUNCTION create_default_budgets()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budgets (monthly_overview_id, name, budget_amount, description)
  VALUES 
    (NEW.id, 'Tithe', 350.00, '10% of all income - giving back to God'),
    (NEW.id, 'Offering', 175.00, '5% of main income - additional giving'),
    (NEW.id, 'Housing', 2228.00, 'Rent, Electricity'),
    (NEW.id, 'Food', 350.00, 'Groceries & Snacks'),
    (NEW.id, 'Transport', 200.00, 'Toll, Parking, Fuel'),
    (NEW.id, 'Personal Care', 480.00, 'Personal allowances, Nails'),
    (NEW.id, 'Household', 130.00, 'Household items, Cleaning'),
    (NEW.id, 'Savings', 300.00, 'Monthly savings'),
    (NEW.id, 'Investments', 100.00, '401K, Stocks, Retirement contributions'),
    (NEW.id, 'Subscriptions', 75.00, 'Netflix, Spotify, and other recurring subscriptions'),
    (NEW.id, 'Health', 50.00, 'Medicine or health related'),
    (NEW.id, 'Travel', 50.00, 'Travel Allowance'),
    (NEW.id, 'Miscellaneous', 100.00, 'Unexpected expenses and other items')
  ON CONFLICT (monthly_overview_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================
-- Step 3: Clean up any existing duplicates (optional)
-- ============================================
-- This removes duplicate budgets, keeping only the first one created
DELETE FROM budgets
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY monthly_overview_id, name 
             ORDER BY created_at ASC
           ) as rn
    FROM budgets
  ) t
  WHERE t.rn > 1
);

-- Add comment
COMMENT ON CONSTRAINT budgets_monthly_overview_name_unique ON budgets IS 
  'Ensures each monthly overview can only have one budget with a given name, preventing duplicates';
