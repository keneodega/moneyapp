import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) {
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '5b53d910-46ee-4873-8624-1e89bbd5a0e9';

async function addFebData() {
  // Get Feb month
  let { data: febMonth } = await supabase
    .from('monthly_overviews')
    .select('id, name')
    .eq('user_id', userId)
    .eq('name', 'February 2026')
    .single();

  if (!febMonth) {
    console.log('February 2026 not found, creating...');
    const { data: newMonth, error } = await supabase
      .from('monthly_overviews')
      .insert({ user_id: userId, name: 'February 2026', start_date: '2026-02-01', end_date: '2026-02-28' })
      .select()
      .single();
    if (error) { console.error(error); return; }
    febMonth = newMonth;
  }

  console.log('Found Feb month:', febMonth.id);

  // Check if budgets exist
  const { data: existingBudgets } = await supabase
    .from('budgets')
    .select('id')
    .eq('monthly_overview_id', febMonth.id);

  if (existingBudgets && existingBudgets.length > 0) {
    console.log('Budgets already exist:', existingBudgets.length);
  } else {
    // Create budgets
    const categories = [
      { name: 'Tithe', budget_amount: 350 },
      { name: 'Offering', budget_amount: 175 },
      { name: 'Housing', budget_amount: 2228 },
      { name: 'Food', budget_amount: 400 },
      { name: 'Transport', budget_amount: 200 },
      { name: 'Personal Care', budget_amount: 150 },
      { name: 'Household', budget_amount: 100 },
      { name: 'Savings', budget_amount: 300 },
      { name: 'Subscriptions', budget_amount: 80 },
      { name: 'Health', budget_amount: 50 },
      { name: 'Miscellaneous', budget_amount: 100 },
    ];

    const budgetsToInsert = categories.map(c => ({
      monthly_overview_id: febMonth.id,
      name: c.name,
      budget_amount: c.budget_amount,
    }));

    const { error: budgetError } = await supabase.from('budgets').insert(budgetsToInsert);
    if (budgetError) { console.error('Budget error:', budgetError); return; }
    console.log('Created', budgetsToInsert.length, 'budgets for February');
  }

  // Get budget IDs
  const { data: budgets } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('monthly_overview_id', febMonth.id);

  console.log('Found budgets:', budgets?.length);

  // Add some expenses
  const expenses = [
    { budgetName: 'Food', amount: 85, description: 'Tesco groceries' },
    { budgetName: 'Food', amount: 42, description: 'Lidl shopping' },
    { budgetName: 'Transport', amount: 65, description: 'Petrol' },
    { budgetName: 'Housing', amount: 1800, description: 'Monthly rent' },
    { budgetName: 'Housing', amount: 95, description: 'Electricity' },
    { budgetName: 'Subscriptions', amount: 17, description: 'Netflix' },
  ];

  const expensesToInsert = expenses.map(e => {
    const budget = budgets.find(b => b.name === e.budgetName);
    return {
      budget_id: budget?.id,
      user_id: userId,
      amount: e.amount,
      description: e.description,
      date: '2026-02-0' + (Math.floor(Math.random() * 3) + 1),
    };
  }).filter(e => e.budget_id);

  if (expensesToInsert.length > 0) {
    const { error: expError } = await supabase.from('expenses').insert(expensesToInsert);
    if (expError) { console.error('Expense error:', expError); return; }
    console.log('Created', expensesToInsert.length, 'expenses');
  }

  console.log('Done! Refresh the dashboard.');
}

addFebData();
