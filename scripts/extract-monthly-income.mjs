/**
 * Extract all income sources grouped by month for an account.
 *
 * Signs in as the given user (RLS scopes every query to that account),
 * fetches all monthly overviews and their income sources, prints a
 * per-month breakdown with totals, and optionally writes JSON/CSV files.
 *
 * Usage:
 *   node scripts/extract-monthly-income.mjs <email> <password> [--json out.json] [--csv out.csv]
 *
 * Or run it interactively and it will prompt for credentials.
 *
 * Requires env (read from .env.local if present):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const buf = fs.readFileSync(p, 'utf-8');
  for (const line of buf.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { positional: [], json: null, csv: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') out.json = args[++i];
    else if (args[i] === '--csv') out.csv = args[++i];
    else out.positional.push(args[i]);
  }
  return out;
}

function toCsv(rows) {
  const headers = ['month', 'start_date', 'end_date', 'date_paid', 'source', 'person', 'bank', 'amount', 'tithe_deduction', 'description'];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('Make sure these are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);
  const { positional, json, csv } = parseArgs();

  let [email, password] = positional;
  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    email = email || (await question(rl, 'Enter your email: '));
    password = password || (await question(rl, 'Enter your password: '));
    rl.close();
  }

  console.log('\nSigning in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Authentication failed:', authError.message);
    process.exit(1);
  }
  console.log(`✓ Authenticated as ${authData.user.email} (${authData.user.id})`);

  const { data: months, error: monthsError } = await supabase
    .from('monthly_overviews')
    .select('id, name, start_date, end_date')
    .order('start_date', { ascending: true });
  if (monthsError) {
    console.error('Failed to fetch monthly overviews:', monthsError.message);
    process.exit(1);
  }

  const { data: incomes, error: incomesError } = await supabase
    .from('income_sources')
    .select('id, monthly_overview_id, amount, source, person, bank, date_paid, tithe_deduction, description')
    .order('date_paid', { ascending: true });
  if (incomesError) {
    console.error('Failed to fetch income sources:', incomesError.message);
    process.exit(1);
  }

  const byMonth = new Map(months.map(m => [m.id, { ...m, incomes: [] }]));
  const orphans = [];
  for (const inc of incomes) {
    const month = byMonth.get(inc.monthly_overview_id);
    if (month) month.incomes.push(inc);
    else orphans.push(inc);
  }

  const flatRows = [];
  let grandTotal = 0;

  console.log('\n================ INCOME BY MONTH ================');
  for (const month of byMonth.values()) {
    const total = month.incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    grandTotal += total;
    console.log(`\n${month.name} (${month.start_date} → ${month.end_date})`);
    if (month.incomes.length === 0) {
      console.log('  (no income recorded)');
    }
    for (const inc of month.incomes) {
      const parts = [inc.date_paid, inc.source, inc.person, inc.bank, Number(inc.amount).toFixed(2), inc.description]
        .filter(v => v !== null && v !== undefined && v !== '');
      console.log(`  - ${parts.join(' | ')}`);
      flatRows.push({
        month: month.name,
        start_date: month.start_date,
        end_date: month.end_date,
        date_paid: inc.date_paid,
        source: inc.source,
        person: inc.person,
        bank: inc.bank,
        amount: Number(inc.amount),
        tithe_deduction: inc.tithe_deduction,
        description: inc.description,
      });
    }
    console.log(`  Total: ${total.toFixed(2)} (${month.incomes.length} income${month.incomes.length === 1 ? '' : 's'})`);
  }

  if (orphans.length > 0) {
    console.log(`\n⚠ ${orphans.length} income(s) reference a monthly overview that was not returned:`);
    for (const inc of orphans) {
      console.log(`  - ${inc.date_paid} | ${inc.source} | ${Number(inc.amount).toFixed(2)} (month id: ${inc.monthly_overview_id})`);
    }
  }

  console.log('\n=================================================');
  console.log(`Months: ${months.length} | Incomes: ${incomes.length} | Grand total: ${grandTotal.toFixed(2)}`);

  if (json) {
    const payload = [...byMonth.values()].map(m => ({
      month: m.name,
      start_date: m.start_date,
      end_date: m.end_date,
      total_income: m.incomes.reduce((s, i) => s + Number(i.amount), 0),
      incomes: m.incomes,
    }));
    fs.writeFileSync(json, JSON.stringify(payload, null, 2));
    console.log(`✓ Wrote JSON to ${json}`);
  }
  if (csv) {
    fs.writeFileSync(csv, toCsv(flatRows));
    console.log(`✓ Wrote CSV to ${csv}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
