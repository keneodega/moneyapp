#!/usr/bin/env node

/**
 * Seed Test Data Script
 * Creates sample monthly budgets, expenses, and income for testing AI insights
 *
 * Usage: node scripts/seed-test-data.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  // Skip comments and empty lines
  if (!line || line.startsWith('#')) return;

  const equalIndex = line.indexOf('=');
  if (equalIndex === -1) return;

  const key = line.slice(0, equalIndex).trim();
  let value = line.slice(equalIndex + 1).trim();

  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  if (key) {
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : 'NOT FOUND');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get user ID - requires passing as argument or from env
async function getUserId() {
  // Check command line argument
  const argUserId = process.argv[2];
  if (argUserId) {
    return argUserId;
  }

  // Check environment variable
  const envUserId = env.SEED_USER_ID;
  if (envUserId) {
    return envUserId;
  }

  // Try to get from existing data
  const { data: existingMonth } = await supabase
    .from('monthly_overviews')
    .select('user_id')
    .limit(1)
    .single();

  if (existingMonth?.user_id) {
    return existingMonth.user_id;
  }

  // Try subscriptions table
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .limit(1)
    .single();

  if (existingSub?.user_id) {
    return existingSub.user_id;
  }

  console.error('Could not find user ID. Please provide it as an argument:');
  console.error('  npm run seed:test-data <user-id>');
  console.error('\nOr run: npm run get:user-id');
  process.exit(1);
}

// Budget categories with typical amounts
const BUDGET_CATEGORIES = [
  { name: 'Tithe', amount: 350, description: '10% of income' },
  { name: 'Offering', amount: 175, description: '5% of income' },
  { name: 'Housing', amount: 2228, description: 'Rent and utilities' },
  { name: 'Food', amount: 400, description: 'Groceries and dining' },
  { name: 'Transport', amount: 200, description: 'Fuel, parking, tolls' },
  { name: 'Personal Care', amount: 150, description: 'Personal items' },
  { name: 'Household', amount: 100, description: 'Home supplies' },
  { name: 'Savings', amount: 300, description: 'Monthly savings' },
  { name: 'Investments', amount: 100, description: 'Investment contributions' },
  { name: 'Subscriptions', amount: 80, description: 'Streaming and software' },
  { name: 'Health', amount: 50, description: 'Medicine and health' },
  { name: 'Travel', amount: 100, description: 'Travel allowance' },
  { name: 'Miscellaneous', amount: 100, description: 'Unexpected expenses' },
];

// Sample expense descriptions by category
const EXPENSE_SAMPLES = {
  'Housing': [
    { desc: 'Monthly rent', amount: 1800 },
    { desc: 'Electricity bill', amount: 120 },
    { desc: 'Gas bill', amount: 80 },
    { desc: 'Internet service', amount: 60 },
    { desc: 'Home insurance', amount: 45 },
  ],
  'Food': [
    { desc: 'Tesco groceries', amount: 85 },
    { desc: 'Lidl weekly shop', amount: 65 },
    { desc: 'Aldi groceries', amount: 55 },
    { desc: 'Dinner at restaurant', amount: 45 },
    { desc: 'Coffee and snacks', amount: 15 },
    { desc: 'Takeaway pizza', amount: 25 },
    { desc: 'Sunday roast ingredients', amount: 35 },
  ],
  'Transport': [
    { desc: 'Petrol fill-up', amount: 70 },
    { desc: 'Monthly toll tag', amount: 30 },
    { desc: 'Parking city center', amount: 15 },
    { desc: 'Car wash', amount: 12 },
    { desc: 'Bus ticket', amount: 8 },
  ],
  'Personal Care': [
    { desc: 'Haircut', amount: 35 },
    { desc: 'Pharmacy items', amount: 25 },
    { desc: 'Skincare products', amount: 40 },
    { desc: 'Gym membership', amount: 45 },
  ],
  'Household': [
    { desc: 'Cleaning supplies', amount: 25 },
    { desc: 'Light bulbs', amount: 15 },
    { desc: 'Kitchen items', amount: 30 },
    { desc: 'Laundry detergent', amount: 12 },
  ],
  'Health': [
    { desc: 'Prescription medicine', amount: 20 },
    { desc: 'Vitamins', amount: 18 },
    { desc: 'Doctor visit copay', amount: 25 },
  ],
  'Subscriptions': [
    { desc: 'Netflix monthly', amount: 17 },
    { desc: 'Spotify premium', amount: 11 },
    { desc: 'iCloud storage', amount: 3 },
    { desc: 'Microsoft 365', amount: 10 },
  ],
  'Miscellaneous': [
    { desc: 'Birthday gift', amount: 40 },
    { desc: 'Charity donation', amount: 25 },
    { desc: 'Office supplies', amount: 15 },
    { desc: 'Book purchase', amount: 20 },
  ],
};

// Generate random date within a month
function randomDateInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return new Date(year, month, day).toISOString().split('T')[0];
}

// Get random items from array
function getRandomItems(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Vary amount by percentage
function varyAmount(amount, percentVariation = 15) {
  const variation = (Math.random() - 0.5) * 2 * (percentVariation / 100);
  return Math.round(amount * (1 + variation) * 100) / 100;
}

async function seedTestData() {
  console.log('Starting test data seed...\n');

  const userId = await getUserId();
  console.log(`Using user ID: ${userId}\n`);

  // Create months: January 2026 and February 2026
  const months = [
    { name: 'January 2026', start: '2026-01-01', end: '2026-01-31', year: 2026, month: 0 },
    { name: 'February 2026', start: '2026-02-01', end: '2026-02-28', year: 2026, month: 1 },
  ];

  for (const monthData of months) {
    console.log(`\n--- Creating ${monthData.name} ---`);

    // Check if month already exists
    const { data: existingMonth } = await supabase
      .from('monthly_overviews')
      .select('id')
      .eq('user_id', userId)
      .eq('name', monthData.name)
      .single();

    let monthId;

    if (existingMonth) {
      console.log(`Month ${monthData.name} already exists, using existing...`);
      monthId = existingMonth.id;

      // Delete existing expenses for this month's budgets
      const { data: existingBudgets } = await supabase
        .from('budgets')
        .select('id')
        .eq('monthly_overview_id', monthId);

      if (existingBudgets?.length) {
        const budgetIds = existingBudgets.map(b => b.id);
        await supabase.from('expenses').delete().in('budget_id', budgetIds);
        console.log('Cleared existing expenses');
      }

      // Delete existing income
      await supabase.from('income_sources').delete().eq('monthly_overview_id', monthId);
      console.log('Cleared existing income');
    } else {
      // Create new month
      const { data: newMonth, error: monthError } = await supabase
        .from('monthly_overviews')
        .insert({
          user_id: userId,
          name: monthData.name,
          start_date: monthData.start,
          end_date: monthData.end,
        })
        .select()
        .single();

      if (monthError) {
        console.error(`Error creating month: ${monthError.message}`);
        continue;
      }

      monthId = newMonth.id;
      console.log(`Created month: ${monthData.name}`);

      // Create budgets for this month
      const budgetsToInsert = BUDGET_CATEGORIES.map(cat => ({
        monthly_overview_id: monthId,
        name: cat.name,
        budget_amount: varyAmount(cat.amount, 5), // Slight variation
        description: cat.description,
      }));

      const { error: budgetError } = await supabase
        .from('budgets')
        .insert(budgetsToInsert);

      if (budgetError) {
        console.error(`Error creating budgets: ${budgetError.message}`);
      } else {
        console.log(`Created ${budgetsToInsert.length} budget categories`);
      }
    }

    // Fetch budgets for this month
    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, name, budget_amount')
      .eq('monthly_overview_id', monthId);

    if (!budgets?.length) {
      console.error('No budgets found for month');
      continue;
    }

    // Create income sources
    const incomeItems = [
      { source: 'Primary Salary', amount: 4500, type: 'salary', person: 'Kene' },
      { source: 'Partner Salary', amount: 3200, type: 'salary', person: 'Ify' },
      { source: 'Freelance Project', amount: 800, type: 'freelance', person: 'Kene' },
    ];

    // Vary income slightly for January vs February
    const incomeMultiplier = monthData.month === 0 ? 1 : 1.05; // 5% raise in Feb

    const incomeToInsert = incomeItems.map(inc => ({
      monthly_overview_id: monthId,
      user_id: userId,
      source: inc.source,
      amount: Math.round(varyAmount(inc.amount * incomeMultiplier, 3)),
      income_type: inc.type,
      person: inc.person,
      date_paid: randomDateInMonth(monthData.year, monthData.month),
      bank: ['Revolut', 'AIB', 'N26'][Math.floor(Math.random() * 3)],
    }));

    const { error: incomeError } = await supabase
      .from('income_sources')
      .insert(incomeToInsert);

    if (incomeError) {
      console.error(`Error creating income: ${incomeError.message}`);
    } else {
      const totalIncome = incomeToInsert.reduce((sum, i) => sum + i.amount, 0);
      console.log(`Created ${incomeToInsert.length} income sources (total: €${totalIncome})`);
    }

    // Create expenses for each budget category
    let totalExpenses = 0;
    const allExpenses = [];

    for (const budget of budgets) {
      const samples = EXPENSE_SAMPLES[budget.name];
      if (!samples) continue;

      // Determine spending pattern
      // January: slightly under budget, February: some categories over
      const spendingRatio = monthData.month === 0
        ? 0.75 + Math.random() * 0.2  // 75-95% of budget in January
        : 0.85 + Math.random() * 0.25; // 85-110% in February (some overspending)

      const targetSpend = budget.budget_amount * spendingRatio;
      let categorySpend = 0;

      // Add expenses until we reach target
      const expensesToAdd = getRandomItems(samples, Math.min(samples.length, 5));

      for (const expense of expensesToAdd) {
        if (categorySpend >= targetSpend) break;

        const amount = varyAmount(expense.amount, 20);
        categorySpend += amount;

        allExpenses.push({
          budget_id: budget.id,
          user_id: userId,
          amount: amount,
          description: expense.desc,
          date: randomDateInMonth(monthData.year, monthData.month),
          bank: ['Revolut', 'AIB', 'N26', 'Cash'][Math.floor(Math.random() * 4)],
          is_recurring: expense.desc.toLowerCase().includes('monthly'),
        });
      }

      totalExpenses += categorySpend;
    }

    // Insert all expenses
    if (allExpenses.length > 0) {
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert(allExpenses);

      if (expenseError) {
        console.error(`Error creating expenses: ${expenseError.message}`);
      } else {
        console.log(`Created ${allExpenses.length} expenses (total: €${Math.round(totalExpenses)})`);
      }
    }
  }

  console.log('\n--- Test data seeding complete! ---');
  console.log('\nYou can now:');
  console.log('1. View the months at /months');
  console.log('2. See AI Insights on the Dashboard');
  console.log('3. Test expense categorization when adding new expenses');
}

seedTestData().catch(console.error);
