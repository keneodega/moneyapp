/**
 * Import cleaned subscriptions JSON into MoneyApp (Supabase).
 *
 * Usage: node scripts/import-subscriptions.mjs <path-to-subscriptions-cleaned.json>
 *    or: npm run import:subscriptions -- <path-to-subscriptions-cleaned.json>
 *
 * Requires env:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (bypasses RLS; use only for import)
 *   - SUPABASE_IMPORT_USER_ID (target user UUID)
 *
 * Loads .env.local from project root if present.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

function computeNextCollectionDate(frequency, collectionDay, startDate) {
  const today = new Date();
  let next = startDate ? new Date(startDate) : new Date();

  const advance = () => {
    switch (frequency) {
      case 'Weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'Bi-Weekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'Monthly':
        next.setMonth(next.getMonth() + 1);
        if (collectionDay != null) {
          const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
          next.setDate(Math.min(collectionDay, last));
        }
        break;
      case 'Quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'Bi-Annually':
        next.setMonth(next.getMonth() + 6);
        break;
      case 'Annually':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        break;
    }
  };

  advance();
  while (next < today) advance();
  return next.toISOString().slice(0, 10);
}

async function main() {
  loadEnvLocal();

  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/import-subscriptions.mjs <path-to-subscriptions-cleaned.json>');
    console.error('   or: npm run import:subscriptions -- <path-to-subscriptions-cleaned.json>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.SUPABASE_IMPORT_USER_ID;

  if (!url || !serviceKey || !userId) {
    console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_IMPORT_USER_ID');
    process.exit(1);
  }

  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  let rows;
  try {
    const buf = fs.readFileSync(resolved, 'utf-8');
    rows = JSON.parse(buf);
  } catch (e) {
    console.error('Failed to read or parse JSON:', e);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('No subscriptions to import.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  let created = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const next = r.next_collection_date ?? computeNextCollectionDate(
      r.frequency,
      r.collection_day ?? null,
      r.start_date ?? null
    );

    const row = {
      user_id: userId,
      name: r.name,
      amount: r.amount,
      frequency: r.frequency,
      status: r.status ?? 'Active',
      person: r.person ?? null,
      bank: r.bank ?? null,
      subscription_type: r.subscription_type ?? null,
      is_essential: r.is_essential ?? true,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      collection_day: r.collection_day ?? null,
      last_collection_date: r.last_collection_date ?? null,
      next_collection_date: next,
      paid_this_period: r.paid_this_period ?? false,
      description: r.description ?? null,
    };

    const { error } = await supabase.from('subscriptions').insert(row);

    if (error) {
      errors.push({ name: r.name, message: error.message });
      continue;
    }
    created++;
  }

  console.log(`Imported ${created} / ${rows.length} subscriptions.`);
  if (errors.length > 0) {
    console.error('Errors:');
    errors.forEach((e) => console.error(`  - ${e.name}: ${e.message}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
