/**
 * Helper script to get your current user ID from Supabase.
 * This helps you find the correct SUPABASE_IMPORT_USER_ID.
 *
 * Usage: node scripts/get-user-id.mjs <your-email> <your-password>
 * 
 * Or run it interactively and it will prompt for credentials.
 *
 * Requires env:
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

  let email, password;

  if (process.argv[2] && process.argv[3]) {
    email = process.argv[2];
    password = process.argv[3];
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    email = await question(rl, 'Enter your email: ');
    password = await question(rl, 'Enter your password: ');
    rl.close();
  }

  console.log('\nSigning in...');

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('Authentication failed:', authError.message);
    process.exit(1);
  }

  if (!authData.user) {
    console.error('No user returned from authentication');
    process.exit(1);
  }

  console.log('\n✓ Successfully authenticated!');
  console.log('\nYour User ID:');
  console.log(authData.user.id);
  console.log('\nAdd this to your .env.local as:');
  console.log(`SUPABASE_IMPORT_USER_ID=${authData.user.id}`);
  console.log('\nYou can also find this in your Supabase dashboard:');
  console.log('  Authentication > Users > [Your Email] > UUID');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
