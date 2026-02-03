import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// Schema for the AI response
const CategorizationSchema = z.object({
  suggestedCategory: z.string().describe('The most appropriate budget category name'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How confident the AI is in this categorization'),
  reasoning: z.string().describe('Brief explanation for the categorization'),
});

export async function POST(request: NextRequest) {
  try {
    const { description, availableCategories } = await request.json();

    if (!description || !availableCategories?.length) {
      return NextResponse.json(
        { error: 'Description and availableCategories are required' },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: CategorizationSchema,
      prompt: `You are a personal finance assistant helping categorize expenses.

Given the following expense description, suggest the most appropriate budget category from the available options.

Expense description: "${description}"

Available budget categories:
${availableCategories.map((c: string) => `- ${c}`).join('\n')}

Choose the single most appropriate category. Consider:
- "Food" for groceries, restaurants, takeaway, coffee shops
- "Transport" for fuel, parking, tolls, public transport, taxis, Uber
- "Housing" for rent, utilities, electricity, gas, water, internet
- "Health" for medicine, pharmacy, doctor visits, gym
- "Personal Care" for clothing, haircuts, beauty, personal items
- "Household" for cleaning supplies, furniture, home maintenance
- "Subscriptions" for streaming services, software subscriptions
- "Travel" for hotels, flights, vacation expenses
- "Miscellaneous" for anything that doesn't fit other categories

Be practical and match common expense patterns.`,
    });

    return NextResponse.json({
      category: object.suggestedCategory,
      confidence: object.confidence,
      reasoning: object.reasoning,
    });
  } catch (error) {
    console.error('AI categorization error:', error);
    return NextResponse.json(
      { error: 'Failed to categorize expense' },
      { status: 500 }
    );
  }
}
