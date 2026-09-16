const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type User = { id: number; email: string; name: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Pedido falhou');
  }
  return data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/api/auth/me'),
  accounts: () => request<{ accounts: Array<{ id: number; name: string; kind: string }> }>('/api/accounts'),
  categories: () =>
    request<{ categories: Array<{ id: number; name: string; kind: string }> }>('/api/categories'),
  transactions: (q: string) =>
    request<{ transactions: Transaction[] }>(`/api/transactions${q}`),
  createTransaction: (body: unknown) =>
    request<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteTransaction: (id: number) =>
    request<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  dashboard: (yearMonth: string) =>
    request<Dashboard>(`/api/dashboard?year_month=${encodeURIComponent(yearMonth)}`),
  budgets: (yearMonth: string) =>
    request<BudgetsResponse>(`/api/budgets?year_month=${encodeURIComponent(yearMonth)}`),
  upsertBudget: (body: unknown) =>
    request<{ budget: unknown }>('/api/budgets', { method: 'PUT', body: JSON.stringify(body) }),
  recurring: () => request<{ rules: RecurringRule[] }>('/api/recurring'),
  createRecurring: (body: {
    name: string;
    account_id: number;
    category_id: number;
    type: 'income' | 'expense';
    amount_cents: number;
    day_of_month: number;
    start_date: string;
    end_date: string | null;
  }) =>
    request<{ rule: { id: number } }>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  toggleRecurring: (id: number, active: boolean) =>
    request<{ rule: { id: number; active: boolean } }>(`/api/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  deleteRecurring: (id: number) =>
    request<{ ok: boolean }>(`/api/recurring/${id}`, { method: 'DELETE' }),
  runRecurring: () => request<{ created: number }>('/api/recurring/run', { method: 'POST' }),
  goals: () => request<{ goals: Goal[] }>('/api/goals'),
  createGoal: (body: { name: string; target_cents: number; deadline: string | null }) =>
    request<{ goal: { id: number } }>('/api/goals', { method: 'POST', body: JSON.stringify(body) }),
  addGoalContribution: (
    goalId: number,
    body: { amount_cents: number; occurred_on: string }
  ) =>
    request<{ contribution: unknown }>(`/api/goals/${goalId}/contributions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteGoal: (id: number) => request<{ ok: boolean }>(`/api/goals/${id}`, { method: 'DELETE' }),
  reportByCategory: (from: string, to: string) =>
    request<{ rows: Array<{ name: string; type: string; total_cents: number }> }>(
      `/api/reports/by-category?from=${from}&to=${to}`
    ),
};

export type Transaction = {
  id: number;
  type: 'income' | 'expense';
  amount_cents: number;
  occurred_on: string;
  notes: string | null;
  category_name: string;
  account_name: string;
  category_id: number;
  account_id: number;
};

export type Dashboard = {
  year_month: string;
  balance_cents: number;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  by_category: Array<{ name: string; total_cents: number }>;
  recent: Array<{
    id: number;
    type: string;
    amount_cents: number;
    occurred_on: string;
    notes: string | null;
    category_name: string;
  }>;
};

export type RecurringRule = {
  id: number;
  name: string;
  type: 'income' | 'expense';
  amount_cents: number;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  last_run_on: string | null;
  category_name: string;
  account_name: string;
  next_occurrence: string | null;
};

export type GoalStatus = 'atingido' | 'em_dia' | 'em_risco' | 'sem_prazo';

export type Goal = {
  id: number;
  name: string;
  target_cents: number;
  deadline: string | null;
  saved_cents: number;
  pace_cents: number | null;
  percent: number;
  remainingCents: number;
  monthsRemaining: number | null;
  requiredMonthlyCents: number | null;
  status: GoalStatus;
};

export type BudgetsResponse = {
  year_month: string;
  budgets: Array<{
    id: number;
    category_id: number;
    category_name: string;
    limit_cents: number;
    spent_cents: number;
    remaining_cents: number;
    percent_used: number;
  }>;
};
