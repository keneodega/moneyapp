/**
 * Data Export Utilities
 * Provides functions to export data in various formats (CSV, JSON, PDF)
 */

import type { ExportOptions } from '@/components/ui/ExportOptionsDialog';

export interface ExportableData {
  months?: Array<Record<string, any>>;
  masterBudgets?: Array<Record<string, any>>;
  expenses?: Array<Record<string, any>>;
  budgets?: Array<Record<string, any>>;
  goals?: Array<Record<string, any>>;
  income?: Array<Record<string, any>>;
  subscriptions?: Array<Record<string, any>>;
}

export type { ExportOptions };

/**
 * Convert data to CSV format
 */
export function exportToCSV(data: Array<Record<string, any>>, filename: string): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Convert data to JSON format
 */
export function exportToJSON(data: ExportableData, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate PDF report (simplified - uses browser print)
 * For full PDF generation, consider using a library like jsPDF or pdfkit
 */
export function exportToPDF(data: ExportableData, title: string): void {
  // Create a printable HTML document
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate PDF');
    return;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IE');
  };

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #c45d3e; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .total { font-weight: bold; }
        @media print {
          body { padding: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Generated on ${new Date().toLocaleDateString('en-IE', { dateStyle: 'full' })}</p>
  `;

  // Add expenses section
  if (data.expenses && data.expenses.length > 0) {
    html += '<h2>Expenses</h2><table>';
    html += '<tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th></tr>';
    let totalExpenses = 0;
    data.expenses.forEach((expense: any) => {
      totalExpenses += Number(expense.amount || 0);
      html += `<tr>
        <td>${formatDate(expense.date)}</td>
        <td>${expense.description || ''}</td>
        <td>${formatCurrency(Number(expense.amount || 0))}</td>
        <td>${expense.budgets?.name || ''}</td>
      </tr>`;
    });
    html += `<tr class="total"><td colspan="3">Total</td><td>${formatCurrency(totalExpenses)}</td></tr>`;
    html += '</table>';
  }

  // Add income section
  if (data.income && data.income.length > 0) {
    html += '<h2>Income</h2><table>';
    html += '<tr><th>Date</th><th>Source</th><th>Amount</th><th>Person</th></tr>';
    let totalIncome = 0;
    data.income.forEach((income: any) => {
      totalIncome += Number(income.amount || 0);
      html += `<tr>
        <td>${formatDate(income.date_paid)}</td>
        <td>${income.source || ''}</td>
        <td>${formatCurrency(Number(income.amount || 0))}</td>
        <td>${income.person || ''}</td>
      </tr>`;
    });
    html += `<tr class="total"><td colspan="3">Total</td><td>${formatCurrency(totalIncome)}</td></tr>`;
    html += '</table>';
  }

  // Add budgets section
  if (data.budgets && data.budgets.length > 0) {
    html += '<h2>Budgets</h2><table>';
    html += '<tr><th>Category</th><th>Budgeted</th><th>Spent</th><th>Remaining</th></tr>';
    data.budgets.forEach((budget: any) => {
      const spent = Number(budget.amount_spent || 0);
      const budgeted = Number(budget.budget_amount || 0);
      html += `<tr>
        <td>${budget.name || ''}</td>
        <td>${formatCurrency(budgeted)}</td>
        <td>${formatCurrency(spent)}</td>
        <td>${formatCurrency(budgeted - spent)}</td>
      </tr>`;
    });
    html += '</table>';
  }

  // Add goals section
  if (data.goals && data.goals.length > 0) {
    html += '<h2>Financial Goals</h2><table>';
    html += '<tr><th>Goal</th><th>Target</th><th>Current</th><th>Progress</th></tr>';
    data.goals.forEach((goal: any) => {
      const target = Number(goal.target_amount || 0);
      const current = Number(goal.current_amount || 0);
      const progress = target > 0 ? ((current / target) * 100).toFixed(1) : '0';
      html += `<tr>
        <td>${goal.name || ''}</td>
        <td>${formatCurrency(target)}</td>
        <td>${formatCurrency(current)}</td>
        <td>${progress}%</td>
      </tr>`;
    });
    html += '</table>';
  }

  // Add subscriptions section
  if (data.subscriptions && data.subscriptions.length > 0) {
    html += '<h2>Subscriptions</h2><table>';
    html += '<tr><th>Name</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Next Payment</th></tr>';
    data.subscriptions.forEach((sub: any) => {
      html += `<tr>
        <td>${sub.name || ''}</td>
        <td>${formatCurrency(Number(sub.amount || 0))}</td>
        <td>${sub.frequency || ''}</td>
        <td>${sub.status || ''}</td>
        <td>${sub.next_collection_date ? formatDate(sub.next_collection_date) : '-'}</td>
      </tr>`;
    });
    html += '</table>';
  }

  // Add master budgets section
  if (data.masterBudgets && data.masterBudgets.length > 0) {
    html += '<h2>Master Budgets</h2><table>';
    html += '<tr><th>Category</th><th>Amount</th><th>Description</th><th>Status</th></tr>';
    data.masterBudgets.forEach((mb: any) => {
      html += `<tr>
        <td>${mb.name || ''}</td>
        <td>${formatCurrency(Number(mb.budget_amount || 0))}</td>
        <td>${mb.description || ''}</td>
        <td>${mb.is_active ? 'Active' : 'Inactive'}</td>
      </tr>`;
    });
    html += '</table>';
  }

  // Add months section
  if (data.months && data.months.length > 0) {
    html += '<h2>Monthly Overviews</h2><table>';
    html += '<tr><th>Name</th><th>Start Date</th><th>End Date</th><th>Total Budget</th><th>Total Income</th></tr>';
    data.months.forEach((month: any) => {
      html += `<tr>
        <td>${month.name || ''}</td>
        <td>${formatDate(month.start_date)}</td>
        <td>${formatDate(month.end_date)}</td>
        <td>${formatCurrency(Number(month.total_budget || 0))}</td>
        <td>${formatCurrency(Number(month.total_income || 0))}</td>
      </tr>`;
    });
    html += '</table>';
  }

  html += '</body></html>';

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

/**
 * Export user data based on selected options
 */
export async function exportAllData(
  supabase: any,
  userId: string,
  format: 'csv' | 'json' | 'pdf',
  options?: ExportOptions
): Promise<void> {
  try {
    // Default to all if no options provided
    const exportOptions: ExportOptions = options || {
      months: true,
      masterBudgets: true,
      goals: true,
      subscriptions: true,
      expenses: true,
      income: true,
      budgets: true,
    };

    // Build queries based on selected options
    const queries: Promise<any>[] = [];
    const queryKeys: string[] = [];

    if (exportOptions.expenses) {
      queries.push(supabase.from('expenses').select('*, budgets(name)').eq('user_id', userId));
      queryKeys.push('expenses');
    }
    if (exportOptions.income) {
      queries.push(supabase.from('income_sources').select('*').eq('user_id', userId));
      queryKeys.push('income');
    }
    if (exportOptions.budgets) {
      queries.push(supabase.from('budgets').select('*, monthly_overviews(name)').eq('monthly_overviews.user_id', userId));
      queryKeys.push('budgets');
    }
    if (exportOptions.goals) {
      queries.push(supabase.from('financial_goals').select('*').eq('user_id', userId));
      queryKeys.push('goals');
    }
    if (exportOptions.subscriptions) {
      queries.push(supabase.from('subscriptions').select('*').eq('user_id', userId));
      queryKeys.push('subscriptions');
    }
    if (exportOptions.masterBudgets) {
      queries.push(supabase.from('master_budgets').select('*').eq('user_id', userId));
      queryKeys.push('masterBudgets');
    }
    if (exportOptions.months) {
      queries.push(supabase.from('monthly_overviews').select('*').eq('user_id', userId));
      queryKeys.push('months');
    }

    // Execute all queries
    const results = await Promise.all(queries);

    // Build data object
    const data: ExportableData = {};
    results.forEach((result, index) => {
      const key = queryKeys[index] as keyof ExportableData;
      data[key] = result.data || [];
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `family-money-export-${timestamp}`;

    switch (format) {
      case 'csv':
        // Export each type separately as CSV
        if (data.expenses?.length) exportToCSV(data.expenses, `${filename}-expenses`);
        if (data.income?.length) exportToCSV(data.income, `${filename}-income`);
        if (data.budgets?.length) exportToCSV(data.budgets, `${filename}-budgets`);
        if (data.goals?.length) exportToCSV(data.goals, `${filename}-goals`);
        if (data.subscriptions?.length) exportToCSV(data.subscriptions, `${filename}-subscriptions`);
        if (data.masterBudgets?.length) exportToCSV(data.masterBudgets, `${filename}-master-budgets`);
        if (data.months?.length) exportToCSV(data.months, `${filename}-months`);
        break;
      case 'json':
        exportToJSON(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, `Family Money Report - ${timestamp}`);
        break;
    }
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('Failed to export data');
  }
}
