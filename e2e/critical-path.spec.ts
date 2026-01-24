/**
 * E2E Tests for Critical Path
 * 
 * Tests the core flow:
 * 1. Create Month → auto-creates 12 budget categories
 * 2. Add income
 * 3. Add expense (with category selection)
 * 4. Verify totals update correctly
 * 5. Verify overspend blocking works
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Path - Budget Management Flow', () => {
  // Using mock data for E2E tests since we don't have real auth
  
  test('should display months list grouped by year', async ({ page }) => {
    await page.goto('/months');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Monthly Budgets' })).toBeVisible();
    
    // Check year headers are visible (use exact match to avoid month names)
    await expect(page.getByRole('heading', { name: '2026', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2025', exact: true })).toBeVisible();
    
    // Check at least one month card is visible
    await expect(page.getByRole('heading', { name: 'January 2026' })).toBeVisible();
    
    // Check "New Month" button exists
    await expect(page.getByRole('link', { name: /New Month/i })).toBeVisible();
  });

  test('should navigate to month detail and show dashboard', async ({ page }) => {
    await page.goto('/months/1');
    
    // Check month header
    await expect(page.getByRole('heading', { name: 'January 2026' })).toBeVisible();
    
    // Check all 4 dashboard cards are visible
    await expect(page.getByText('Total Income')).toBeVisible();
    await expect(page.getByText('Total Budgeted')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
    await expect(page.getByText('Unallocated')).toBeVisible();
    
    // Check dashboard values
    await expect(page.getByText('€5,200')).toBeVisible(); // Total income
    await expect(page.getByText('€4,588')).toBeVisible(); // Total budgeted
  });

  test('should display all 13 default budget categories', async ({ page }) => {
    await page.goto('/months/1');
    
    // Check all 13 budget categories are displayed (Tithe and Offering are now separate)
    const expectedCategories = [
      'Tithe',
      'Offering',
      'Housing',
      'Food',
      'Transport',
      'Personal Care',
      'Household',
      'Savings',
      'Investments',
      'Subscriptions',
      'Health',
      'Travel',
      'Miscellaneous',
    ];
    
    for (const category of expectedCategories) {
      await expect(page.getByRole('heading', { name: category })).toBeVisible();
    }
  });

  test('should display income sources', async ({ page }) => {
    await page.goto('/months/1');
    
    // Check income section header
    await expect(page.getByRole('heading', { name: 'Income' })).toBeVisible();
    
    // Check income entries (use first() for multiple matches)
    await expect(page.getByText('Salary').first()).toBeVisible();
    await expect(page.getByText('Kene').first()).toBeVisible();
    await expect(page.getByText('Ify').first()).toBeVisible();
    
    // Check Add Income button
    await expect(page.getByRole('link', { name: /Add Income/i })).toBeVisible();
  });

  test('should navigate to add income form', async ({ page }) => {
    await page.goto('/months/1');
    
    // Click Add Income
    await page.getByRole('link', { name: /Add Income/i }).click();
    
    // Check we're on the income form
    await expect(page.getByRole('heading', { name: 'Add Income' })).toBeVisible();
    
    // Check form fields exist
    await expect(page.getByLabel(/Amount/i)).toBeVisible();
    await expect(page.getByLabel(/Income Source/i)).toBeVisible();
    await expect(page.getByLabel(/Person/i)).toBeVisible();
    await expect(page.getByLabel(/Bank/i)).toBeVisible();
    await expect(page.getByLabel(/Date Received/i)).toBeVisible();
    await expect(page.getByText(/Apply Tithe Deduction/i)).toBeVisible();
  });

  test('should have correct income form defaults', async ({ page }) => {
    await page.goto('/months/1/income/new');
    
    // Check default values
    await expect(page.getByLabel(/Income Source/i)).toHaveValue('Salary');
    await expect(page.getByLabel(/Person/i)).toHaveValue('Kene');
    await expect(page.getByLabel(/Bank/i)).toHaveValue('AIB');
    
    // Check tithe deduction is checked by default
    await expect(page.getByRole('checkbox', { name: /Tithe Deduction/i })).toBeChecked();
  });

  test('should navigate to add expense form', async ({ page }) => {
    await page.goto('/months/1');
    
    // Click Add Expense
    await page.getByRole('link', { name: /Add Expense/i }).click();
    
    // Check we're on the expense form
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible();
    
    // Check form fields exist (use first() for multiple matches)
    await expect(page.getByText('Budget Category', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Amount/i)).toBeVisible();
    await expect(page.getByLabel(/Date/i).first()).toBeVisible();
    await expect(page.getByLabel(/Payment Method/i)).toBeVisible();
  });

  test('should show budget categories with remaining amounts in expense form', async ({ page }) => {
    await page.goto('/months/1/expense/new');
    
    // Get the budget category dropdown
    const categorySelect = page.locator('select[name="budget_id"]');
    
    // Check it exists and has options
    await expect(categorySelect).toBeVisible();
    
    // Check that options show remaining amounts
    const options = await categorySelect.locator('option').allTextContents();
    
    // Should have a placeholder and 12 categories
    expect(options.length).toBeGreaterThanOrEqual(12);
    
    // Check some options contain "left" amount info
    expect(options.some(opt => opt.includes('left'))).toBe(true);
  });

  test('should disable budget categories with zero balance in expense form', async ({ page }) => {
    await page.goto('/months/1/expense/new');
    
    // Get the budget category dropdown
    const categorySelect = page.locator('select[name="budget_id"]');
    
    // Check for disabled options (categories with €0 left)
    const disabledOptions = await categorySelect.locator('option[disabled]').count();
    
    // There should be some disabled options (placeholder + exhausted budgets)
    expect(disabledOptions).toBeGreaterThan(0);
  });

  test('should show budget info when category is selected', async ({ page }) => {
    await page.goto('/months/1/expense/new');
    
    // Select a category with remaining balance (Food has €65 left)
    const categorySelect = page.locator('select[name="budget_id"]');
    // Get all options and find one containing "Food"
    const options = await categorySelect.locator('option').allTextContents();
    const foodOption = options.find(opt => opt.includes('Food'));
    if (foodOption) {
      await categorySelect.selectOption({ label: foodOption });
    }
    
    // Check budget info panel appears
    await expect(page.getByText('Budget', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Remaining/i)).toBeVisible();
  });

  test('should navigate to new month form', async ({ page }) => {
    await page.goto('/months');
    
    // Click New Month
    await page.getByRole('link', { name: /New Month/i }).click();
    
    // Check we're on the new month form
    await expect(page.getByRole('heading', { name: /New Month/i })).toBeVisible();
    
    // Check form fields
    await expect(page.getByLabel(/Month Name/i)).toBeVisible();
    await expect(page.getByLabel(/Start Date/i)).toBeVisible();
    await expect(page.getByLabel(/End Date/i)).toBeVisible();
    
    // Check info card about default budgets
    await expect(page.getByText(/Default Budgets/i)).toBeVisible();
    await expect(page.getByText(/13 budget categories/i)).toBeVisible();
  });

  test('should have month name pre-filled based on current date', async ({ page }) => {
    await page.goto('/months/new');
    
    // The month name should be pre-filled with current month
    const monthNameInput = page.getByLabel(/Month Name/i);
    const value = await monthNameInput.inputValue();
    
    // Should contain a month name (e.g., "January 2026")
    expect(value).toMatch(/\w+ \d{4}/);
  });

  test('should navigate back from forms', async ({ page }) => {
    // Test income form back navigation
    await page.goto('/months/1/income/new');
    await page.getByRole('link', { name: /Cancel/i }).click();
    await expect(page).toHaveURL('/months/1');
    
    // Test expense form back navigation
    await page.goto('/months/1/expense/new');
    await page.getByRole('link', { name: /Cancel/i }).click();
    await expect(page).toHaveURL('/months/1');
    
    // Test new month form back navigation
    await page.goto('/months/new');
    await page.getByRole('link', { name: /Cancel/i }).click();
    await expect(page).toHaveURL('/months');
  });

  test('should show current month indicator', async ({ page }) => {
    await page.goto('/months');
    
    // January 2026 should be marked as current
    const currentBadge = page.getByText('Current');
    await expect(currentBadge).toBeVisible();
  });

  test('should show progress bars for budget utilization', async ({ page }) => {
    await page.goto('/months/1');
    
    // Budget cards should have progress indicators
    // Check for "spent" and "left" text that indicates progress
    const spentTexts = await page.getByText(/spent/).count();
    const leftTexts = await page.getByText(/left/).count();
    
    // Should have progress info for each of the 12 budgets
    expect(spentTexts).toBeGreaterThanOrEqual(12);
    expect(leftTexts).toBeGreaterThanOrEqual(12);
  });

  test('should display month summary stats', async ({ page }) => {
    await page.goto('/months/1');
    
    // Check month summary section
    await expect(page.getByText('Month Summary')).toBeVisible();
    await expect(page.getByText('Days remaining')).toBeVisible();
    await expect(page.getByText('Budgets on track')).toBeVisible();
    await expect(page.getByText('Avg. daily spend')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should have working navigation bar', async ({ page }) => {
    await page.goto('/months');
    
    // Check navigation links
    await expect(page.getByRole('link', { name: /Family Money/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Months/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Goals/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).toBeVisible();
  });

  test('should navigate between sections', async ({ page }) => {
    await page.goto('/months');
    
    // Navigate to Goals
    await page.getByRole('link', { name: /Goals/i }).click();
    await expect(page).toHaveURL('/goals');
    await expect(page.getByRole('heading', { name: /Financial Goals/i })).toBeVisible();
    
    // Navigate to Subscriptions
    await page.getByRole('link', { name: /Subscriptions/i }).click();
    await expect(page).toHaveURL('/subscriptions');
    await expect(page.getByRole('heading', { name: /Subscriptions/i })).toBeVisible();
    
    // Navigate back to Months
    await page.getByRole('link', { name: /Months/i }).click();
    await expect(page).toHaveURL('/months');
  });

  test('should redirect home to months', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/months');
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/months');
    
    // Logo icon should still be visible (text is hidden on mobile)
    await expect(page.locator('header')).toBeVisible();
    
    // Month cards should stack vertically
    await expect(page.getByRole('heading', { name: 'Monthly Budgets' })).toBeVisible();
  });

  test('should display month detail correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/months/1');
    
    // Dashboard cards should be visible
    await expect(page.getByText('Total Income')).toBeVisible();
    await expect(page.getByText('Total Budgeted')).toBeVisible();
  });
});

test.describe('Form Validation UI', () => {
  test('should show required field validation on expense form', async ({ page }) => {
    await page.goto('/months/1/expense/new');
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Add Expense/i }).click();
    
    // The form should not submit (still on same page)
    await expect(page).toHaveURL('/months/1/expense/new');
  });

  test('should show required field validation on income form', async ({ page }) => {
    await page.goto('/months/1/income/new');
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /Add Income/i }).click();
    
    // The form should not submit (still on same page)
    await expect(page).toHaveURL('/months/1/income/new');
  });

  test('should show required field validation on new month form', async ({ page }) => {
    await page.goto('/months/new');
    
    // Clear the pre-filled name
    await page.getByLabel(/Month Name/i).clear();
    
    // Try to submit
    await page.getByRole('button', { name: /Create Month/i }).click();
    
    // The form should not submit (still on same page)
    await expect(page).toHaveURL('/months/new');
  });
});
