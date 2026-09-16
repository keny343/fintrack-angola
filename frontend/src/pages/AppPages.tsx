import {
  ArrowsClockwise,
  ArrowsDownUp,
  ChartBar,
  Flag,
  Minus,
  Pause,
  Play,
  Plus,
  Scales,
  SignOut,
  SquaresFour,
  Target,
  Trash,
  TrendDown,
  TrendUp,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import {
  api,
  type BudgetsResponse,
  type Dashboard,
  type Goal,
  type GoalStatus,
  type RecurringRule,
  type Transaction,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { currentYearMonth, formatAOA, formatDateAO, parseAOAInput } from '../utils/money';

const NAV_ITEMS: Array<{ to: string; label: string; icon: Icon; end?: boolean }> = [
  { to: '/app', label: 'Dashboard', icon: SquaresFour, end: true },
  { to: '/app/transactions', label: 'Transações', icon: ArrowsDownUp },
  { to: '/app/budgets', label: 'Orçamentos', icon: Target },
  { to: '/app/recurring', label: 'Recorrências', icon: ArrowsClockwise },
  { to: '/app/goals', label: 'Objetivos', icon: Flag },
  { to: '/app/reports', label: 'Relatórios', icon: ChartBar },
];

function ErrorAlert({ message }: { message: string }) {
  return (
    <div aria-live="polite">
      {message && (
        <div className="alert">
          <WarningCircle size={18} aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();

  if (loading) return <div className="shell center">A carregar…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link className="brand" to="/app">
            <span className="brand-mark" aria-hidden="true">
              Kz
            </span>
            FinTrack
          </Link>
          <ThemeToggle />
        </div>
        <nav className="side-nav">
          <p className="nav-label">Gestão</p>
          {NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <NavIcon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span>{user.name}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          aria-label="Terminar sessão"
          onClick={async () => {
            await logout();
            nav('/');
          }}
        >
          <SignOut size={16} aria-hidden="true" />
          <span className="btn-label">Terminar sessão</span>
        </button>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function DashboardPage() {
  const { theme } = useTheme();
  const [ym, setYm] = useState(currentYearMonth());
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api
      .dashboard(ym)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [ym]);

  const chartData = useMemo(
    () =>
      (data?.by_category || []).map((c) => ({
        name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
        full: c.name,
        value: c.total_cents / 100,
      })),
    [data]
  );

  const axis = theme === 'dark' ? '#94a3b8' : '#6b6862';
  const grid = theme === 'dark' ? '#334155' : '#e0ddd6';
  const surface = theme === 'dark' ? '#222735' : '#ffffff';

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Visão do mês em AOA/Kz</p>
        </div>
        <label className="inline-field">
          Mês
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
        </label>
      </header>
      <ErrorAlert message={error} />
      {data && (
        <>
          <div className="kpi-row stagger">
            <article className="kpi kpi-primary">
              <span className="kpi-label">
                <Scales size={14} aria-hidden="true" />
                Saldo
              </span>
              <strong>{formatAOA(data.balance_cents)}</strong>
            </article>
            <article className="kpi">
              <span className="kpi-label">
                <TrendUp size={14} aria-hidden="true" />
                Receitas
              </span>
              <strong className="pos">{formatAOA(data.income_cents)}</strong>
            </article>
            <article className="kpi">
              <span className="kpi-label">
                <TrendDown size={14} aria-hidden="true" />
                Despesas
              </span>
              <strong className="neg">{formatAOA(data.expense_cents)}</strong>
            </article>
            <article className="kpi">
              <span className="kpi-label">
                <ArrowsDownUp size={14} aria-hidden="true" />
                Líquido do mês
              </span>
              <strong>{formatAOA(data.net_cents)}</strong>
            </article>
          </div>
          <div className="split">
            <div className="panel">
              <h2>Despesas por categoria</h2>
              <div className="chart-wrap">
                {chartData.length === 0 ? (
                  <p className="muted">Sem despesas neste mês.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: axis }}
                        axisLine={{ stroke: grid }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: axis }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: grid, opacity: 0.25 }}
                        contentStyle={{
                          background: surface,
                          border: `1px solid ${grid}`,
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                        formatter={(v) => formatAOA(Math.round(Number(v) * 100))}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { full?: string })?.full || ''
                        }
                      />
                      <Bar dataKey="value" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>Actividade recente</h2>
              <ul className="activity">
                {data.recent.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{t.category_name}</strong>
                      <span className="muted">{formatDateAO(t.occurred_on)}</span>
                    </div>
                    <span className={`amount ${t.type === 'income' ? 'pos' : 'neg'}`}>
                      {t.type === 'income' ? '+' : '−'}
                      {formatAOA(t.amount_cents)}
                    </span>
                  </li>
                ))}
                {data.recent.length === 0 && <li className="muted">Ainda sem movimentos.</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function TransactionsPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string; kind: string }>>(
    []
  );
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [filterType, setFilterType] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const q = filterType ? `?type=${filterType}` : '';
    const [tx, acc, cat] = await Promise.all([
      api.transactions(q),
      api.accounts(),
      api.categories(),
    ]);
    setItems(tx.transactions);
    setAccounts(acc.accounts);
    setCategories(cat.categories);
    if (!accountId && acc.accounts[0]) setAccountId(acc.accounts[0].id);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const filteredCats = categories.filter((c) => c.kind === type || c.kind === 'both');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const amount_cents = parseAOAInput(amount);
      await api.createTransaction({
        type,
        account_id: accountId,
        category_id: categoryId || filteredCats[0]?.id,
        amount_cents,
        occurred_on: date,
        notes: notes || null,
      });
      setAmount('');
      setNotes('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Transações</h1>
          <p className="muted">Receitas e despesas em centavos (AOA)</p>
        </div>
        <label className="inline-field">
          Filtrar
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todas</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
        </label>
      </header>
      <ErrorAlert message={error} />
      <form className="panel form-grid" onSubmit={onCreate}>
        <label>
          Tipo
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as 'income' | 'expense');
              setCategoryId(0);
            }}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>
        <label>
          Conta
          <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={categoryId || filteredCats[0]?.id || ''}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor (Kz)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="15000"
            required
          />
        </label>
        <label>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Notas
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          <Plus size={16} aria-hidden="true" />
          Adicionar
        </button>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th className="right">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="num">{formatDateAO(t.occurred_on)}</td>
                <td>{t.type === 'income' ? 'Receita' : 'Despesa'}</td>
                <td>{t.category_name}</td>
                <td>{t.account_name}</td>
                <td className={`right ${t.type === 'income' ? 'pos' : 'neg'}`}>
                  {formatAOA(t.amount_cents)}
                </td>
                <td className="right">
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={async () => {
                      await api.deleteTransaction(t.id);
                      await load();
                    }}
                  >
                    <Trash size={14} aria-hidden="true" />
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sem movimentos para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BudgetsPage() {
  const [ym, setYm] = useState(currentYearMonth());
  const [data, setData] = useState<BudgetsResponse | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; name: string; kind: string }>>(
    []
  );
  const [categoryId, setCategoryId] = useState(0);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [b, c] = await Promise.all([api.budgets(ym), api.categories()]);
    setData(b);
    setCategories(c.categories.filter((x) => x.kind === 'expense' || x.kind === 'both'));
    if (!categoryId && c.categories[0]) setCategoryId(c.categories[0].id);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    try {
      await api.upsertBudget({
        category_id: categoryId,
        year_month: ym,
        limit_cents: parseAOAInput(limit),
      });
      setLimit('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Orçamentos</h1>
          <p className="muted">Limites mensais por categoria</p>
        </div>
        <label className="inline-field">
          Mês
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
        </label>
      </header>
      <ErrorAlert message={error} />
      <form className="panel form-grid" onSubmit={onSave}>
        <label>
          Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Limite (Kz)
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="100000"
            required
          />
        </label>
        <button className="btn btn-primary" type="submit">
          <Plus size={16} aria-hidden="true" />
          Guardar
        </button>
      </form>
      <div className="budget-list">
        {(data?.budgets || []).map((b) => (
          <article key={b.id} className="panel budget-card">
            <header>
              <h2>{b.category_name}</h2>
              <span className="num">{b.percent_used}%</span>
            </header>
            <div
              className="bar"
              role="progressbar"
              aria-label={`Orçamento de ${b.category_name}`}
              aria-valuenow={b.percent_used}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="bar-fill"
                style={{ transform: `scaleX(${Math.min(100, b.percent_used) / 100})` }}
              />
            </div>
            <p>
              Utilizado {formatAOA(b.spent_cents)} de {formatAOA(b.limit_cents)} · Restante{' '}
              {formatAOA(b.remaining_cents)}
            </p>
          </article>
        ))}
        {data && data.budgets.length === 0 && (
          <p className="muted">Define o primeiro orçamento do mês.</p>
        )}
      </div>
    </section>
  );
}

export function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string; kind: string }>>(
    []
  );
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [list, acc, cat] = await Promise.all([api.recurring(), api.accounts(), api.categories()]);
    setRules(list.rules);
    setAccounts(acc.accounts);
    setCategories(cat.categories);
    if (!accountId && acc.accounts[0]) setAccountId(acc.accounts[0].id);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCats = categories.filter((c) => c.kind === type || c.kind === 'both');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('');
    try {
      await api.createRecurring({
        name,
        account_id: accountId,
        category_id: categoryId || filteredCats[0]?.id,
        type,
        amount_cents: parseAOAInput(amount),
        day_of_month: Number(dayOfMonth),
        start_date: startDate,
        end_date: endDate || null,
      });
      setName('');
      setAmount('');
      setEndDate('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onRun() {
    setError('');
    try {
      const r = await api.runRecurring();
      setStatus(
        r.created === 0
          ? 'Nada em atraso: todas as recorrências já estão lançadas.'
          : `${r.created} transação(ões) lançada(s).`
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Recorrências</h1>
          <p className="muted">Lançamentos mensais fixos: renda, salário, propinas</p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onRun}>
          <ArrowsClockwise size={16} aria-hidden="true" />
          Lançar em atraso
        </button>
      </header>
      <ErrorAlert message={error} />
      <div aria-live="polite">
        {status && (
          <div className="notice">
            <ArrowsClockwise size={18} aria-hidden="true" />
            <span>{status}</span>
          </div>
        )}
      </div>
      <form className="panel form-grid" onSubmit={onCreate}>
        <label>
          Descrição
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Renda da casa"
            required
            minLength={2}
          />
        </label>
        <label>
          Tipo
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as 'income' | 'expense');
              setCategoryId(0);
            }}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>
        <label>
          Conta
          <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor (Kz)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="150000"
            required
          />
        </label>
        <label>
          Dia do mês
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            required
          />
        </label>
        <label>
          Início
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <label>
          Fim (opcional)
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          <Plus size={16} aria-hidden="true" />
          Criar recorrência
        </button>
      </form>
      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Dia</th>
              <th className="right">Valor</th>
              <th>Próximo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={r.active ? undefined : 'row-muted'}>
                <td>
                  {r.name}
                  {!r.active && (
                    <>
                      {' '}
                      <span className="tag">
                        <Pause size={11} aria-hidden="true" />
                        Pausada
                      </span>
                    </>
                  )}
                </td>
                <td>
                  {r.category_name} · {r.account_name}
                </td>
                <td className="num">{r.day_of_month}</td>
                <td className={`right ${r.type === 'income' ? 'pos' : 'neg'}`}>
                  {r.type === 'income' ? '+' : '−'} {formatAOA(r.amount_cents)}
                </td>
                <td className="num">{r.next_occurrence ? formatDateAO(r.next_occurrence) : '—'}</td>
                <td className="right">
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={async () => {
                      await api.toggleRecurring(r.id, !r.active);
                      await load();
                    }}
                  >
                    {r.active ? (
                      <Pause size={14} aria-hidden="true" />
                    ) : (
                      <Play size={14} aria-hidden="true" />
                    )}
                    {r.active ? 'Pausar' : 'Retomar'}
                  </button>{' '}
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={async () => {
                      await api.deleteRecurring(r.id);
                      await load();
                    }}
                  >
                    <Trash size={14} aria-hidden="true" />
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sem recorrências. Cria a primeira (ex.: renda no dia 5).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  atingido: 'Atingido',
  em_dia: 'Em dia',
  em_risco: 'Em risco',
  sem_prazo: 'Sem prazo',
};

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contribution, setContribution] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  async function load() {
    const r = await api.goals();
    setGoals(r.goals);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createGoal({
        name,
        target_cents: parseAOAInput(target),
        deadline: deadline || null,
      });
      setName('');
      setTarget('');
      setDeadline('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onContribute(goalId: number) {
    setError('');
    try {
      await api.addGoalContribution(goalId, {
        amount_cents: parseAOAInput(contribution[goalId] ?? ''),
        occurred_on: new Date().toISOString().slice(0, 10),
      });
      setContribution((prev) => ({ ...prev, [goalId]: '' }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Objetivos</h1>
          <p className="muted">Metas de poupança e ritmo necessário</p>
        </div>
      </header>
      <ErrorAlert message={error} />
      <form className="panel form-grid" onSubmit={onCreate}>
        <label>
          Objetivo
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Comprar computador"
            required
            minLength={2}
          />
        </label>
        <label>
          Valor alvo (Kz)
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="600000"
            required
          />
        </label>
        <label>
          Prazo (opcional)
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          <Plus size={16} aria-hidden="true" />
          Criar objetivo
        </button>
      </form>
      <div className="budget-list">
        {goals.map((g) => (
          <article key={g.id} className="panel budget-card">
            <header>
              <h2>{g.name}</h2>
              <span className={`tag tag-${g.status}`}>{GOAL_STATUS_LABEL[g.status]}</span>
            </header>
            <div
              className="bar"
              role="progressbar"
              aria-label={`Progresso de ${g.name}`}
              aria-valuenow={g.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="bar-fill"
                style={{ transform: `scaleX(${Math.min(100, g.percent) / 100})` }}
              />
            </div>
            <p>
              {formatAOA(g.saved_cents)} de {formatAOA(g.target_cents)} · {g.percent}% · Falta{' '}
              {formatAOA(g.remainingCents)}
            </p>
            <p className="muted">
              {g.deadline ? `Prazo ${formatDateAO(g.deadline)}` : 'Sem prazo definido'}
              {g.requiredMonthlyCents != null && g.remainingCents > 0 && (
                <> · Precisas de {formatAOA(g.requiredMonthlyCents)}/mês</>
              )}
              {g.pace_cents != null && <> · Ritmo actual {formatAOA(g.pace_cents)}/mês</>}
            </p>
            <div className="goal-actions">
              <input
                value={contribution[g.id] ?? ''}
                onChange={(e) => setContribution((prev) => ({ ...prev, [g.id]: e.target.value }))}
                placeholder="Valor a depositar"
                aria-label={`Contribuição para ${g.name}`}
              />
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => onContribute(g.id)}
              >
                <Plus size={14} aria-hidden="true" />
                Contribuir
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={async () => {
                  await api.deleteGoal(g.id);
                  await load();
                }}
              >
                <Trash size={14} aria-hidden="true" />
                Apagar
              </button>
            </div>
          </article>
        ))}
        {goals.length === 0 && <p className="muted">Sem objetivos ainda. Cria o primeiro.</p>}
      </div>
    </section>
  );
}

export function ReportsPage() {
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Array<{ name: string; type: string; total_cents: number }>>([]);
  const [error, setError] = useState('');

  async function run(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    try {
      const r = await api.reportByCategory(from, to);
      setRows(r.rows);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">Totais por categoria no período</p>
        </div>
      </header>
      <form className="panel form-grid" onSubmit={run}>
        <label>
          De
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          <ChartBar size={16} aria-hidden="true" />
          Gerar
        </button>
      </form>
      <ErrorAlert message={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Tipo</th>
              <th className="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${r.type}-${i}`}>
                <td>{r.name}</td>
                <td>
                  {r.type === 'income' ? (
                    <span className="pos">
                      <TrendUp size={13} aria-hidden="true" /> Receita
                    </span>
                  ) : (
                    <span className="neg">
                      <Minus size={13} aria-hidden="true" /> Despesa
                    </span>
                  )}
                </td>
                <td className="right">{formatAOA(r.total_cents)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sem dados no período escolhido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { AppShell };
