import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="shell landing">
      <header className="landing-top">
        <span className="brand">FinTrack Angola</span>
        <nav>
          <Link to="/login">Entrar</Link>
          <Link className="btn btn-primary" to="/register">
            Criar conta
          </Link>
        </nav>
      </header>
      <main className="landing-hero">
        <p className="eyebrow">Gestão financeira pessoal · AOA/Kz</p>
        <h1>Controlo claro das tuas receitas e despesas em Kwanza.</h1>
        <p className="lede">
          Categorias locais, orçamentos mensais, dashboard e relatórios — modelado para o dia a dia
          em Angola, sem clutter de fintech estrangeira.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/register">
            Começar
          </Link>
          <Link className="btn btn-ghost" to="/login">
            Já tenho conta
          </Link>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav('/app');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Entrar</h1>
        <p className="muted">Acede ao teu painel FinTrack.</p>
        {error && <div className="alert">{error}</div>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Palavra-passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'A entrar…' : 'Entrar'}
        </button>
        <p className="muted">
          Sem conta? <Link to="/register">Registar</Link>
        </p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(name, email, password);
      nav('/app');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Criar conta</h1>
        <p className="muted">Começa a organizar as tuas finanças em Kz.</p>
        {error && <div className="alert">{error}</div>}
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Palavra-passe (≥8)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'A criar…' : 'Registar'}
        </button>
        <p className="muted">
          Já tens conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
