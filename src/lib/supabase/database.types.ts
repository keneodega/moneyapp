/**
 * Family Money Tracker - Database Types
 * Auto-generated types for Supabase tables
 */

// ============================================
// ENUM TYPES
// ============================================

export type BankType = 
  | 'AIB' | 'Revolut' | 'N26' | 'Wise' | 'Bank of Ireland' | 'Ulster Bank' | 'Cash' | 'Other';

export type PersonType = 
  | 'Kene' | 'Ify' | 'Joint' | 'Other';

export type FrequencyType = 
  | 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually' | 'One-Time';

export type StatusType = 
  | 'Not Started' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';

export type SubscriptionStatusType = 
  | 'Active' | 'Paused' | 'Cancelled' | 'Ended';

export type LoanStatusType = 
  | 'Active' | 'Paid Off' | 'Defaulted' | 'Refinanced' | 'Closed';

export type LoanType = 
  | 'Mortgage' | 'Car Loan' | 'Personal Loan' | 'Student Loan' | 'Credit Card' | 'Other';

export type PriorityType = 
  | 'Low' | 'Medium' | 'High' | 'Critical';

export type GoalType = 
  | 'Short Term' | 'Medium Term' | 'Long Term';

export type IncomeSourceType = 
  | 'Salary' | 'Freelance' | 'Side Hustle' | 'Investment' | 'Gift' | 'Refund' | 'Other';

export type ExpenseSubCategoryType = 
  | 'Rent' | 'Electricity' | 'Gas' | 'Water' | 'Internet' | 'Phone' | 'Groceries' | 'Dining Out'
  | 'Transport' | 'Fuel' | 'Parking' | 'Toll' | 'Insurance' | 'Medical' | 'Pharmacy'
  | 'Clothing' | 'Personal Care' | 'Entertainment' | 'Subscriptions' | 'Gifts'
  | 'Tithe' | 'Offering' | 'Charity' | 'Education' | 'Childcare' | 'Pet' | 'Home Maintenance'
  | 'Furniture' | 'Electronics' | 'Travel' | 'Vacation' | 'Investment' | 'Savings' | 'Other';

// SubscriptionType is now TEXT in database, allowing dynamic values from Settings
// Keeping the type as string for flexibility
export type SubscriptionType = string;

export type InvestmentType = 
  | 'Stocks' | 'ETF' | 'Bonds' | 'Crypto' | 'Real Estate' | 'Mutual Fund' | 'Pension' | 'Savings Account' | 'Other';

export type TransactionType = 
  | 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal' | 'Dividend' | 'Interest';

export type PlatformType = 
  | 'Degiro' | 'Trading 212' | 'Revolut' | 'eToro' | 'Interactive Brokers' | 'Binance' | 'Coinbase' | 'Other';

// ============================================
// TABLE TYPES
// ============================================

export interface MonthlyOverview {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyOverviewInsert {
  id?: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}

export interface MonthlyOverviewUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  notes?: string | null;
}

// Monthly Overview with computed fields (from view)
export interface MonthlyOverviewSummary extends MonthlyOverview {
  is_active: boolean;
  total_income: number;
  total_budgeted: number;
  total_spent: number;
  amount_unallocated: number;
}

