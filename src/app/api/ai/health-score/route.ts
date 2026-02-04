import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { FinancialHealthService } from '@/lib/services';
import type { AIHealthRecommendation } from '@/lib/supabase/database.types';

// Schema for AI recommendations
const RecommendationSchema = z.object({
  category: z.enum(['savings', 'debt', 'budget', 'general']).describe('The area this recommendation addresses'),
  priority: z.number().min(1).max(5).describe('Priority 1-5, where 1 is most urgent'),
  title: z.string().describe('Short title for the recommendation (max 8 words)'),
  description: z.string().describe('Detailed explanation of the recommendation (max 30 words)'),
  actionable_steps: z.array(z.string()).min(1).max(3).describe('2-3 specific action steps'),
  potential_impact: z.string().describe('Expected impact on the score (e.g., "Could improve score by 5-10 points")'),
});

const RecommendationsResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(3).max(4).describe('3-4 personalized recommendations'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const historyMode = searchParams.get('history') === 'true';

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const healthService = new FinancialHealthService(supabase);

    // History mode: return last 12 months of scores
    if (historyMode) {
      const scores = await healthService.getScoreHistory(12);

      if (scores.length === 0) {
        return NextResponse.json({
          scores: [],
          averageScore: null,
          bestMonth: null,
          worstMonth: null,
        });
      }

      const avgScore = Math.round(
        scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length
      );

      const sortedByScore = [...scores].sort((a, b) => b.overall_score - a.overall_score);

      return NextResponse.json({
        scores: scores.map(s => ({
          month: s.calculated_for_month,
          score: s.overall_score,
          label: s.score_label,
        })),
        averageScore: avgScore,
        bestMonth: {
          month: sortedByScore[0].calculated_for_month,
          score: sortedByScore[0].overall_score,
        },
        worstMonth: {
          month: sortedByScore[sortedByScore.length - 1].calculated_for_month,
          score: sortedByScore[sortedByScore.length - 1].overall_score,
        },
      });
    }

    // Calculate current score
    const now = new Date();
    const calculatedScore = await healthService.calculateScore(now);

    // Check if we can calculate a meaningful score
    if (calculatedScore.totalIncome === 0 && calculatedScore.budgetAdherence.rawValue === null) {
      return NextResponse.json({
        score: null,
        canCalculate: false,
        missingData: {
          hasIncome: false,
          hasBudgets: false,
          message: 'Add income and create budgets to calculate your financial health score.',
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // Build score to save
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Check for existing score
    const existingScore = await healthService.getScoreForMonth(now);
    const previousScores = await healthService.getScoreHistory(2);
    const previousScore = previousScores.find(
      s => s.calculated_for_month !== monthStr
    );

    // Determine trend
    let trend: 'up' | 'down' | 'stable' | undefined;
    if (previousScore) {
      const diff = calculatedScore.overallScore - previousScore.overall_score;
      if (diff > 2) trend = 'up';
      else if (diff < -2) trend = 'down';
      else trend = 'stable';
    }

    // Save the score
    const savedScore = await healthService.saveScore({
      monthly_overview_id: calculatedScore.monthlyOverviewId,
      overall_score: calculatedScore.overallScore,
      score_label: calculatedScore.scoreLabel,
      savings_rate_score: calculatedScore.savingsRate.score,
      debt_to_income_score: calculatedScore.debtToIncome.score,
      budget_adherence_score: calculatedScore.budgetAdherence.score,
      savings_rate: calculatedScore.savingsRate.rawValue,
      debt_to_income_ratio: calculatedScore.debtToIncome.rawValue,
      budget_adherence_rate: calculatedScore.budgetAdherence.rawValue,
      total_income: calculatedScore.totalIncome,
      total_spent: calculatedScore.totalSpent,
      total_debt_payments: calculatedScore.totalDebtPayments,
      calculated_for_month: monthStr,
      ai_recommendations: existingScore?.ai_recommendations || null,
      recommendations_generated_at: existingScore?.recommendations_generated_at || null,
    });

    // Generate AI recommendations if needed
    let recommendations = savedScore.ai_recommendations;

    if (
      process.env.OPENAI_API_KEY &&
      FinancialHealthService.shouldRegenerateRecommendations(savedScore)
    ) {
      try {
        const { object } = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: RecommendationsResponseSchema,
          prompt: `You are a personal finance advisor analyzing a user's Financial Health Score.

Current Score: ${calculatedScore.overallScore}/100 (${calculatedScore.scoreLabel})

Score Breakdown:
- Savings Rate: ${calculatedScore.savingsRate.score}/40 (${calculatedScore.savingsRate.rawValue !== null ? `${calculatedScore.savingsRate.rawValue}% of income saved` : 'No income data'})
- Debt-to-Income: ${calculatedScore.debtToIncome.score}/30 (${calculatedScore.debtToIncome.rawValue !== null ? `${calculatedScore.debtToIncome.rawValue}% of income goes to debt` : 'No debt data'})
- Budget Adherence: ${calculatedScore.budgetAdherence.score}/30 (${calculatedScore.budgetAdherence.rawValue !== null ? `${calculatedScore.budgetAdherence.rawValue}% of budgets on track` : 'No budget data'})

Financial Snapshot:
- Monthly Income: €${Math.round(calculatedScore.totalIncome)}
- Monthly Spending: €${Math.round(calculatedScore.totalSpent)}
- Monthly Debt Payments: €${Math.round(calculatedScore.totalDebtPayments)}

${previousScore ? `Previous Month Score: ${previousScore.overall_score}/100 (${trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable'})` : 'First month tracking'}

Generate 3-4 specific, actionable recommendations to improve this user's financial health score. Focus on the weakest areas first. Each recommendation should be practical and achievable within 1-3 months.

Guidelines:
- Use € currency, round to whole numbers
- Be specific with amounts and percentages
- Prioritize recommendations by impact (1 = highest priority)
- Focus on quick wins that can improve the score meaningfully
- Consider the user's current financial situation`,
        });

        recommendations = object.recommendations as AIHealthRecommendation[];

        // Save recommendations to the score
        await healthService.updateRecommendations(savedScore.id, recommendations);
      } catch (aiError) {
        console.error('AI recommendation generation error:', aiError);
        // Continue without recommendations
      }
    }

    return NextResponse.json({
      score: {
        ...savedScore,
        ai_recommendations: recommendations,
      },
      canCalculate: true,
      previousScore: previousScore?.overall_score,
      trend,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health score error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = process.env.NODE_ENV === 'development' ? errorMessage : 'Failed to calculate health score';
    return NextResponse.json(
      { error: errorDetails },
      { status: 500 }
    );
  }
}
