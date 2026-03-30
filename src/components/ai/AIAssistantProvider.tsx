'use client';

import { useState, useCallback, useEffect, createContext, useContext, useRef, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AssistantResponse } from '@/app/api/ai/assistant/route';

interface BudgetContext {
  id: string;
  name: string;
  budget_amount: number;
  amount_spent: number;
  amount_left: number;
}

interface FinancialContext {
  monthlyOverviewId: string;
  monthName: string;
  monthDateRange: { start_date: string; end_date: string };
  currentDate: string;
  budgets: BudgetContext[];
  incomeSources: Array<{ id: string; source: string; amount: number }>;
  goals: Array<{ id: string; name: string; target_amount: number; current_amount: number }>;
  subscriptions: { count: number; monthlyTotal: number; items: Array<{ name: string; amount: number; next_date: string }> };
  loans: Array<{ id: string; name: string; current_balance: number; monthly_payment: number; next_payment_date: string | null }>;
  debtors: Array<{ id: string; name: string; amount_owed: number }>;
  paymentMethods: string[];
  previousMonth: { name: string; total_income: number; total_spent: number; total_budgeted: number } | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantResponse;
  confirmed?: boolean;
}

interface AIAssistantContextValue {
  isOpen: boolean;
  isCommandBarOpen: boolean;
  messages: Message[];
  isProcessing: boolean;
  financialContext: FinancialContext | null;
  open: () => void;
  close: () => void;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  markConfirmed: (messageId: string) => void;
}

const AIAssistantContext = createContext<AIAssistantContextValue | undefined>(undefined);

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within AIAssistantProvider');
  }
  return context;
}

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [financialContext, setFinancialContext] = useState<FinancialContext | null>(null);
  const contextRef = useRef<FinancialContext | null>(null);
  const contextFetchedRef = useRef(false);

  const fetchFinancialContext = useCallback(async (): Promise<FinancialContext | null> => {
    if (contextFetchedRef.current && contextRef.current) return contextRef.current;
    contextFetchedRef.current = true;

    try {
      const supabase = createSupabaseBrowserClient();
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Find current month by date range
      const { data: currentMonth } = await supabase
        .from('monthly_overviews')
        .select('id, name, start_date, end_date')
        .lte('start_date', today)
        .gte('end_date', today)
        .single();

      if (!currentMonth) {
        // Fallback: get most recent month
        const { data: recentMonth } = await supabase
          .from('monthly_overviews')
          .select('id, name, start_date, end_date')
          .order('start_date', { ascending: false })
          .limit(1)
          .single();

        if (!recentMonth) return;
        Object.assign(currentMonth || {}, recentMonth);
        if (!currentMonth) return;
      }

      // Fetch all context in parallel
      const [
        budgetsResult,
        incomeResult,
        goalsResult,
        subscriptionsResult,
        loansResult,
        debtorsResult,
        settingsResult,
        prevMonthResult,
      ] = await Promise.all([
        supabase.from('budget_summary').select('*').eq('monthly_overview_id', currentMonth.id).order('name'),
        supabase.from('income_sources').select('id, source, amount').eq('monthly_overview_id', currentMonth.id),
        supabase.from('financial_goals').select('id, name, target_amount, current_amount').in('status', ['not_started', 'in_progress']),
        supabase.from('subscriptions').select('id, name, amount, next_collection_date, frequency').eq('status', 'Active'),
        supabase.from('loans').select('id, name, current_balance, monthly_payment, next_payment_date').eq('status', 'Active'),
        supabase.from('debtors').select('id, debtor_name, amount_owed').eq('status', 'Pending'),
        supabase.from('app_settings').select('value').eq('setting_type', 'payment_method').eq('is_active', true),
        supabase.from('monthly_overview_summary').select('name, total_income, total_budgeted, total_spent')
          .lt('end_date', currentMonth.start_date).order('end_date', { ascending: false }).limit(1).single(),
      ]);

      const subscriptionItems = (subscriptionsResult.data || []).map(s => ({
        name: s.name,
        amount: s.amount,
        next_date: s.next_collection_date || 'N/A',
      }));

      const ctx: FinancialContext = {
        monthlyOverviewId: currentMonth.id,
        monthName: currentMonth.name,
        monthDateRange: { start_date: currentMonth.start_date, end_date: currentMonth.end_date },
        currentDate: today,
        budgets: (budgetsResult.data || []).map(b => ({
          id: b.id,
          name: b.name,
          budget_amount: b.budget_amount,
          amount_spent: b.amount_spent || 0,
          amount_left: b.amount_left || 0,
        })),
        incomeSources: (incomeResult.data || []).map(i => ({
          id: i.id,
          source: i.source,
          amount: i.amount,
        })),
        goals: (goalsResult.data || []).map(g => ({
          id: g.id,
          name: g.name,
          target_amount: g.target_amount,
          current_amount: g.current_amount || 0,
        })),
        subscriptions: {
          count: subscriptionItems.length,
          monthlyTotal: subscriptionItems.reduce((sum, s) => sum + s.amount, 0),
          items: subscriptionItems,
        },
        loans: (loansResult.data || []).map(l => ({
          id: l.id,
          name: l.name,
          current_balance: l.current_balance,
          monthly_payment: l.monthly_payment,
          next_payment_date: l.next_payment_date,
        })),
        debtors: (debtorsResult.data || []).map(d => ({
          id: d.id,
          name: d.debtor_name,
          amount_owed: d.amount_owed,
        })),
        paymentMethods: (settingsResult.data || []).map(s => s.value),
        previousMonth: prevMonthResult.data ? {
          name: prevMonthResult.data.name,
          total_income: prevMonthResult.data.total_income || 0,
          total_spent: prevMonthResult.data.total_spent || 0,
          total_budgeted: prevMonthResult.data.total_budgeted || 0,
        } : null,
      };
      contextRef.current = ctx;
      setFinancialContext(ctx);
      return ctx;
    } catch (error) {
      console.error('Failed to fetch financial context:', error);
      return null;
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setIsCommandBarOpen(false);
    fetchFinancialContext();
  }, [fetchFinancialContext]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openCommandBar = useCallback(() => {
    setIsCommandBarOpen(true);
    setIsOpen(false);
    fetchFinancialContext();
  }, [fetchFinancialContext]);

  const closeCommandBar = useCallback(() => {
    setIsCommandBarOpen(false);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Ensure context is loaded before sending
      let ctx = contextRef.current;
      if (!ctx) {
        ctx = await fetchFinancialContext();
      }

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: ctx,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }

      const data: AssistantResponse = await res.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        response: data,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [financialContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const markConfirmed = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, confirmed: true } : m));
    // Refresh context after a data entry action
    contextFetchedRef.current = false;
    contextRef.current = null;
    fetchFinancialContext();
  }, [fetchFinancialContext]);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isCommandBarOpen) {
          closeCommandBar();
        } else {
          openCommandBar();
        }
      }
      if (e.key === 'Escape') {
        if (isCommandBarOpen) closeCommandBar();
        if (isOpen) close();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandBarOpen, isOpen, openCommandBar, closeCommandBar, close]);

  return (
    <AIAssistantContext.Provider value={{
      isOpen,
      isCommandBarOpen,
      messages,
      isProcessing,
      financialContext,
      open,
      close,
      openCommandBar,
      closeCommandBar,
      sendMessage,
      clearMessages,
      markConfirmed,
    }}>
      {children}
    </AIAssistantContext.Provider>
  );
}
