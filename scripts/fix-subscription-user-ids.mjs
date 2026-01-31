/**
 * Fix subscription user_ids - updates subscriptions to use the correct user_id.
 * 
 * This script helps when subscriptions were imported with the wrong user_id.
 * It will:
 * 1. Show all subscriptions and their current user_ids
 * 2. Update subscriptions to the correct user_id (from SUPABASE_IMPORT_USER_ID)
 * 
 * Usage: node scripts/fix-subscription-user-ids.mjs [--dry-run]
 * 
 * Use --dry-run to see what would be changed without actually updating.
 *
 * Requires env:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 *   - SUPABASE_IMPORT_USER_ID (target user UUID)
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
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const targetUserId = process.env.SUPABASE_IMPORT_USER_ID;

  if (!url || !serviceKey) {
    console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('Add these to your .env.local file');
    process.exit(1);
  }

  if (!targetUserId) {
    console.error('Missing required env: SUPABASE_IMPORT_USER_ID');
    console.error('Add this to your .env.local file with your user UUID');
    console.error('You can get your user ID by running: node scripts/get-user-id.mjs');
    process.exit(1);
  }

  const isDryRun = process.argv.includes('--dry-run');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log(`\n${isDryRun ? '🔍 DRY RUN MODE - No changes will be made\n' : '🔧 UPDATE MODE - Changes will be applied\n'}`);
  console.log(`Target User ID: ${targetUserId}\n`);

  // Get all subscriptions
  const { data: subscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, name, user_id, status, amount, frequency, created_at')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError.message);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No subscriptions found in database.');
    console.log('You may need to import them first using: npm run import:subscriptions');
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

  console.log(`Found ${subscriptions.length} total subscriptions:\n`);
  Object.keys(byUserId).forEach(userId => {
    const subs = byUserId[userId];
    const isTarget = userId === targetUserId;
    console.log(`User ID: ${userId} ${isTarget ? '✓ (TARGET)' : '✗ (WRONG)'}`);
    console.log(`  Count: ${subs.length}`);
    console.log(`  Status breakdown:`);
    const statusCounts = {};
    subs.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });
    Object.keys(statusCounts).forEach(status => {
      console.log(`    ${status}: ${statusCounts[status]}`);
    });
    console.log('');
  });

  // Find subscriptions that need updating
  const toUpdate = subscriptions.filter(sub => sub.user_id !== targetUserId);

  if (toUpdate.length === 0) {
    console.log('✓ All subscriptions already have the correct user_id!');
    return;
  }

  console.log(`\n${toUpdate.length} subscription(s) need to be updated:\n`);
  toUpdate.forEach(sub => {
    console.log(`  - ${sub.name} (${sub.status}) - Current user_id: ${sub.user_id}`);
  });

  if (isDryRun) {
    console.log('\n🔍 DRY RUN: Would update the above subscriptions to user_id:', targetUserId);
    console.log('Run without --dry-run to apply changes.');
    return;
  }

  // Confirm update
  console.log(`\n⚠️  About to update ${toUpdate.length} subscription(s) to user_id: ${targetUserId}`);
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Update subscriptions
  let updated = 0;
  const errors = [];

  for (const sub of toUpdate) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ user_id: targetUserId })
      .eq('id', sub.id);

    if (error) {
      errors.push({ name: sub.name, id: sub.id, message: error.message });
    } else {
      updated++;
    }
  }

  console.log(`\n✓ Updated ${updated} / ${toUpdate.length} subscriptions`);
  
  if (errors.length > 0) {
    console.error('\nErrors:');
    errors.forEach(e => {
      console.error(`  - ${e.name} (${e.id}): ${e.message}`);
    });
    process.exitCode = 1;
  } else {
    console.log('\n✓ All subscriptions updated successfully!');
    console.log('You should now be able to see them in the subscriptions page.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
