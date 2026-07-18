/**
 * Import a Revolut CSV export into MoneyApp (Supabase).
 *
 * Revolut card spending is the source of truth for completeness — this pulls
 * every Card Payment / Card Refund, categorises by merchant, and writes them as
 * expenses. Internal Transfers, Top-ups and Exchanges are noise and excluded.
 *
 * Usage:
 *   node scripts/import-revolut.mjs <path-to-csv>            # dry-run (default) — writes nothing
 *   node scripts/import-revolut.mjs <path-to-csv> --commit   # actually insert
 *   node scripts/import-revolut.mjs <path-to-csv> --include-frozen   # allow writes into frozen months
 *
 * Dry-run reconciles the file against the DB and lists any merchants it can't
 * categorise. Resolve those in scripts/revolut-merchant-map.json, then re-run.
 *
 * Requires env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent: dedupes on (date, amount, description); a second run inserts nothing.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const USER_ID = '5b53d910-46ee-4873-8624-1e89bbd5a0e9'; // odgeakenechukwu@gmail.com
const DEFAULT_BANK = 'Revolut Kene';

// ---- env ----
function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ---- minimal RFC4180 CSV parser (handles quoted fields with commas) ----
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- normalise a merchant name (strip trailing ref numbers / punctuation) ----
function normaliseMerchant(desc) {
  return (desc || '').replace(/\s+/g, ' ').trim();
}

// ---- category lookup via ordered substring rules ----
function makeCategoriser(rules) {
  return (merchant) => {
    const m = merchant.toLowerCase();
    for (const [pat, cat] of rules) {
      if (m.includes(pat.toLowerCase())) return cat;
    }
    return null;
  };
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith('--'));
  const COMMIT = args.includes('--commit');
  const INCLUDE_FROZEN = args.includes('--include-frozen');

  if (!csvPath) { console.error('Usage: node scripts/import-revolut.mjs <csv> [--commit] [--include-frozen]'); process.exit(1); }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const mapPath = path.join(process.cwd(), 'scripts/revolut-merchant-map.json');
  const categorise = makeCategoriser(JSON.parse(fs.readFileSync(mapPath, 'utf-8')).rules);

  // --- load CSV ---
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const [cType, cCompleted, cDesc, cAmount, cState] =
    [col('Type'), col('Completed Date'), col('Description'), col('Amount'), col('State')];

  const spend = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < header.length) continue;
    const type = r[cType]?.trim();
    if (type !== 'Card Payment' && type !== 'Card Refund') continue; // exclude Transfer/Topup/Exchange
    if (r[cState]?.trim() !== 'COMPLETED') continue;
    const date = (r[cCompleted] || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const raw = Number(r[cAmount]);
    if (!Number.isFinite(raw)) continue;
    // Card Payment amounts are negative outflows -> positive expense.
    // Card Refund amounts are positive -> negative expense (reduces spend).
    const amount = -raw;
    spend.push({ date, amount: Math.round(amount * 100) / 100, merchant: normaliseMerchant(r[cDesc]), type });
  }

  // --- months ---
  const { data: months } = await sb.from('monthly_overviews').select('*').eq('user_id', USER_ID).order('start_date');
  const frozenNames = new Set(['February 2026','March 2026','April 2026','May 2026','June 2026']);
  const monthFor = (date) => months.find((m) => date >= m.start_date && date <= m.end_date) || null;

  // --- existing expenses for dedupe ---
  const budgetIds = [];
  const { data: allBudgets } = await sb.from('budgets').select('id, name, monthly_overview_id').in('monthly_overview_id', months.map((m) => m.id));
  const budgetById = Object.fromEntries(allBudgets.map((b) => [b.id, b]));
  allBudgets.forEach((b) => budgetIds.push(b.id));
  const { data: existing } = await sb.from('expenses').select('amount, date, description, budget_id').eq('user_id', USER_ID);
  const dedupeKey = (date, amount, desc) => `${date}|${amount.toFixed(2)}|${(desc || '').trim().toLowerCase()}`;
  const seen = new Set(existing.map((e) => dedupeKey(e.date, Number(e.amount), e.description)));

  // --- classify each spend row ---
  const buckets = { new: [], dupe: [], noMonth: [], frozen: [], unmapped: [] };
  for (const s of spend) {
    if (seen.has(dedupeKey(s.date, s.amount, s.merchant))) { buckets.dupe.push(s); continue; }
    const m = monthFor(s.date);
    if (!m) { buckets.noMonth.push(s); continue; }
    s.month = m;
    if (frozenNames.has(m.name) && !INCLUDE_FROZEN) { buckets.frozen.push(s); continue; }
    s.category = categorise(s.merchant);
    if (!s.category) { buckets.unmapped.push(s); continue; }
    buckets.new.push(s);
  }

  // --- report ---
  const eur = (n) => '€' + Number(n).toFixed(2);
  console.log(`\n=== Revolut import ${COMMIT ? '(COMMIT)' : '(dry-run)'} — ${path.basename(csvPath)} ===`);
  console.log(`Card Payments/Refunds in file : ${spend.length}`);
  console.log(`  already in DB (dedupe)      : ${buckets.dupe.length}`);
  console.log(`  outside any month range     : ${buckets.noMonth.length}`);
  console.log(`  in frozen months (skipped)  : ${buckets.frozen.length}${INCLUDE_FROZEN ? ' [--include-frozen: NOT skipped]' : ''}`);
  console.log(`  need a category (unmapped)  : ${buckets.unmapped.length}`);
  console.log(`  ready to import             : ${buckets.new.length}`);

  // per-month breakdown of importable
  const byMonth = {};
  for (const s of buckets.new) (byMonth[s.month.name] ||= { n: 0, sum: 0 }, byMonth[s.month.name].n++, byMonth[s.month.name].sum += s.amount);
  if (Object.keys(byMonth).length) {
    console.log('\n  importable by month:');
    for (const [name, v] of Object.entries(byMonth)) console.log(`    ${name.padEnd(15)} ${String(v.n).padStart(3)} rows  ${eur(v.sum)}`);
  }

  // unmapped merchants aggregated (the review queue)
  if (buckets.unmapped.length) {
    const agg = {};
    for (const s of buckets.unmapped) (agg[s.merchant] ||= { n: 0, sum: 0 }, agg[s.merchant].n++, agg[s.merchant].sum += s.amount);
    console.log('\n  UNMAPPED merchants — add to revolut-merchant-map.json (count · total):');
    for (const [mch, v] of Object.entries(agg).sort((a, b) => b[1].sum - a[1].sum))
      console.log(`    ${String(v.n).padStart(3)} · ${eur(v.sum).padStart(10)}  ${mch}`);
  }

  if (!COMMIT) {
    console.log('\nDry-run: nothing written. Re-run with --commit to insert the "ready to import" rows.');
    return;
  }

  // --- COMMIT: ensure a budget exists per (month, category), then insert ---
  const findOrCreateBudget = async (month, category) => {
    let b = allBudgets.find((x) => x.monthly_overview_id === month.id && x.name.trim().toLowerCase() === category.toLowerCase());
    if (b) return b.id;
    const { data: created, error } = await sb.from('budgets')
      .insert({ monthly_overview_id: month.id, name: category, budget_amount: 0, description: 'Auto-created by Revolut import (unplanned category)' })
      .select('id, name, monthly_overview_id').single();
    if (error) throw new Error(`create budget ${category}/${month.name}: ${error.message}`);
    allBudgets.push(created);
    return created.id;
  };

  let inserted = 0;
  for (const s of buckets.new) {
    const budgetId = await findOrCreateBudget(s.month, s.category);
    const { error } = await sb.from('expenses').insert({
      budget_id: budgetId, user_id: USER_ID, amount: s.amount, date: s.date,
      description: s.merchant, bank: DEFAULT_BANK, is_recurring: false,
    });
    if (error) { console.error(`  insert failed ${s.date} ${s.merchant}: ${error.message}`); continue; }
    inserted++;
  }
  console.log(`\nInserted ${inserted} expense(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
