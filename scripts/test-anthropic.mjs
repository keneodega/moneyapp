#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  if (!line || line.startsWith('#')) return;
  const i = line.indexOf('=');
  if (i === -1) return;
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (key) env[key] = val;
});

const apiKey = env.OPENAI_API_KEY;
console.log('OpenAI API Key found:', apiKey ? `${apiKey.slice(0, 20)}...` : 'NOT FOUND');

if (!apiKey) {
  console.error('OPENAI_API_KEY not found in .env.local');
  process.exit(1);
}

// Test the OpenAI API
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Say hello in one word' }],
  }),
});

const data = await response.json();
console.log('Response status:', response.status);
console.log('Response:', JSON.stringify(data, null, 2));
