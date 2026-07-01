/**
 * Add Transportation expenses for June 2026 to a specific account.
 *
 * Adds the following expenses to the Transportation budget of the
 * "June 2026" monthly overview for the account below:
 *
 *   eFlow  50.00   2026-06-03   Revolut
 *   Fuel   48.62   2026-06-02   AIB
 *   Fuel   54.70   2026-06-02   AIB
 *
 * Usage:
 *   node scripts/add-transportation-june-2026.mjs
 *
 * Requires .env.local with:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY   (bypasses RLS; used to resolve the user by email)
 *
 * NOTE: The `bank` values below are the base payment methods ('Revolut', 'AIB').
 * If this account stores custom payment-method labels (e.g. "Revolut Kene",
 * "AIB Kene"), edit the `bank` fields in EXPENSES to match those exact labels.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ---- Config -------------------------------------------------------------
const TARGET_EMAIL = 'odgeakenechukwu@gmail.com';
const MONTH_NAME = 'June 2026';
const MONTH_START = '2026-06-01';
const MONTH_END = '2026-06-30';
// Budget is matched case-insensitively by name containing this string.
const BUDGET_MATCH = 'transport';

const EXPENSES = [
  { description: 'eFlow', amount: 50.0,  date: '2026-06-03', bank: 'Revolut', sub_category: 'Toll' },
  { description: 'Fuel',  amount: 48.62, date: '2026-06-02', bank: 'AIB',     sub_category: 'Fuel' },
  { description: 'Fuel',  amount: 54.70, date: '2026-06-02', bank: 'AIB',     sub_category: 'Fuel' },
];
// -------------------------------------------------------------------------

// Load env from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUserId(email) {
  // Paginate through auth users to find the one matching the email.
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const match = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const userId = await resolveUserId(TARGET_EMAIL);
  if (!userId) {
    console.error(`No auth user found for ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log(`User: ${TARGET_EMAIL} -> ${userId}`);

  // Find (or create) the June 2026 monthly overview.
  let { data: month } = await supabase
    .from('monthly_overviews')
    .select('id, name, start_date, end_date')
    .eq('user_id', userId)
    .eq('name', MONTH_NAME)
    .maybeSingle();

  if (!month) {
    console.log(`"${MONTH_NAME}" not found, creating...`);
    const { data: created, error } = await supabase
      .from('monthly_overviews')
      .insert({ user_id: userId, name: MONTH_NAME, start_date: MONTH_START, end_date: MONTH_END })
      .select('id, name, start_date, end_date')
      .single();
    if (error) {
      console.error('Failed to create monthly overview:', error.message);
      process.exit(1);
    }
    month = created;
  }
  console.log(`Month: ${month.name} (${month.id})`);

  // Find the Transportation budget for this month.
  const { data: budgets, error: budgetErr } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('monthly_overview_id', month.id);
  if (budgetErr) {
    console.error('Failed to fetch budgets:', budgetErr.message);
    process.exit(1);
  }

  const budget = (budgets || []).find((b) => b.name.toLowerCase().includes(BUDGET_MATCH));
  if (!budget) {
    console.error(
      `No budget matching "${BUDGET_MATCH}" in ${month.name}.\n` +
        `Available budgets: ${(budgets || []).map((b) => b.name).join(', ') || '(none)'}`,
    );
    process.exit(1);
  }
  console.log(`Budget: ${budget.name} (${budget.id})`);

  // Insert the expenses.
  const rows = EXPENSES.map((e) => ({
    budget_id: budget.id,
    user_id: userId,
    amount: e.amount,
    date: e.date,
    description: e.description,
    sub_category: e.sub_category,
    bank: e.bank,
  }));

  const { data: inserted, error: insErr } = await supabase.from('expenses').insert(rows).select('id, description, amount, date, bank');
  if (insErr) {
    console.error('Failed to insert expenses:', insErr.message);
    process.exit(1);
  }

  console.log(`\nCreated ${inserted.length} expenses:`);
  for (const r of inserted) {
    console.log(`  ${r.date}  ${String(r.amount).padStart(8)}  ${r.bank.padEnd(10)}  ${r.description}`);
  }
  console.log('\nDone! Refresh the dashboard.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
