/**
 * Month-level status for the "This month" hero.
 *
 * Budgets are funded by their planned amount plus transfers in (from other
 * budgets or goal drawdowns) minus transfers out. `amount_left` from the
 * `budget_summary` view already reflects this, so each budget's funding is
 * `amount_spent + amount_left`. Using the raw planned total instead makes the
 * hero report "over budget" for overspends that were already covered.
 */

export interface MonthStatusBudget {
  name: string;
  budget_amount: number | string | null;
  override_amount?: number | string | null;
  amount_spent: number | string | null;
  amount_left: number | string | null;
  master_budget?: { budget_amount: number | string | null } | null;
}

export interface MonthStatus {
  totalSpent: number;
  /** Planned budget amounts plus money moved in from goals (budget-to-budget transfers net out). */
  totalFunded: number;
  /** Net money moved in from outside the month's budgets, e.g. goal drawdowns. */
  movedIn: number;
  /** Positive = over budget after transfers. */
  overUnder: number;
  isOver: boolean;
  spentPercent: number;
  /** Categories still over budget after transfers, largest first. */
  uncovered: { name: string; amount: number }[];
  /** Categories whose budget this month is well above their usual (master) budget. */
  raisedBudgets: { name: string; over: number }[];
}

const num = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v ?? 0);
  return isNaN(n) ? 0 : n;
};

export function computeMonthStatus(budgets: MonthStatusBudget[], totalBudgeted: number): MonthStatus {
  let totalSpent = 0;
  let totalFunded = 0;
  const uncovered: { name: string; amount: number }[] = [];

  for (const b of budgets) {
    const spent = num(b.amount_spent);
    const left = num(b.amount_left);
    totalSpent += spent;
    totalFunded += spent + left;
    if (left < -0.005) uncovered.push({ name: b.name, amount: -left });
  }
  uncovered.sort((a, b) => b.amount - a.amount);

  const overUnder = totalSpent - totalFunded;
  const raisedBudgets = budgets
    .map((b) => {
      const budget = num(b.override_amount ?? b.budget_amount);
      const master = num(b.master_budget?.budget_amount);
      return { name: b.name, master, over: budget - master };
    })
    .filter((b) => b.over > 0.005 && (b.master <= 0 ? false : b.over / b.master >= 0.15))
    .sort((a, b) => b.over - a.over)
    .map(({ name, over }) => ({ name, over }));

  return {
    totalSpent,
    totalFunded,
    movedIn: totalFunded - totalBudgeted,
    overUnder,
    isOver: overUnder > 0.005,
    spentPercent: totalFunded > 0 ? (totalSpent / totalFunded) * 100 : 0,
    uncovered,
    raisedBudgets,
  };
}

const joinNames = (names: string[]) => names.join(' and ');

/** One-line summary under the hero figure. */
export function monthStatusSentence(status: MonthStatus): string {
  const u = status.uncovered.slice(0, 2).map((c) => c.name);
  if (u.length > 0) {
    const more = status.uncovered.length > 2 ? ` (+${status.uncovered.length - 2} more)` : '';
    return `${joinNames(u)}${more} ${u.length > 1 || more ? 'are' : 'is'} over budget and not covered yet.`;
  }
  const r = status.raisedBudgets.slice(0, 2).map((c) => c.name);
  if (r.length > 0) {
    return `All categories within budget. ${joinNames(r)} ${r.length > 1 ? 'budgets are' : 'budget is'} raised above usual this month.`;
  }
  return 'All categories within budget.';
}
