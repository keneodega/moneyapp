/**
 * Clean Salesforce Subscription__c JSON for MoneyApp import.
 *
 * Usage: node scripts/clean-sf-subscriptions.mjs <path-to-raw-sf.json>
 *    or: npm run clean:subscriptions -- <path-to-raw-sf.json>
 *
 * Reads raw SF export, strips SF-only fields, maps to app schema, validates,
 * and writes subscriptions-cleaned.json plus subscriptions-cleaned-report.txt.
 */

import fs from 'fs';
import path from 'path';

const STRIP_KEYS = new Set([
  'attributes',
  'Id',
  'CreatedById',
  'CreatedDate',
  'LastModifiedById',
  'LastModifiedDate',
  'LastReferencedDate',
  'LastViewedDate',
  'LastActivityDate',
  'IsDeleted',
  'OwnerId',
  'SystemModstamp',
  'Current_Billing_Period_End_Date__c',
  'Ending_this_month__c',
  'Restart_Date__c',
  'GBP_Value__c',
]);

function toDateOnly(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapFrequency(v) {
  const s = String(v ?? '').trim();
  if (['Monthly', 'Annually', 'Quarterly', 'Weekly', 'Bi-Weekly', 'Bi-Annually', 'One-Time'].includes(s)) return s;
  return 'Monthly';
}

function mapStatus(v) {
  const s = String(v ?? '').trim();
  if (s === 'Active') return 'Active';
  if (s === 'Paused') return 'Paused';
  if (s === 'Deactivated') return 'Ended';
  if (s === 'Cancelled' || s === 'Ended') return s;
  return 'Active';
}

function mapCollectionDay(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 31) return null;
  return Math.round(n);
}

function str(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function cleanOne(raw) {
  const name = str(raw['Name']) ?? '';
  const amountVal = raw['Amount__c'];
  const amount = typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal ?? NaN));
  if (name === '') {
    return { row: null, skip: { name: String(raw['Name'] ?? raw['Id'] ?? '?'), reason: 'name is empty' } };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { row: null, skip: { name, reason: `amount invalid or <= 0 (${amountVal})` } };
  }

  const toBeExpensed = raw['To_be_Expensed__c'];
  let is_essential = true;
  if (typeof toBeExpensed === 'boolean') is_essential = toBeExpensed;
  else if (toBeExpensed === true || String(toBeExpensed).toLowerCase() === 'true') is_essential = true;
  else if (toBeExpensed === false || String(toBeExpensed).toLowerCase() === 'false') is_essential = false;

  const paid = raw['Paid_This_Month__c'];
  let paid_this_period = false;
  if (typeof paid === 'boolean') paid_this_period = paid;
  else if (paid === true || String(paid).toLowerCase() === 'true') paid_this_period = true;

  const row = {
    name,
    amount: Math.round(amount * 100) / 100,
    frequency: mapFrequency(raw['Frequency__c']),
    status: mapStatus(raw['Status__c']),
    person: str(raw['Person__c']),
    bank: str(raw['Bank__c']),
    subscription_type: str(raw['Subscription_Type__c']),
    is_essential,
    start_date: toDateOnly(raw['Start_Date__c']),
    end_date: toDateOnly(raw['End_Date__c']),
    collection_day: mapCollectionDay(raw['Collection_Day__c']),
    last_collection_date: toDateOnly(raw['Last_Collection_Date__c']),
    next_collection_date: toDateOnly(raw['Next_Collection_Date__c']),
    paid_this_period,
    description: str(raw['Description__c']),
  };
  return { row, skip: null };
}

function stripAndMap(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (STRIP_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/clean-sf-subscriptions.mjs <path-to-raw-sf.json>');
    console.error('   or: npm run clean:subscriptions -- <path-to-raw-sf.json>');
    process.exit(1);
  }

  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  let arr;
  try {
    const buf = fs.readFileSync(resolved, 'utf-8');
    const parsed = JSON.parse(buf);
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error('Failed to read or parse JSON:', e);
    process.exit(1);
  }

  const skipped = [];
  const cleaned = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item == null || typeof item !== 'object') {
      skipped.push({ name: `[index ${i}]`, reason: 'not an object' });
      continue;
    }
    const obj = item;
    if (obj['IsDeleted'] === true) continue;

    const stripped = stripAndMap(obj);
    const { row, skip } = cleanOne(stripped);
    if (skip) {
      skipped.push(skip);
      continue;
    }
    if (row) cleaned.push(row);
  }

  const outDir = path.dirname(resolved);
  const cleanedPath = path.join(outDir, 'subscriptions-cleaned.json');
  const reportPath = path.join(outDir, 'subscriptions-cleaned-report.txt');

  fs.writeFileSync(cleanedPath, JSON.stringify(cleaned, null, 2), 'utf-8');

  const reportLines = [
    `Clean run: ${new Date().toISOString()}`,
    `Input: ${resolved}`,
    `Output: ${cleanedPath}`,
    `Total input rows: ${arr.length}`,
    `Cleaned (will import): ${cleaned.length}`,
    `Skipped: ${skipped.length}`,
  ];
  if (skipped.length > 0) {
    reportLines.push('');
    reportLines.push('Skipped rows:');
    for (const s of skipped) {
      reportLines.push(`  - ${s.name}: ${s.reason}`);
    }
  }
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');

  console.log(`Wrote ${cleaned.length} rows to ${cleanedPath}`);
  console.log(`Report: ${reportPath}`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} rows; see report.`);
  }
}

main();
