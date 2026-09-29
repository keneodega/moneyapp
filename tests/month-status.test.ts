import { describe, it, expect } from 'vitest';
import { computeMonthStatus, monthStatusSentence } from '@/lib/utils/month-status';

const b = (name: string, budget: number, spent: number, left: number, master = budget) => ({
  name,
  budget_amount: budget,
  amount_spent: spent,
  amount_left: left,
  master_budget: { budget_amount: master },
});

describe('computeMonthStatus', () => {
  it('treats an overspend covered by a goal drawdown as within budget', () => {
    // House Project: 4,995 planned, 8,650 spent, 3,655 drawn down from savings -> 0 left
    const budgets = [b('House Project', 4995, 8650, 0, 0), b('Food', 400, 300, 100)];
    const s = computeMonthStatus(budgets, 5395);
    expect(s.isOver).toBe(false);
    expect(s.overUnder).toBeCloseTo(-100);
    expect(s.movedIn).toBeCloseTo(3655);
    expect(s.uncovered).toEqual([]);
    expect(monthStatusSentence(s)).toBe('All categories within budget.');
  });

  it('nets out budget-to-budget transfers', () => {
    // 196 moved from Transport to Food
    const budgets = [b('Food', 400, 596, 0), b('Transport', 350, 100, 54)];
    const s = computeMonthStatus(budgets, 750);
    expect(s.movedIn).toBeCloseTo(0);
    expect(s.isOver).toBe(false);
  });

  it('reports uncovered overspends by name', () => {
    const budgets = [b('Food', 400, 596, -196), b('Misc', 100, 218.9, -118.9), b('Health', 50, 140.1, -90.1)];
    const s = computeMonthStatus(budgets, 550);
    expect(s.isOver).toBe(true);
    expect(s.overUnder).toBeCloseTo(405);
    expect(s.uncovered.map((u) => u.name)).toEqual(['Food', 'Misc', 'Health']);
    expect(monthStatusSentence(s)).toBe('Food and Misc (+1 more) are over budget and not covered yet.');
  });

  it('describes a raised budget without calling it overspent', () => {
    const s = computeMonthStatus([b('Therapy', 855, 0, 855, 316)], 855);
    expect(s.isOver).toBe(false);
    expect(monthStatusSentence(s)).toBe('All categories within budget. Therapy budget is raised above usual this month.');
  });

  it('handles an empty month', () => {
    const s = computeMonthStatus([], 0);
    expect(s.spentPercent).toBe(0);
    expect(s.isOver).toBe(false);
  });
});
