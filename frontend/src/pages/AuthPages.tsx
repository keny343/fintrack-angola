import {
  ArrowsClockwise,
  ArrowsDownUp,
  ChartBar,
  Check,
  Coins,
  Flag,
  LockKey,
  MapPin,
  Target,
  type Icon,
} from '@phosphor-icons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Reveal } from '../components/Reveal';
import { ThemeToggle } from '../components/ThemeToggle';

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className="brand">
      <span className={large ? 'brand-mark lg' : 'brand-mark'} aria-hidden="true">
        Kz
      </span>
      FinTrack <span className="muted">Angola</span>
    </span>
  );
}

/** Static preview of the real dashboard, used as the landing hero visual. */
function ProductPreview() {
  return (
    <div className="lp-preview">
      <div className="preview-bar">
        <i className="preview-dot" />
        <i className="preview-dot" />
        <i className="preview-dot" />
        <span className="preview-title">fintrack.ao — Dashboard · Setembro 2026</span>
      </div>
      <div className="preview-body">
        <div className="preview-kpis">
          <div className="preview-kpi">
            <small>Saldo</small>
            <b>300 000,00 Kz</b>
          </div>
          <div className="preview-kpi">
            <small>Receitas</small>
            <b className="pos">450 000,00 Kz</b>
          </div>
          <div className="preview-kpi">
            <small>Despesas</small>
            <b className="neg">150 000,00 Kz</b>
          </div>
          <div className="preview-kpi">
            <small>Líquido</small>
            <b>300 000,00 Kz</b>
          </div>
        </div>
        <div className="preview-split">
          <div className="preview-chart">
            <span className="preview-label">Despesas por categoria</span>
            <div className="preview-chart-bars">
              <i style={{ height: '100%' }} />
              <i style={{ height: '62%' }} />
              <i style={{ height: '45%' }} />
              <i style={{ height: '30%' }} />
              <i style={{ height: '22%' }} />
              <i style={{ height: '14%' }} />
            </div>
          </div>
          <div className="preview-list">
            <span className="preview-label">Actividade recente</span>
            <div className="preview-row">
              <span>Habitação</span>
              <span className="neg">− 150 000,00</span>
            </div>
            <div className="preview-row">
              <span>Salário</span>
              <span className="pos">+ 450 000,00</span>
            </div>
            <div className="preview-row">
              <span>Propinas</span>
              <span className="neg">− 80 000,00</span>
            </div>
            <div className="preview-row">
              <span>Energia</span>
              <span className="neg">− 25 000,00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: ArrowsDownUp,
    title: 'Receitas e despesas',
    body: 'Lança em segundos o que entra e o que sai, com as categorias do teu dia a dia.',
  },
  {
    icon: Target,
    title: 'Orçamentos mensais',
    body: 'Define quanto queres gastar em cada categoria e vê quanto já foi e quanto ainda sobra.',
  },
  {
    icon: ArrowsClockwise,
    title: 'Despesas que repetem',
    body: 'Renda, salário e propinas entram sozinhos todos os meses. Não tens de te lembrar.',
  },
  {
    icon: Flag,
    title: 'Objetivos de poupança',
    body: 'Diz quanto queres juntar e até quando. Mostramos-te quanto precisas de pôr de lado por mês.',
  },
  {
    icon: ChartBar,
    title: 'Para onde foi o dinheiro',
    body: 'Escolhe um período e vê o total de cada categoria, do mês passado ou do ano inteiro.',
  },
  {
    icon: Coins,
    title: 'Sempre em Kwanzas',
    body: 'Valores exactos ao centavo e datas em dd/mm/aaaa, como escreves no dia a dia.',
  },
];

const BENEFITS: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: Coins,
    title: 'Contas certas ao centavo',
    body: 'Sem arredondamentos que não percebes.',
  },
  {
    icon: MapPin,
    title: 'Pensado para Angola',
    body: 'Propinas, energia, água, transporte e renda.',
  },
  {
    icon: LockKey,
    title: 'Só tu vês as tuas contas',
    body: 'Sem publicidade e sem venda de dados.',
  },
  {
    icon: Check,
    title: 'Pronto em minutos',
    body: 'Cria a conta e lança o salário do mês.',
  },
];