export interface Budget {
  id: string;
  monthly_overview_id: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  master_budget_id?: string | null;
  override_amount?: number | null;
  override_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetInsert {
  id?: string;
  monthly_overview_id: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  master_budget_id?: string | null;
  override_amount?: number | null;
  override_reason?: string | null;
}

export interface BudgetUpdate {
  name?: string;
  budget_amount?: number;
  description?: string | null;
  override_amount?: number | null;
  override_reason?: string | null;
}

// Budget with computed fields (from view)
export interface BudgetSummary extends Budget {
  amount_spent: number;
  amount_left: number;
  percent_used: number;
}

// Master Budget types
export type BudgetType = 'Fixed' | 'Variable';

export interface MasterBudget {
  id: string;
  user_id: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  budget_type: BudgetType;
  created_at: string;
  updated_at: string;
}

export interface MasterBudgetInsert {
  id?: string;
  user_id?: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  is_active?: boolean;
  display_order?: number;
  budget_type?: BudgetType;
}

export interface MasterBudgetUpdate {
  name?: string;
  budget_amount?: number;
  description?: string | null;
  is_active?: boolean;
  display_order?: number;
  budget_type?: BudgetType;
}

export interface Expense {
  id: string;
  budget_id: string;
  user_id: string;
  amount: number;
  date: string;
  description?: string | null;
  sub_category?: ExpenseSubCategoryType | null;
  bank?: string | null;
  is_recurring: boolean;
  recurring_frequency?: FrequencyType | null;
  /** @deprecated Goal linking has been moved to goal_contributions table. This field is kept for backward compatibility but should not be used. */
  financial_goal_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInsert {
  id?: string;
  budget_id: string;
  user_id: string;
  amount: number;
  date: string;
  description?: string | null;
  sub_category?: ExpenseSubCategoryType | null;
  bank?: string | null;
  is_recurring?: boolean;
  recurring_frequency?: FrequencyType | null;
  financial_goal_id?: string | null;
}

export interface ExpenseUpdate {
  budget_id?: string;
  amount?: number;
  date?: string;
  description?: string | null;
  sub_category?: ExpenseSubCategoryType | null;
  bank?: string | null;
  is_recurring?: boolean;
  recurring_frequency?: FrequencyType | null;
  /** @deprecated Goal linking has been moved to goal_contributions table. This field is kept for backward compatibility but should not be used. */
  financial_goal_id?: string | null;
}

export interface IncomeSource {
  id: string;
  monthly_overview_id: string;
  user_id: string;
  amount: number;
  source: IncomeSourceType;
  person?: string | null;
  bank?: string | null;
  date_paid: string;
  tithe_deduction: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeSourceInsert {
  id?: string;
  monthly_overview_id: string;
  user_id: string;
  amount: number;
  source: IncomeSourceType;
  person?: string | null;
  bank?: string | null;
  date_paid: string;
  tithe_deduction?: boolean;
  description?: string | null;
}

export interface IncomeSourceUpdate {
  amount?: number;
  source?: IncomeSourceType;
  person?: string | null;
  bank?: string | null;
  date_paid?: string;
  tithe_deduction?: boolean;
  description?: string | null;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  base_amount?: number; // Base/initial amount set manually (not from linked expenses)
  start_date: string;
  end_date?: string | null;
  status: StatusType;
  person?: string | null;
  priority: PriorityType;
  goal_type?: GoalType | null;
  estimated_contributions?: number | null;
  estimated_frequency?: FrequencyType | null;
  description?: string | null;
  product_link?: string | null;
  has_sub_goals: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoalInsert {
  id?: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount?: number;
  base_amount?: number; // Base/initial amount set manually
  start_date: string;
  end_date?: string | null;
  status?: StatusType;
  person?: string | null;
  priority?: PriorityType;
  goal_type?: GoalType | null;
  estimated_contributions?: number | null;
  estimated_frequency?: FrequencyType | null;
  description?: string | null;
  product_link?: string | null;
  has_sub_goals?: boolean;
}

export interface FinancialGoalUpdate {
  name?: string;
  target_amount?: number;
  current_amount?: number;
  base_amount?: number; // Base/initial amount set manually
  start_date?: string;
  end_date?: string | null;
  status?: StatusType;
  person?: string | null;
  priority?: PriorityType;
  goal_type?: GoalType | null;
  estimated_contributions?: number | null;
  estimated_frequency?: FrequencyType | null;
  description?: string | null;
  product_link?: string | null;
  has_sub_goals?: boolean;
}

export interface FinancialSubGoal {
  id: string;
  financial_goal_id: string;
  name: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  status: StatusType;
  priority: PriorityType;
  responsible_person?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress: number;
  description?: string | null;
  product_link?: string | null;
  contribution_frequency?: FrequencyType | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialSubGoalInsert {
  id?: string;
  financial_goal_id: string;
  name: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  status?: StatusType;
  priority?: PriorityType;
  responsible_person?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number;
  description?: string | null;
  product_link?: string | null;
  contribution_frequency?: FrequencyType | null;
}

export interface FinancialSubGoalUpdate {
  name?: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  status?: StatusType;
  priority?: PriorityType;
  responsible_person?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number;
  description?: string | null;
  product_link?: string | null;
  contribution_frequency?: FrequencyType | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: FrequencyType;
  status: SubscriptionStatusType;
  person?: string | null;
  bank?: string | null;
  subscription_type?: SubscriptionType | null;
  is_essential: boolean;
  start_date?: string | null;
  end_date?: string | null;
  collection_day?: number | null;
  last_collection_date?: string | null;
  next_collection_date?: string | null;
  paid_this_period: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInsert {
  id?: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: FrequencyType;
  status?: SubscriptionStatusType;
  person?: string | null;
  bank?: string | null;
  subscription_type?: SubscriptionType | null;
  is_essential?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  collection_day?: number | null;
  last_collection_date?: string | null;
  next_collection_date?: string | null;
  paid_this_period?: boolean;
  description?: string | null;
}

export interface SubscriptionUpdate {
  name?: string;
  amount?: number;
  frequency?: FrequencyType;
  status?: SubscriptionStatusType;
  person?: string | null;
  bank?: string | null;
  subscription_type?: SubscriptionType | null;
  is_essential?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  collection_day?: number | null;
  last_collection_date?: string | null;
  next_collection_date?: string | null;
  paid_this_period?: boolean;
  description?: string | null;
}

export interface Loan {
  id: string;
  user_id: string;
  name: string;
  loan_type: LoanType;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  payment_frequency: FrequencyType;
  status: LoanStatusType;
  person?: string | null;
  bank?: string | null;
  lender_name?: string | null;
  start_date: string;
  end_date?: string | null;
  next_payment_date?: string | null;
  last_payment_date?: string | null;
  payment_method?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanInsert {
  id?: string;
  user_id: string;
  name: string;
  loan_type: LoanType;
  original_amount: number;
  current_balance: number;
  interest_rate?: number;
  monthly_payment: number;
  payment_frequency?: FrequencyType;
  status?: LoanStatusType;
  person?: string | null;
  bank?: string | null;
  lender_name?: string | null;
  start_date: string;
  end_date?: string | null;
  next_payment_date?: string | null;
  last_payment_date?: string | null;
  payment_method?: string | null;
  description?: string | null;
}

export interface LoanUpdate {
  name?: string;
  loan_type?: LoanType;
  original_amount?: number;
  current_balance?: number;
  interest_rate?: number;
  monthly_payment?: number;
  payment_frequency?: FrequencyType;
  status?: LoanStatusType;
  person?: string | null;
  bank?: string | null;
  lender_name?: string | null;
  start_date?: string;
  end_date?: string | null;
  next_payment_date?: string | null;
  last_payment_date?: string | null;
  payment_method?: string | null;
  description?: string | null;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  user_id: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  payment_date: string;
  payment_method?: string | null;
  linked_expense_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanPaymentInsert {
  id?: string;
  loan_id: string;
  user_id: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  payment_date: string;
  payment_method?: string | null;
  linked_expense_id?: string | null;
  notes?: string | null;
}

export interface LoanPaymentUpdate {
  payment_amount?: number;
  principal_amount?: number;
  interest_amount?: number;
  payment_date?: string;
  payment_method?: string | null;
  linked_expense_id?: string | null;
  notes?: string | null;
}

export interface InvestmentHolding {
  id: string;
  user_id: string;
  name: string;
  investment_type: InvestmentType;
  current_value: number;
  last_valued_on?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentHoldingInsert {
  id?: string;
  user_id: string;
  name: string;
  investment_type: InvestmentType;
  current_value?: number;
  last_valued_on?: string | null;
  notes?: string | null;
}

export interface InvestmentHoldingUpdate {
  name?: string;
  investment_type?: InvestmentType;
  current_value?: number;
  last_valued_on?: string | null;
  notes?: string | null;
}

// Investment Holding with computed fields (from view)
export interface InvestmentHoldingSummary extends InvestmentHolding {
  total_invested: number;
  total_withdrawn: number;
  net_invested: number;
  gain_loss: number;
}

export interface InvestmentTransaction {
  id: string;
  investment_holding_id: string;
  user_id: string;
  name?: string | null;
  amount: number;
  transaction_type: TransactionType;
  transaction_date: string;
  platform?: PlatformType | null;
  linked_expense_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentTransactionInsert {
  id?: string;
  investment_holding_id: string;
  user_id: string;
  name?: string | null;
  amount: number;
  transaction_type: TransactionType;
  transaction_date: string;
  platform?: PlatformType | null;
  linked_expense_id?: string | null;
  notes?: string | null;
}

export interface InvestmentTransactionUpdate {
  name?: string | null;
  amount?: number;
  transaction_type?: TransactionType;
  transaction_date?: string;
  platform?: PlatformType | null;
  linked_expense_id?: string | null;
  notes?: string | null;
}

// ============================================
// DATABASE SCHEMA TYPE
// ============================================

export interface Database {
  public: {
    Tables: {
      monthly_overviews: {
        Row: MonthlyOverview;
        Insert: MonthlyOverviewInsert;
        Update: MonthlyOverviewUpdate;
      };
      budgets: {
        Row: Budget;
        Insert: BudgetInsert;
        Update: BudgetUpdate;
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: ExpenseUpdate;
      };
      income_sources: {
        Row: IncomeSource;
        Insert: IncomeSourceInsert;
        Update: IncomeSourceUpdate;
      };
      financial_goals: {
        Row: FinancialGoal;
        Insert: FinancialGoalInsert;
        Update: FinancialGoalUpdate;
      };
      financial_sub_goals: {
        Row: FinancialSubGoal;
        Insert: FinancialSubGoalInsert;
        Update: FinancialSubGoalUpdate;
      };
      subscriptions: {
        Row: Subscription;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
      };
      loans: {
        Row: Loan;
        Insert: LoanInsert;
        Update: LoanUpdate;
      };
      loan_payments: {
        Row: LoanPayment;
        Insert: LoanPaymentInsert;
        Update: LoanPaymentUpdate;
      };
      investment_holdings: {
        Row: InvestmentHolding;
        Insert: InvestmentHoldingInsert;
        Update: InvestmentHoldingUpdate;
      };
      investment_transactions: {
        Row: InvestmentTransaction;
        Insert: InvestmentTransactionInsert;
        Update: InvestmentTransactionUpdate;
      };
    };
    Views: {
      monthly_overview_summary: {
        Row: MonthlyOverviewSummary;
      };
      budget_summary: {
        Row: BudgetSummary;
      };
      investment_holding_summary: {
        Row: InvestmentHoldingSummary;
      };
    };
    Enums: {
      bank_type: BankType;
      person_type: PersonType;
      frequency_type: FrequencyType;
      status_type: StatusType;
      subscription_status_type: SubscriptionStatusType;
      loan_status_type: LoanStatusType;
      loan_type: LoanType;
      priority_type: PriorityType;
      goal_type: GoalType;
      income_source_type: IncomeSourceType;
      expense_sub_category_type: ExpenseSubCategoryType;
      subscription_type: string; // Now TEXT in database, allowing dynamic values
      investment_type: InvestmentType;
      transaction_type: TransactionType;
      platform_type: PlatformType;
    };
  };
}

// ============================================
// HELPER TYPES
// ============================================

// Expense with related data
export interface ExpenseWithBudget extends Expense {
  budget?: Budget;
  financial_goal?: FinancialGoal | null;
}

// Budget with expenses
export interface BudgetWithExpenses extends BudgetSummary {
  expenses?: Expense[];
}

// Monthly Overview with all related data
export interface MonthlyOverviewFull extends MonthlyOverviewSummary {
  budgets?: BudgetWithExpenses[];
  income_sources?: IncomeSource[];
}

// Financial Goal with sub-goals
export interface FinancialGoalWithSubGoals extends FinancialGoal {
  sub_goals?: FinancialSubGoal[];
  // Computed fields
  progress_percent?: number;
  forecasted_amount?: number;
  estimated_current_amount?: number;
}

export interface GoalContribution {
  id: string;
  financial_goal_id: string;
  user_id: string;
  monthly_overview_id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContributionInsert {
  id?: string;
  financial_goal_id: string;
  user_id: string;
  monthly_overview_id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
}

export interface GoalContributionUpdate {
  financial_goal_id?: string;
  monthly_overview_id?: string;
  amount?: number;
  date?: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
}

export interface GoalDrawdown {
  id: string;
  financial_goal_id: string;
  user_id: string;
  monthly_overview_id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalDrawdownInsert {
  id?: string;
  financial_goal_id: string;
  user_id: string;
  monthly_overview_id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
}

export interface GoalDrawdownUpdate {
  financial_goal_id?: string;
  monthly_overview_id?: string;
  amount?: number;
  date?: string;
  description?: string | null;
  bank?: BankType | null;
  notes?: string | null;
}

// Investment holding with transactions
export interface InvestmentHoldingWithTransactions extends InvestmentHoldingSummary {
  transactions?: InvestmentTransaction[];
  gain_loss_percent?: number;
}
