/**
 * Receipt photo parsing.
 *
 * Takes a photo of a receipt and pulls out what's needed to record one expense:
 * the total, the merchant, the date, and the closest budget category. Deliberately
 * ignores line items — the total is the only figure we record, and it's the figure
 * OCR gets right most reliably.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { AssistantContext } from './assistant';

const MODEL = 'claude-haiku-4-5-20251001';

export const ReceiptSchema = z.object({
  is_receipt: z.boolean().describe('True if the image is a receipt, invoice, or proof of payment. False for anything else.'),
  merchant: z.string().describe('The shop or business name as printed, or empty string if unreadable'),
  total_amount: z.number().describe('The TOTAL amount paid in euros (the final total, not a subtotal or an individual item). 0 if unreadable.'),
  date: z.string().describe('The date on the receipt in YYYY-MM-DD format, or empty string if not visible'),
  budget_id: z.string().describe('The UUID of the closest matching budget category from the provided list, or empty string if none fit'),
  budget_name: z.string().describe('The display name of that budget category, or empty string'),
  confidence: z.number().describe('Confidence in the extracted total and category, 0-1. Below 0.5 means the image was hard to read.'),
  note: z.string().describe('A short human explanation if something is unclear or could not be read. Empty string if all is well.'),
});

export interface ReceiptResult {
  isReceipt: boolean;
  merchant: string;
  amount: number;
  date: string;
  budgetId: string;
  budgetName: string;
  confidence: number;
  note: string;
}

/**
 * Read a receipt image and match it to one of the user's budget categories.
 *
 * @param image Raw image bytes as sent by Telegram
 * @param context The user's current-month financial context (for category matching)
 * @param caption Optional caption the user typed with the photo — a strong hint
 */
export async function parseReceipt(
  image: Uint8Array,
  context: AssistantContext,
  caption?: string
): Promise<ReceiptResult> {
  const today = context.currentDate || new Date().toISOString().split('T')[0];

  const prompt = `You are reading a photo of a receipt for a personal budgeting app. Extract only what is needed to record ONE expense.

TODAY'S DATE: ${today}

AVAILABLE BUDGET CATEGORIES (match the receipt to the closest one and return its UUID):
${context.budgets?.map((b) => `- "${b.name}" (ID: ${b.id})`).join('\n') || 'No categories available'}
${caption ? `\nThe user added this note with the photo, treat it as a strong hint: "${caption}"` : ''}

RULES:
1. total_amount must be the FINAL TOTAL PAID, not a subtotal, not a single line item, not change given. If the receipt shows a card payment amount, prefer that.
2. Amounts are in euros. Strip any currency symbol.
3. If the date is not printed or unreadable, return empty string — do not guess.
4. Match the merchant to the closest budget category by what the shop sells: a supermarket or restaurant is Food, a fuel station or parking is Transport, a pharmacy is Health, and so on. If nothing fits well, return empty budget_id.
5. If the image is not a receipt at all, set is_receipt false and leave the other fields empty/0.
6. Set confidence below 0.5 if the image is blurry, cropped, or the total is ambiguous.`;

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: ReceiptSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image },
        ],
      },
    ],
  });

  return {
    isReceipt: object.is_receipt,
    merchant: object.merchant.trim(),
    amount: object.total_amount,
    date: /^\d{4}-\d{2}-\d{2}$/.test(object.date) ? object.date : '',
    budgetId: object.budget_id.trim(),
    budgetName: object.budget_name.trim(),
    confidence: object.confidence,
    note: object.note.trim(),
  };
}
