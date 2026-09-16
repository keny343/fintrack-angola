import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
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
import { api, type BudgetsResponse, type Dashboard, type Transaction } from '../services/api';
import { currentYearMonth, formatAOA, formatDateAO, parseAOAInput } from '../utils/money';

function AppShell() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();

  if (loading) return <div className="shell center">A carregar…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">FinTrack</div>
        <p className="sidebar-user">{user.name}</p>
        <nav className="side-nav">
          <Link to="/app">Dashboard</Link>
          <Link to="/app/transactions">Transações</Link>
          <Link to="/app/budgets">Orçamentos</Link>
          <Link to="/app/reports">Relatórios</Link>
        </nav>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={async () => {
            await logout();
            nav('/');
          }}
        >
          Sair
        </button>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function DashboardPage() {
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
      {error && <div className="alert">{error}</div>}
      {data && (
        <>
          <div className="kpi-row">
            <article className="kpi">
              <span>Saldo</span>
              <strong>{formatAOA(data.balance_cents)}</strong>
            </article>
            <article className="kpi">
              <span>Receitas</span>
              <strong className="pos">{formatAOA(data.income_cents)}</strong>
            </article>
            <article className="kpi">
              <span>Despesas</span>
              <strong className="neg">{formatAOA(data.expense_cents)}</strong>
            </article>
            <article className="kpi">
              <span>Líquido do mês</span>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#d7e0dc" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v) => formatAOA(Math.round(Number(v) * 100))}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { full?: string })?.full || ''
                        }
                      />
                      <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
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
                    <span className={t.type === 'income' ? 'pos' : 'neg'}>
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

  const filteredCats = categories.filter(
    (c) => c.kind === type || c.kind === 'both'
  );

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
      {error && <div className="alert">{error}</div>}
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
          <select value={categoryId || filteredCats[0]?.id || ''} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor (Kz)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15000" required />
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
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{formatDateAO(t.occurred_on)}</td>
                <td>{t.type === 'income' ? 'Receita' : 'Despesa'}</td>
                <td>{t.category_name}</td>
                <td>{t.account_name}</td>
                <td className={t.type === 'income' ? 'pos' : 'neg'}>{formatAOA(t.amount_cents)}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={async () => {
                      await api.deleteTransaction(t.id);
                      await load();
                    }}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
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
      {error && <div className="alert">{error}</div>}
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
          <input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="100000" required />
        </label>
        <button className="btn btn-primary" type="submit">
          Guardar
        </button>
      </form>
      <div className="budget-list">
        {(data?.budgets || []).map((b) => (
          <article key={b.id} className="panel budget-card">
            <header>
              <h2>{b.category_name}</h2>
              <span>{b.percent_used}%</span>
            </header>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.min(100, b.percent_used)}%` }} />
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
          Gerar
        </button>
      </form>
      {error && <div className="alert">{error}</div>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${r.type}-${i}`}>
                <td>{r.name}</td>
                <td>{r.type === 'income' ? 'Receita' : 'Despesa'}</td>
                <td>{formatAOA(r.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { AppShell };
