/**
 * Merge "Havi Personal" and "Kene Personal" budgets into "Personal Care".
 *
 * For every monthly overview in the account:
 *   1. Finds budgets named "Havi Personal" / "Kene Personal" (case- and
 *      whitespace-insensitive) and the month's "Personal Care" budget.
 *   2. Moves all expenses from the source budgets to Personal Care.
 *   3. Re-points transfers (from_budget_id / to_budget_id) to Personal Care —
 *      transfers cascade-delete with their budget, so this must happen first
 *      or goal balances would silently lose history.
 *   4. Adds the source budgets' allocation to Personal Care's budget_amount.
 *   5. Deletes the now-empty source budgets.
 *
 * Dry-run by default — prints what would change. Pass --apply to execute.
 *
 * Usage:
 *   node scripts/merge-personal-budgets.mjs <email> <password> [--apply]
 *   node scripts/merge-personal-budgets.mjs <email> <password> --sources "Havi Personal,Kene Personal" --target "Personal Care" [--apply]
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

const normalize = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    positional: [],
    apply: false,
    sources: ['Havi Personal', 'Kene Personal'],
    target: 'Personal Care',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') out.apply = true;
    else if (args[i] === '--sources') out.sources = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (args[i] === '--target') out.target = args[++i];
    else out.positional.push(args[i]);
  }
  return out;
}

async function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exit(1);
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

  const { positional, apply, sources, target } = parseArgs();
  const sourceKeys = new Set(sources.map(normalize));
  const targetKey = normalize(target);

  let [email, password] = positional;
  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    email = email || (await question(rl, 'Enter your email: '));
    password = password || (await question(rl, 'Enter your password: '));
    rl.close();
  }

  const supabase = createClient(url, anonKey);

  console.log('\nSigning in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) await fail('Authentication failed:', authError);
  console.log(`✓ Authenticated as ${authData.user.email}`);
  console.log(`Mode: ${apply ? 'APPLY — changes will be written' : 'DRY RUN — no changes (pass --apply to execute)'}`);
  console.log(`Merging [${sources.join(', ')}] → "${target}"`);

  const { data: months, error: monthsError } = await supabase
    .from('monthly_overviews')
    .select('id, name, start_date')
    .order('start_date', { ascending: true });
  if (monthsError) await fail('Failed to fetch monthly overviews:', monthsError);

  let touchedMonths = 0;

  for (const month of months) {
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('id, name, budget_amount')
      .eq('monthly_overview_id', month.id);
    if (budgetsError) await fail(`Failed to fetch budgets for ${month.name}:`, budgetsError);

    const sourceBudgets = budgets.filter(b => sourceKeys.has(normalize(b.name)));
    if (sourceBudgets.length === 0) continue;

    touchedMonths++;
    console.log(`\n${month.name}`);

    let targetBudget = budgets.find(b => normalize(b.name) === targetKey);
    if (!targetBudget) {
      console.log(`  "${target}" budget missing — will create it`);
      if (apply) {
        const { data: created, error: createError } = await supabase
          .from('budgets')
          .insert({ monthly_overview_id: month.id, name: target, budget_amount: 0, description: 'Personal allowances' })
          .select('id, name, budget_amount')
          .single();
        if (createError) await fail(`Failed to create "${target}" in ${month.name}:`, createError);
        targetBudget = created;
      }
    }

    let movedAmount = 0;
    for (const src of sourceBudgets) {
      const [{ data: expenses, error: expError }, { data: transfersIn, error: tInError }, { data: transfersOut, error: tOutError }] = await Promise.all([
        supabase.from('expenses').select('id, amount').eq('budget_id', src.id),
        supabase.from('transfers').select('id').eq('to_budget_id', src.id),
        supabase.from('transfers').select('id').eq('from_budget_id', src.id),
      ]);
      if (expError) await fail(`Failed to fetch expenses for "${src.name}":`, expError);
      if (tInError || tOutError) await fail(`Failed to fetch transfers for "${src.name}":`, tInError || tOutError);

      const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
      console.log(`  "${src.name}" (allocation ${Number(src.budget_amount).toFixed(2)}): ${expenses.length} expense(s) totalling ${expenseTotal.toFixed(2)}, ${transfersIn.length + transfersOut.length} transfer(s)`);

      if (apply) {
        if (expenses.length > 0) {
          const { error } = await supabase.from('expenses').update({ budget_id: targetBudget.id }).eq('budget_id', src.id);
          if (error) await fail(`Failed to move expenses from "${src.name}":`, error);
        }
        if (transfersIn.length > 0) {
          const { error } = await supabase.from('transfers').update({ to_budget_id: targetBudget.id }).eq('to_budget_id', src.id);
          if (error) await fail(`Failed to re-point incoming transfers from "${src.name}":`, error);
        }
        if (transfersOut.length > 0) {
          const { error } = await supabase.from('transfers').update({ from_budget_id: targetBudget.id }).eq('from_budget_id', src.id);
          if (error) await fail(`Failed to re-point outgoing transfers from "${src.name}":`, error);
        }
      }
      movedAmount += Number(src.budget_amount);
    }

    if (apply) {
      const newAmount = Number(targetBudget.budget_amount) + movedAmount;
      const { error: amountError } = await supabase.from('budgets').update({ budget_amount: newAmount }).eq('id', targetBudget.id);
      if (amountError) await fail(`Failed to update "${target}" allocation:`, amountError);

      const { error: deleteError } = await supabase.from('budgets').delete().in('id', sourceBudgets.map(b => b.id));
      if (deleteError) await fail('Failed to delete merged budgets:', deleteError);

      console.log(`  ✓ Merged into "${target}" — allocation now ${newAmount.toFixed(2)}, source budgets deleted`);
    } else {
      const currentTarget = targetBudget ? Number(targetBudget.budget_amount) : 0;
      console.log(`  Would move everything into "${target}" and raise its allocation ${currentTarget.toFixed(2)} → ${(currentTarget + movedAmount).toFixed(2)}`);
    }
  }

  if (touchedMonths === 0) {
    console.log(`\nNo budgets matching [${sources.join(', ')}] found in any month — nothing to do.`);
  } else {
    console.log(`\n${apply ? 'Done' : 'Dry run complete'}: ${touchedMonths} month(s) ${apply ? 'updated' : 'would be updated'}.`);
    if (!apply) console.log('Re-run with --apply to make these changes.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
