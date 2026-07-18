import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { buildFinancialContext } from '@/lib/ai/financial-context';
import { parseCommand } from '@/lib/ai/assistant';
import { validateBankType } from '@/lib/utils/payment-methods';

/**
 * Telegram webhook: turn a text message into an expense/income/debtor.
 *
 * This is the app's first server-side service-role surface reachable from the
 * public internet, so security is layered and deliberate:
 *
 *  1. Secret token — Telegram echoes the secret_token set on setWebhook in the
 *     X-Telegram-Bot-Api-Secret-Token header. Checked (constant-time) before the
 *     body is parsed. No secret, no entry.
 *  2. Chat-ID allowlist — only known chats are served. An unknown chat gets a
 *     bare 200 (not 403) so the endpoint neither retries nor advertises itself.
 *  3. user_id is pinned server-side from the chat ID, never read from the
 *     payload — the route is structurally incapable of writing to another user.
 *  4. The model returns a parsed intent, not database access. Hand-written code
 *     validates every UUID it returns actually belongs to this user before any
 *     insert; anything unrecognised is refused.
 *
 * Text only for now — receipt photos and /undo are later increments.
 */

// All allowlisted chats write to the one family account.
const FAMILY_USER_ID = '5b53d910-46ee-4873-8624-1e89bbd5a0e9';
const DEFAULT_BANK = 'Revolut Kene';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function reply(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // no bot configured (e.g. local test) — skip silently
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('telegram sendMessage failed:', err);
  }
}

const fmt = (n: number) => `€${n.toFixed(2)}`;

export async function POST(request: NextRequest) {
  // Layer 1: secret token, before touching the body.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!secret || !constantTimeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignore malformed
  }

  const chatId = update?.message?.chat?.id;
  const text = (update?.message?.text ?? '').trim();
  if (!chatId || !text) return NextResponse.json({ ok: true }); // non-text update — ignore

  // Layer 2: chat-ID allowlist. Unknown chat -> bare 200, no reply.
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(String(chatId))) {
    return NextResponse.json({ ok: true });
  }

  // Layer 3: pin the user server-side.
  const userId = FAMILY_USER_ID;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey || !process.env.ANTHROPIC_API_KEY) {
    await reply(chatId, 'The tracker is not fully configured yet. Try again later.');
    return NextResponse.json({ ok: true });
  }
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  if (text === '/start' || text === '/help') {
    await reply(chatId, 'Send me a spend and I\'ll log it. e.g. "€62 groceries at Tesco" or "spent 12.50 on parking". I can record expenses, income, and money you\'re owed.');
    return NextResponse.json({ ok: true });
  }

  try {
    const context = await buildFinancialContext(sb, userId);
    const parsed = await parseCommand(text, context);
    const action = parsed.action;

    if (!action) {
      // read-only / general question — just relay the model's answer
      await reply(chatId, parsed.message);
      return NextResponse.json({ ok: true });
    }

    if (action.amount <= 0 && action.type !== 'transfer') {
      await reply(chatId, `I couldn't work out an amount from that. ${parsed.message}`);
      return NextResponse.json({ ok: true });
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(action.date) ? action.date : new Date().toISOString().split('T')[0];

    if (action.type === 'expense') {
      // Layer 4: the budget UUID must exist AND belong to this user.
      const { data: budget } = await sb
        .from('budgets')
        .select('id, name, monthly_overview_id, monthly_overviews!inner(user_id)')
        .eq('id', action.target_id)
        .maybeSingle();
      const budgetUserId = (budget as unknown as { monthly_overviews?: { user_id?: string } })?.monthly_overviews?.user_id;
      if (!budget || budgetUserId !== userId) {
        await reply(chatId, `I couldn't match "${text}" to one of your budget categories. Try naming the category, e.g. "€20 Food".`);
        return NextResponse.json({ ok: true });
      }

      const { error } = await sb.from('expenses').insert({
        budget_id: budget.id,
        user_id: userId,
        amount: action.amount,
        date,
        description: action.description || parsed.action?.target_name || null,
        bank: action.bank ? (validateBankType(action.bank) ?? DEFAULT_BANK) : DEFAULT_BANK,
        is_recurring: false,
      });
      if (error) throw error;

      const over = parsed.warnings?.length ? `\n⚠️ ${parsed.warnings[0]}` : '';
      await reply(chatId, `✅ Logged ${fmt(action.amount)} to ${budget.name} (${date}).${over}`);
      return NextResponse.json({ ok: true });
    }

    if (action.type === 'income') {
      // target_id should be the current monthly overview; verify it's this user's.
      const { data: month } = await sb
        .from('monthly_overviews')
        .select('id, name, user_id')
        .eq('id', action.target_id)
        .maybeSingle();
      if (!month || month.user_id !== userId) {
        await reply(chatId, 'I couldn\'t find the month to add that income to. Open the app and check the current month exists.');
        return NextResponse.json({ ok: true });
      }
      const { error } = await sb.from('income_sources').insert({
        monthly_overview_id: month.id,
        user_id: userId,
        amount: action.amount,
        source: action.target_name || 'Other',
        date_paid: date,
        description: action.description || null,
        bank: action.bank ? (validateBankType(action.bank) ?? null) : null,
        tithe_deduction: false,
      });
      if (error) throw error;
      await reply(chatId, `✅ Logged income ${fmt(action.amount)} (${action.target_name || 'Other'}) to ${month.name}.`);
      return NextResponse.json({ ok: true });
    }

    if (action.type === 'debtor') {
      const { error } = await sb.from('debtors').insert({
        user_id: userId,
        debtor_name: action.target_name || 'Someone',
        amount_owed: action.amount,
        date_lent: date,
        status: 'Active',
        description: action.description || null,
      });
      if (error) throw error;
      await reply(chatId, `✅ Recorded: ${action.target_name || 'Someone'} owes you ${fmt(action.amount)}.`);
      return NextResponse.json({ ok: true });
    }

    // transfers not handled via Telegram yet
    await reply(chatId, 'Transfers aren\'t supported here yet — do that one in the app.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('telegram webhook error:', error);
    await reply(chatId, 'Something went wrong recording that. Try again, or use the app.');
    return NextResponse.json({ ok: true }); // 200 so Telegram doesn't hammer retries
  }
}
