import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function toISODate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const masterBudgetDefs = [
  { name: 'Rent', amount: 1500, type: 'Fixed' },
  { name: 'Utilities', amount: 200, type: 'Fixed' },
  { name: 'Groceries', amount: 500, type: 'Variable' },
  { name: 'Transport', amount: 250, type: 'Variable' },
  { name: 'Dining Out', amount: 200, type: 'Variable' },
  { name: 'Subscriptions', amount: 120, type: 'Fixed' },
  { name: 'Savings', amount: 400, type: 'Fixed' },
  { name: 'Misc', amount: 150, type: 'Variable' },
];

const expenseCategoryMap = {
  Rent: 'Rent',
  Utilities: 'Electricity',
  Groceries: 'Groceries',
  Transport: 'Transport',
  'Dining Out': 'Dining Out',
  Subscriptions: 'Subscriptions',
  Misc: 'Other',
};

const paymentMethods = ['Revolut', 'AIB', 'N26', 'Wise'];

async function main() {
  const email = `test.user+${Date.now()}@moneyapp.local`;
  const password = crypto.randomBytes(9).toString('base64url');

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError || !userData?.user) {
    throw new Error(`Failed to create user: ${userError?.message || 'unknown error'}`);
  }

  const userId = userData.user.id;

  const { data: masterBudgets, error: masterErr } = await supabase
    .from('master_budgets')
    .insert(
      masterBudgetDefs.map((b, i) => ({
        user_id: userId,
        name: b.name,
        budget_amount: b.amount,
        description: `${b.name} baseline`,
        is_active: true,
        display_order: i + 1,
        budget_type: b.type,
      }))
    )
    .select();

  if (masterErr || !masterBudgets) {
    throw new Error(`Failed to create master budgets: ${masterErr?.message || 'unknown error'}`);
  }

  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = toISODate(d.getFullYear(), d.getMonth(), 1);
    const end = toISODate(d.getFullYear(), d.getMonth(), lastDayOfMonth(d.getFullYear(), d.getMonth()));
    months.push({
      user_id: userId,
      name: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      start_date: start,
      end_date: end,
      notes: 'Seeded mock data',
    });
  }

  const { data: createdMonths, error: monthErr } = await supabase
    .from('monthly_overviews')
    .insert(months)
    .select();

  if (monthErr || !createdMonths) {
    throw new Error(`Failed to create months: ${monthErr?.message || 'unknown error'}`);
  }

  for (const month of createdMonths) {
    const budgets = masterBudgets.map((mb) => {
      const variance = mb.budget_type === 'Variable' ? (0.9 + rand() * 0.25) : 1;
      const amount = Math.round(Number(mb.budget_amount) * variance);
      return {
        monthly_overview_id: month.id,
        name: mb.name,
        budget_amount: amount,
        description: `${mb.name} budget`,
        master_budget_id: mb.id,
      };
    });

    const { data: createdBudgets, error: budgetErr } = await supabase
      .from('budgets')
      .insert(budgets)
      .select();

    if (budgetErr || !createdBudgets) {
      throw new Error(`Failed to create budgets for ${month.name}: ${budgetErr?.message || 'unknown error'}`);
    }

    // Income sources (2 salaries per month)
    const incomeRows = [
      {
        monthly_overview_id: month.id,
        user_id: userId,
        amount: 3500 + Math.round((rand() - 0.5) * 200),
        source: 'Salary',
        person: 'Kene',
        bank: pick(paymentMethods),
        date_paid: month.start_date,
        description: 'Primary salary',
      },
      {
        monthly_overview_id: month.id,
        user_id: userId,
        amount: 2500 + Math.round((rand() - 0.5) * 200),
        source: 'Salary',
        person: 'Ify',
        bank: pick(paymentMethods),
        date_paid: month.start_date,
        description: 'Secondary salary',
      },
    ];

    const { error: incomeErr } = await supabase.from('income_sources').insert(incomeRows);
    if (incomeErr) {
      throw new Error(`Failed to create income for ${month.name}: ${incomeErr.message}`);
    }

    // Expenses
    const expenseRows = [];
    for (const budget of createdBudgets) {
      const subCat = expenseCategoryMap[budget.name];
      if (!subCat || budget.name === 'Savings') continue;

      const count = budget.name === 'Rent' ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        const base = Number(budget.budget_amount) / count;
        const variance = 0.85 + rand() * 0.4;
        const amount = Math.max(10, Math.round(base * variance));
        const day = 5 + Math.floor(rand() * 20);
        expenseRows.push({
          budget_id: budget.id,
          user_id: userId,
          amount,
          date: toISODate(
            new Date(month.start_date).getUTCFullYear(),
            new Date(month.start_date).getUTCMonth(),
            day
          ),
          description: `${budget.name} expense`,
          sub_category: subCat,
          bank: pick(paymentMethods),
          is_recurring: budget.name === 'Rent' || budget.name === 'Subscriptions',
          recurring_frequency: budget.name === 'Rent' ? 'Monthly' : null,
        });
      }
    }

    if (expenseRows.length > 0) {
      const { error: expenseErr } = await supabase.from('expenses').insert(expenseRows);
      if (expenseErr) {
        throw new Error(`Failed to create expenses for ${month.name}: ${expenseErr.message}`);
      }
    }
  }

  // Financial goals (savings)
  const goalStart = toISODate(now.getFullYear() - 1, now.getMonth(), 1);
  const goals = [
    {
      user_id: userId,
      name: 'Emergency Fund',
      target_amount: 10000,
      current_amount: 0,
      base_amount: 0,
      start_date: goalStart,
      end_date: toISODate(now.getFullYear(), now.getMonth() + 6, 1),
      status: 'In Progress',
      person: 'Joint',
      priority: 'High',
      goal_type: 'Short Term',
      description: '6 months of expenses',
    },
    {
      user_id: userId,
      name: 'Family Vacation',
      target_amount: 4000,
      current_amount: 0,
      base_amount: 0,
      start_date: goalStart,
      end_date: toISODate(now.getFullYear(), now.getMonth() + 4, 1),
      status: 'In Progress',
      person: 'Joint',
      priority: 'Medium',
      goal_type: 'Medium Term',
      description: 'Summer holiday',
    },
  ];

  const { data: createdGoals, error: goalErr } = await supabase
    .from('financial_goals')
    .insert(goals)
    .select();

  if (goalErr || !createdGoals) {
    throw new Error(`Failed to create financial goals: ${goalErr?.message || 'unknown error'}`);
  }

  // Goal contributions (monthly)
  const contributions = [];
  for (const month of createdMonths) {
    for (const goal of createdGoals) {
      const amount = goal.name === 'Emergency Fund' ? 150 : 100;
      contributions.push({
        financial_goal_id: goal.id,
        user_id: userId,
        monthly_overview_id: month.id,
        amount,
        date: month.start_date,
        description: `${goal.name} contribution`,
        bank: pick(paymentMethods),
        notes: 'Seeded contribution',
      });
    }
  }
  const { error: contribErr } = await supabase.from('goal_contributions').insert(contributions);
  if (contribErr) {
    throw new Error(`Failed to create goal contributions: ${contribErr.message}`);
  }

  // Subscriptions
  const today = new Date();
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 15);
  const subscriptions = [
    {
      user_id: userId,
      name: 'Netflix',
      amount: 15.99,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Joint',
      bank: 'Revolut',
      subscription_type: 'Streaming',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 6, 1),
      collection_day: 15,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 15),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 15),
      description: 'Family streaming',
    },
    {
      user_id: userId,
      name: 'Spotify',
      amount: 12.99,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Kene',
      bank: 'AIB',
      subscription_type: 'Streaming',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 8, 1),
      collection_day: 10,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 10),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 10),
      description: 'Music subscription',
    },
    {
      user_id: userId,
      name: 'Gym Membership',
      amount: 45,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Ify',
      bank: 'N26',
      subscription_type: 'Health',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 4, 1),
      collection_day: 5,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 5),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 5),
      description: 'Fitness membership',
    },
  ];

  const { error: subsErr } = await supabase.from('subscriptions').insert(subscriptions);
  if (subsErr) {
    throw new Error(`Failed to create subscriptions: ${subsErr.message}`);
  }

  // Loans + payments
  const { data: createdLoans, error: loanErr } = await supabase
    .from('loans')
    .insert([
      {
        user_id: userId,
        name: 'Car Loan',
        loan_type: 'Car Loan',
        original_amount: 12000,
        current_balance: 12000,
        interest_rate: 4.2,
        monthly_payment: 350,
        payment_frequency: 'Monthly',
        status: 'Active',
        person: 'Joint',
        bank: 'Bank of Ireland',
        lender_name: 'Local Bank',
        start_date: toISODate(now.getFullYear() - 1, now.getMonth() - 11, 1),
        payment_method: 'Revolut',
        description: 'Family car loan',
      },
      {
        user_id: userId,
        name: 'Credit Card',
        loan_type: 'Credit Card',
        original_amount: 3000,
        current_balance: 3000,
        interest_rate: 16.5,
        monthly_payment: 150,
        payment_frequency: 'Monthly',
        status: 'Active',
        person: 'Kene',
        bank: 'AIB',
        lender_name: 'AIB',
        start_date: toISODate(now.getFullYear() - 1, now.getMonth() - 6, 1),
        payment_method: 'AIB',
        description: 'Credit card balance',
      },
    ])
    .select();

  if (loanErr || !createdLoans) {
    throw new Error(`Failed to create loans: ${loanErr?.message || 'unknown error'}`);
  }

  const loanPayments = [];
  for (const month of months) {
    const payDate = toISODate(
      new Date(month.start_date).getUTCFullYear(),
      new Date(month.start_date).getUTCMonth(),
      20
    );
    loanPayments.push({
      loan_id: createdLoans[0].id,
      user_id: userId,
      payment_amount: 350,
      principal_amount: 280,
      interest_amount: 70,
      payment_date: payDate,
      payment_method: 'Revolut',
      notes: 'Seeded payment',
    });
  }
  const { error: loanPayErr } = await supabase.from('loan_payments').insert(loanPayments);
  if (loanPayErr) {
    throw new Error(`Failed to create loan payments: ${loanPayErr.message}`);
  }

  const summary = {
    userId,
    email,
    password,
    months: createdMonths.length,
    masterBudgets: masterBudgets.length,
    goals: createdGoals.length,
    subscriptions: subscriptions.length,
    loans: createdLoans.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