export function LandingPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <BrandMark />
          <nav>
            <a className="nav-hide" href="#funcionalidades">
              Funcionalidades
            </a>
            <a className="nav-hide" href="#como-funciona">
              Como funciona
            </a>
            <a className="nav-hide" href="#privacidade">
              Privacidade
            </a>
            <ThemeToggle />
            <Link to="/login">Entrar</Link>
            <Link className="btn btn-primary btn-sm" to="/register">
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-inner lp-hero-grid">
          <div>
            <p className="eyebrow">Finanças pessoais · Angola · AOA/Kz</p>
            <h1>O teu dinheiro em Kwanzas, com contas que batem certo.</h1>
            <p className="lede">
              Registas receitas e despesas, defines orçamentos e objetivos, e vês para onde vai o
              salário. Feito para o dia a dia em Angola: categorias locais, datas em dd/mm/aaaa e
              valores sempre ao centavo.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary" to="/register">
                Criar conta gratuita
              </Link>
              <Link className="btn btn-ghost" to="/login">
                Já tenho conta
              </Link>
            </div>
            <p className="hero-note">
              <Check size={16} aria-hidden="true" />
              Gratuito, sem publicidade e sem venda de dados.
            </p>
          </div>
          <aside className="hero-facts stagger">
            <div>
              <b>
                <Coins size={18} aria-hidden="true" />
                Tudo em Kwanzas
              </b>
              <p>Escreves 150.000,50 como sempre escreveste e as contas batem certo.</p>
            </div>
            <div>
              <b>
                <ArrowsClockwise size={18} aria-hidden="true" />
                Contas fixas automáticas
              </b>
              <p>A renda e o salário entram todos os meses sem tu fazeres nada.</p>
            </div>
            <div>
              <b>
                <Flag size={18} aria-hidden="true" />
                Objetivos com prazo
              </b>
              <p>Sabes quanto poupar por mês para chegares onde queres.</p>
            </div>
          </aside>
        </div>
      </section>

      <div className="lp-preview-wrap">
        <Reveal>
          <ProductPreview />
        </Reveal>
      </div>

      <section className="proof">
        <div className="lp-inner proof-grid">
          {BENEFITS.map(({ icon: BenefitIcon, title, body }) => (
            <div className="proof-item" key={title}>
              <BenefitIcon size={20} aria-hidden="true" />
              <span>
                <b>{title}</b>
                {body}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="funcionalidades">
        <div className="lp-inner">
          <div className="section-head">
            <p className="eyebrow">O que podes fazer</p>
            <h2>Tudo o que precisas para controlar o mês.</h2>
            <p>
              Do salário que entra ao objetivo que queres alcançar, num só lugar e em Kwanzas.
            </p>
          </div>
          <Reveal>
            <div className="feature-grid stagger">
              {FEATURES.map(({ icon: FeatureIcon, title, body }) => (
                <article className="feature-card" key={title}>
                  <span className="feature-icon">
                    <FeatureIcon size={20} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section alt" id="como-funciona">
        <div className="lp-inner">
          <div className="section-head">
            <p className="eyebrow">Como funciona</p>
            <h2>Três passos e já vês o teu mês.</h2>
            <p>
              Não precisas de saber nada de contabilidade nem de importar ficheiros para começar.
            </p>
          </div>
          <Reveal>
            <div className="step-grid">
              <div className="step">
                <b>01</b>
                <h3>Cria a tua conta</h3>
                <p>
                  Nome, email e palavra-passe. As categorias do dia a dia já vêm prontas a usar.
                </p>
              </div>
              <div className="step">
                <b>02</b>
                <h3>Lança o salário e as contas fixas</h3>
                <p>
                  A renda, as propinas e a luz que pagas todos os meses passam a entrar sozinhas.
                </p>
              </div>
              <div className="step">
                <b>03</b>
                <h3>Acompanha e decide</h3>
                <p>
                  Vês o saldo, quanto já gastaste em cada categoria e quanto falta para o teu
                  objetivo.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section" id="privacidade">
        <div className="lp-inner">
          <div className="detail-split">
            <div>
              <p className="eyebrow">Privacidade</p>
              <h2>As tuas contas são só tuas.</h2>
              <ul className="check-list">
                <li>
                  <Check size={16} aria-hidden="true" />
                  Ninguém além de ti vê o que ganhas ou onde gastas.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Não vendemos nem partilhamos os teus dados com terceiros.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Não há publicidade dentro da aplicação.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Apagas qualquer movimento, orçamento ou objetivo quando quiseres.
                </li>
              </ul>
            </div>
            <Reveal>
              <div className="assurance">
                <span className="feature-icon">
                  <LockKey size={20} aria-hidden="true" />
                </span>
                <h3>Entras só com a tua palavra-passe</h3>
                <p>
                  A tua conta é protegida por palavra-passe e a sessão termina quando saíres. Nunca
                  pedimos dados do teu banco nem acesso à tua conta bancária.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-cta">
            <h2>Começa pelo mês em curso.</h2>
            <p>
              Cria a conta, lança o salário e duas despesas fixas. Em poucos minutos já vês o teu
              resumo do mês em Kwanzas.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary" to="/register">
                Criar conta
              </Link>
              <Link className="btn btn-ghost" to="/login">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span>FinTrack Angola · gestão financeira pessoal em AOA</span>
          <span>
            Desenvolvido por{' '}
            <a className="link" href="https://github.com/keny343" target="_blank" rel="noreferrer">
              Adnírcio Inocêncio
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="sidebar-top">
          <Link to="/">
            <BrandMark large />
          </Link>
          <ThemeToggle />
        </div>
        <div>
          <h2>Controlo claro das tuas contas em Kwanzas.</h2>
          <p>
            Dashboard do mês, orçamentos por categoria, recorrências automáticas e objetivos de
            poupança — tudo com valores ao centavo.
          </p>
          <ul className="auth-points">
            <li>
              <Check size={16} aria-hidden="true" />
              Categorias pensadas para Angola: propinas, energia, água, transporte.
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              Renda e salário lançados sozinhos todos os meses.
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              Só tu vês as tuas contas. Sem publicidade.
            </li>
          </ul>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Feito em Angola por Adnírcio Inocêncio
        </p>
      </aside>
      <main className="auth-panel">{children}</main>
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
    <AuthLayout>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Entrar</h1>
        <p className="muted">Acede ao teu painel FinTrack.</p>
        <div aria-live="polite">{error && <div className="alert">{error}</div>}</div>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Palavra-passe
          <input
            type="password"
            autoComplete="current-password"
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
          Sem conta?{' '}
          <Link className="link" to="/register">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
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
    <AuthLayout>
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Criar conta</h1>
        <p className="muted">Começa a organizar as tuas finanças em Kz.</p>
        <div aria-live="polite">{error && <div className="alert">{error}</div>}</div>
        <label>
          Nome
          <input
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Palavra-passe (mínimo 8 caracteres)
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'A criar…' : 'Criar conta'}
        </button>
        <p className="muted">
          Já tens conta?{' '}
          <Link className="link" to="/login">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
