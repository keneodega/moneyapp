/**
 * Diagnostic script to check subscriptions in the database.
 * Helps identify why imported subscriptions might not be visible.
 *
 * Usage: node scripts/check-subscriptions.mjs
 *
 * Requires env:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (bypasses RLS to see all subscriptions)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) {
    console.error(`.env.local not found at: ${p}`);
    console.error(`Current working directory: ${process.cwd()}`);
    return;
  }
  
  const buf = fs.readFileSync(p, 'utf-8');
  let loaded = 0;
  const loadedKeys = [];
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
    // Always set, even if already exists (allows override)
    process.env[key] = val;
    loaded++;
    loadedKeys.push(key);
  }
  console.log(`Loaded ${loaded} environment variables from .env.local: ${loadedKeys.join(', ')}`);
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('\nMissing required env variables:');
    console.error(`  NEXT_PUBLIC_SUPABASE_URL: ${url ? '✓' : '✗'}`);
    console.error(`  SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✓' : '✗'}`);
    console.error('\nMake sure these are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Get all subscriptions (bypassing RLS with service role)
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('id, name, user_id, status, amount, frequency, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscriptions:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${subscriptions?.length || 0} total subscriptions in database:\n`);

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No subscriptions found. They may not have been imported yet.');
    return;
  }

  // Group by user_id
  const byUserId = {};
  subscriptions.forEach(sub => {
    if (!byUserId[sub.user_id]) {
      byUserId[sub.user_id] = [];
    }
    byUserId[sub.user_id].push(sub);
  });

  console.log(`Subscriptions grouped by user_id:\n`);
  Object.keys(byUserId).forEach(userId => {
    const subs = byUserId[userId];
    console.log(`User ID: ${userId}`);
    console.log(`  Count: ${subs.length}`);
    console.log(`  Status breakdown:`);
    const statusCounts = {};
    subs.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });
    Object.keys(statusCounts).forEach(status => {
      console.log(`    ${status}: ${statusCounts[status]}`);
    });
    console.log(`  Recent subscriptions:`);
    subs.slice(0, 5).forEach(s => {
      console.log(`    - ${s.name} (${s.status}) - Created: ${s.created_at}`);
    });
    if (subs.length > 5) {
      console.log(`    ... and ${subs.length - 5} more`);
    }
    console.log('');
  });

  // Check if SUPABASE_IMPORT_USER_ID is set
  const importUserId = process.env.SUPABASE_IMPORT_USER_ID;
  if (importUserId) {
    console.log(`\nSUPABASE_IMPORT_USER_ID from env: ${importUserId}`);
    if (byUserId[importUserId]) {
      console.log(`✓ Found ${byUserId[importUserId].length} subscriptions for this user_id`);
    } else {
      console.log(`✗ No subscriptions found for this user_id`);
    }
  } else {
    console.log(`\n⚠ SUPABASE_IMPORT_USER_ID not set in .env.local`);
  }

  console.log(`\nTo see subscriptions in the app, make sure you're logged in with a user_id that matches one of the above.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
