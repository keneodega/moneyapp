/**
 * Diagnose and (optionally) fix a financial goal's current_amount.
 *
 * Background:
 *   current_amount is a DERIVED value = base_amount + contributions - drawdowns.
 *   An old bug folded the contributions into base_amount on every save, so some
 *   goals have an inflated base_amount (and therefore an inflated current_amount).
 *   This script shows the exact breakdown and can reset base_amount so the derived
 *   current_amount matches a correct target value.
 *
 * Usage:
 *   # 1) Diagnose ALL goals (read-only, default):
 *   node scripts/recalc-goal.mjs <email> <password>
 *
 *   # 2) Diagnose a single goal by name (read-only):
 *   node scripts/recalc-goal.mjs <email> <password> --goal "Maternity Fund"
 *
 *   # 3) Fix a goal so its Current Amount becomes <target>:
 *   node scripts/recalc-goal.mjs <email> <password> --goal "Maternity Fund" --set-current 5000 --apply
 *
 *   # 4) Fix a goal to "contributions only" (base_amount = 0):
 *   node scripts/recalc-goal.mjs <email> <password> --goal "Maternity Fund" --reset-base --apply
 *
 * Notes:
 *   - Without --apply the script only prints what it WOULD do (dry run).
 *   - --set-current X sets base_amount = max(0, X - contributions + drawdowns),
 *     mirroring the fixed app logic, so the goal ends up showing exactly X.
 *   - --reset-base sets base_amount = 0, so the goal shows contributions - drawdowns.
 *
 * Requires env (from .env.local):
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
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function parseArgs(argv) {
  const opts = { positional: [], apply: false, resetBase: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--reset-base') opts.resetBase = true;
    else if (a === '--goal') opts.goal = argv[++i];
    else if (a === '--set-current') opts.setCurrent = parseFloat(argv[++i]);
    else opts.positional.push(a);
  }
  return opts;
}

const sum = (rows, field) =>
  (rows || []).reduce((s, r) => s + Number(r[field] || 0), 0);

const fmt = (n) => Number(n).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('Make sure these are set in .env.local');
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));

  let email = opts.positional[0];
  let password = opts.positional[1];

  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!email) email = await question(rl, 'Enter your email: ');
    if (!password) password = await question(rl, 'Enter your password: ');
    rl.close();
  }

  const supabase = createClient(url, anonKey);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData?.user) {
    console.error('Authentication failed:', authError?.message || 'no user');
    process.exit(1);
  }
  console.log(`\n✓ Signed in as ${email}\n`);

  // Fetch goals (optionally filtered by name)
  let goalsQuery = supabase.from('financial_goals').select('*').order('created_at', { ascending: true });
  if (opts.goal) goalsQuery = goalsQuery.eq('name', opts.goal);
  const { data: goals, error: goalsError } = await goalsQuery;

  if (goalsError) {
    console.error('Failed to fetch goals:', goalsError.message);
    process.exit(1);
  }
  if (!goals || goals.length === 0) {
    console.error(opts.goal ? `No goal found named "${opts.goal}"` : 'No goals found.');
    process.exit(1);
  }

  const applying = opts.apply && (opts.setCurrent !== undefined || opts.resetBase);

  for (const goal of goals) {
    const { data: contributions } = await supabase
      .from('goal_contributions')
      .select('amount')
      .eq('financial_goal_id', goal.id);
    const { data: drawdowns } = await supabase
      .from('goal_drawdowns')
      .select('amount')
      .eq('financial_goal_id', goal.id);

    const totalContrib = sum(contributions, 'amount');
    const totalDraw = sum(drawdowns, 'amount');
    const storedBase = goal.base_amount === null || goal.base_amount === undefined ? null : Number(goal.base_amount);
    const storedCurrent = Number(goal.current_amount || 0);

    // What the derived value SHOULD be given the stored base_amount
    const derivedFromBase = (storedBase ?? 0) + totalContrib - totalDraw;

    console.log('────────────────────────────────────────────────────────');
    console.log(`Goal: ${goal.name}  (id: ${goal.id})`);
    console.log(`  stored current_amount : €${fmt(storedCurrent)}`);
    console.log(`  stored base_amount    : ${storedBase === null ? '(column null)' : '€' + fmt(storedBase)}`);
    console.log(`  contributions (count) : €${fmt(totalContrib)}  (${(contributions || []).length} rows)`);
    console.log(`  drawdowns (count)     : €${fmt(totalDraw)}  (${(drawdowns || []).length} rows)`);
    console.log(`  derived (base+contrib-draw): €${fmt(derivedFromBase)}`);

    if (Math.abs(derivedFromBase - storedCurrent) > 0.005) {
      console.log(`  ⚠️  stored current_amount does NOT match the derived value.`);
    }

    if (opts.setCurrent === undefined && !opts.resetBase) {
      // Diagnose-only: suggest the "contributions only" value
      console.log(`  → If base_amount should be 0, the correct Current would be €${fmt(totalContrib - totalDraw)}.`);
      continue;
    }

    // Compute the new base_amount
    let newBase;
    let targetCurrent;
    if (opts.resetBase) {
      newBase = 0;
      targetCurrent = totalContrib - totalDraw;
    } else {
      targetCurrent = opts.setCurrent;
      newBase = Math.max(0, opts.setCurrent - totalContrib + totalDraw);
    }
    const resultingCurrent = newBase + totalContrib - totalDraw;

    console.log(`  PLAN: set base_amount = €${fmt(newBase)}  →  Current becomes €${fmt(resultingCurrent)} (target €${fmt(targetCurrent)})`);
    if (Math.abs(resultingCurrent - targetCurrent) > 0.005) {
      console.log(`  ⚠️  Target €${fmt(targetCurrent)} is below logged contributions (€${fmt(totalContrib - totalDraw)}).`);
      console.log(`      base_amount clamped to 0; to go lower you must delete/adjust contribution rows.`);
    }

    if (!applying) {
      console.log('  (dry run — re-run with --apply to write this change)');
      continue;
    }

    const { error: updateError } = await supabase
      .from('financial_goals')
      .update({ base_amount: newBase, current_amount: resultingCurrent })
      .eq('id', goal.id);

    if (updateError) {
      console.log(`  ✗ Update failed: ${updateError.message}`);
    } else {
      console.log(`  ✓ Updated. Current is now €${fmt(resultingCurrent)}.`);
    }
  }

  console.log('────────────────────────────────────────────────────────');
  if (!applying && (opts.setCurrent !== undefined || opts.resetBase)) {
    console.log('Dry run complete. Add --apply to write the change(s).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
