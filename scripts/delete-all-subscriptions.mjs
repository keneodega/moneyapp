/**
 * Delete all subscriptions from the database.
 * 
 * WARNING: This will delete ALL subscriptions. Use with caution!
 * 
 * Usage: node scripts/delete-all-subscriptions.mjs [--confirm]
 * 
 * Requires --confirm flag to actually delete (safety measure)
 *
 * Requires env:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
    process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Get all subscriptions first
  const { data: subscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, name, user_id, status, amount, frequency, created_at')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError.message);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No subscriptions found. Nothing to delete.');
    return;
  }

  console.log(`\nFound ${subscriptions.length} subscription(s) to delete:\n`);
  subscriptions.forEach((sub, index) => {
    console.log(`${index + 1}. ${sub.name} (${sub.status}) - Created: ${sub.created_at}`);
  });

  if (!process.argv.includes('--confirm')) {
    console.log('\n⚠️  WARNING: This will delete ALL subscriptions!');
    console.log('To proceed, run with --confirm flag:');
    console.log('  node scripts/delete-all-subscriptions.mjs --confirm');
    return;
  }

  console.log('\n⚠️  Deleting all subscriptions...\n');

  // Delete all subscriptions
  const { error: deleteError } = await supabase
    .from('subscriptions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that's always true)

  if (deleteError) {
    console.error('Error deleting subscriptions:', deleteError.message);
    process.exit(1);
  }

  console.log(`✓ Successfully deleted ${subscriptions.length} subscription(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
