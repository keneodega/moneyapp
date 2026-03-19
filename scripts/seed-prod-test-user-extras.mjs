import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEST_USER_EMAIL) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or TEST_USER_EMAIL env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let seed = 1337;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

function toISODate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const paymentMethods = ['Revolut', 'AIB', 'N26', 'Wise', 'Bank of Ireland'];

async function main() {
  const { data: usersData, error: userErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (userErr || !usersData?.users) {
    throw new Error(`Failed to list users: ${userErr?.message || 'unknown error'}`);
  }

  const matchedUser = usersData.users.find((u) => u.email === TEST_USER_EMAIL);
  if (!matchedUser) {
    throw new Error(`Failed to find user by email: ${TEST_USER_EMAIL}`);
  }

  const userId = matchedUser.id;

  // Add more subscriptions
  const today = new Date();
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 12);
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 12);
  const subs = [
    {
      user_id: userId,
      name: 'Amazon Prime',
      amount: 8.99,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Joint',
      bank: 'Revolut',
      subscription_type: 'Membership',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 7, 1),
      collection_day: 12,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 12),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 12),
      description: 'Prime subscription',
    },
    {
      user_id: userId,
      name: 'iCloud+',
      amount: 2.99,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Kene',
      bank: 'AIB',
      subscription_type: 'Software',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 10, 1),
      collection_day: 3,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 3),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 3),
      description: 'Cloud storage',
    },
    {
      user_id: userId,
      name: 'YouTube Premium',
      amount: 11.99,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Ify',
      bank: 'N26',
      subscription_type: 'Streaming',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 5, 1),
      collection_day: 8,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 8),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 8),
      description: 'Video subscription',
    },
    {
      user_id: userId,
      name: 'Adobe Lightroom',
      amount: 12.09,
      frequency: 'Monthly',
      status: 'Active',
      person: 'Kene',
      bank: 'Wise',
      subscription_type: 'Software',
      start_date: toISODate(today.getFullYear() - 1, today.getMonth() - 3, 1),
      collection_day: 20,
      last_collection_date: toISODate(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 20),
      next_collection_date: toISODate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 20),
      description: 'Photo editing',
    },
  ];

  const { data: existingSubs } = await supabase
    .from('subscriptions')
    .select('name')
    .eq('user_id', userId);

  const existingNames = new Set((existingSubs || []).map((s) => s.name));
  const newSubs = subs.filter((s) => !existingNames.has(s.name));

  const { error: subsErr } = await supabase.from('subscriptions').insert(newSubs);
  if (subsErr) {
    throw new Error(`Failed to add subscriptions: ${subsErr.message}`);
  }

  // Fetch months
  const { data: months, error: monthsErr } = await supabase
    .from('monthly_overviews')
    .select('id, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(12);

  if (monthsErr || !months) {
    throw new Error(`Failed to load months: ${monthsErr?.message || 'unknown error'}`);
  }

  // Fetch goals
  const { data: goals } = await supabase
    .from('financial_goals')
    .select('id, name')
    .eq('user_id', userId);

  const emergencyGoal = goals?.find((g) => g.name === 'Emergency Fund') || goals?.[0];

  const transfers = [];
  for (let i = 0; i < months.length; i += 1) {
    const month = months[i];
    const start = new Date(month.start_date);
    const year = start.getUTCFullYear();
    const m = start.getUTCMonth();

    const { data: budgets, error: budgetsErr } = await supabase
      .from('budgets')
      .select('id, name')
      .eq('monthly_overview_id', month.id);

    if (budgetsErr || !budgets) {
      throw new Error(`Failed to load budgets for month ${month.id}: ${budgetsErr?.message || 'unknown error'}`);
    }

    const byName = Object.fromEntries(budgets.map((b) => [b.name, b.id]));
    const miscId = byName['Misc'];
    const groceriesId = byName['Groceries'];
    const diningId = byName['Dining Out'];

    if (miscId && groceriesId) {
      transfers.push({
        user_id: userId,
        monthly_overview_id: month.id,
        transfer_type: 'budget_to_budget',
        amount: Math.round(25 + rand() * 35),
        date: toISODate(year, m, 18),
        description: 'Top up groceries',
        notes: 'Seeded transfer',
        bank: pick(paymentMethods),
        from_budget_id: miscId,
        to_budget_id: groceriesId,
      });
    }

    if (diningId && groceriesId) {
      transfers.push({
        user_id: userId,
        monthly_overview_id: month.id,
        transfer_type: 'budget_to_budget',
        amount: Math.round(15 + rand() * 25),
        date: toISODate(year, m, 24),
        description: 'Rebalance food spend',
        notes: 'Seeded transfer',
        bank: pick(paymentMethods),
        from_budget_id: diningId,
        to_budget_id: groceriesId,
      });
    }

    if (emergencyGoal && i % 3 === 0) {
      transfers.push({
        user_id: userId,
        monthly_overview_id: month.id,
        transfer_type: 'goal_drawdown',
        amount: 120,
        date: toISODate(year, m, 22),
        description: 'Emergency fund drawdown',
        notes: 'Seeded goal transfer',
        bank: pick(paymentMethods),
        from_goal_id: emergencyGoal.id,
      });
    }
  }

  if (transfers.length > 0) {
    const { error: transferErr } = await supabase.from('transfers').insert(transfers);
    if (transferErr) {
      throw new Error(`Failed to add transfers: ${transferErr.message}`);
    }
  }

  console.log(JSON.stringify({
    userId,
    email: TEST_USER_EMAIL,
    addedSubscriptions: newSubs.length,
    addedTransfers: transfers.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
