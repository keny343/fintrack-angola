import {
  ArrowsClockwise,
  ArrowsDownUp,
  ChartBar,
  Check,
  Flag,
  GithubLogo,
  LockKey,
  ShieldCheck,
  Target,
  TestTube,
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
    body: 'Lança movimentos por conta e categoria, filtra por período ou tipo e corrige o que estiver errado.',
  },
  {
    icon: Target,
    title: 'Orçamentos mensais',
    body: 'Define um limite por categoria e acompanha quanto já gastaste, quanto sobra e a percentagem usada.',
  },
  {
    icon: ArrowsClockwise,
    title: 'Recorrências',
    body: 'Renda, salário e propinas lançados automaticamente todos os meses — o dia 31 cai a 28 em Fevereiro, sem falhar meses.',
  },
  {
    icon: Flag,
    title: 'Objetivos de poupança',
    body: 'Diz quanto queres juntar e até quando. O sistema calcula quanto falta por mês e compara com o teu ritmo real.',
  },
  {
    icon: ChartBar,
    title: 'Relatórios',
    body: 'Totais por categoria em qualquer intervalo de datas, para perceberes para onde foi o dinheiro.',
  },
  {
    icon: ShieldCheck,
    title: 'Dados isolados',
    body: 'Cada conta só acede aos seus próprios dados, e isso é verificado por testes automáticos a cada alteração.',
  },
];

const PROOF: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: TestTube,
    title: '50 testes automáticos',
    body: 'Domínio e API, incluindo isolamento entre contas.',
  },
  {
    icon: LockKey,
    title: 'Sessão em cookie httpOnly',
    body: 'bcrypt, SQL parametrizado e limite de tentativas.',
  },
  {
    icon: ArrowsClockwise,
    title: 'CI em cada commit',
    body: 'Lint, typecheck, testes e build no GitHub Actions.',
  },
  {
    icon: GithubLogo,
    title: 'Código aberto',
    body: 'Sem publicidade e sem venda de dados.',
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
            <a className="nav-hide" href="#kwanza">
              Kwanza
            </a>
            <a className="nav-hide" href="#seguranca">
              Segurança
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
              Projeto de engenharia aberto — sem publicidade, sem venda de dados.
            </p>
          </div>
          <aside className="hero-facts stagger">
            <div>
              <b>Kz</b>
              <p>
                Montantes inteiros em centavos e formatação pt-AO, do formulário à base de dados.
              </p>
            </div>
            <div>
              <b>6 áreas</b>
              <p>
                Transações, orçamentos, recorrências, objetivos, relatórios e dashboard, completas.
              </p>
            </div>
            <div>
              <b>50 testes</b>
              <p>
                Suite automática que corre a cada alteração, incluindo isolamento entre contas.
              </p>
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
          {PROOF.map(({ icon: ProofIcon, title, body }) => (
            <div className="proof-item" key={title}>
              <ProofIcon size={20} aria-hidden="true" />
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
            <p className="eyebrow">O que já funciona</p>
            <h2>Seis coisas bem feitas, em vez de vinte a meio.</h2>
            <p>
              Cada área abaixo está implementada de ponta a ponta — interface, API e base de dados —
              e coberta por testes automáticos.
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

      <section className="lp-section alt" id="kwanza">
        <div className="lp-inner">
          <div className="section-head">
            <p className="eyebrow">Porque o Kwanza precisa de cuidado</p>
            <h2>Valores guardados ao centavo, não em vírgula flutuante.</h2>
            <p>
              Muitas aplicações guardam dinheiro como número decimal e acumulam erros de
              arredondamento. Aqui os montantes são inteiros em centavos, do formulário até à base
              de dados.
            </p>
          </div>
          <Reveal>
            <div className="step-grid">
              <div className="step">
                <b>01</b>
                <h3>Escreves em Kwanzas</h3>
                <p>
                  Introduzes <strong>150.000,50</strong> como estás habituado, com vírgula decimal e
                  separador de milhares.
                </p>
              </div>
              <div className="step">
                <b>02</b>
                <h3>Guardamos em centavos</h3>
                <p>
                  O valor viaja e é gravado como <strong>15 000 050</strong> centavos — um inteiro,
                  sem arredondamentos silenciosos.
                </p>
              </div>
              <div className="step">
                <b>03</b>
                <h3>Lês em pt-AO</h3>
                <p>
                  Volta formatado como <strong>150 000,50 Kz</strong>, com datas em dd/mm/aaaa e
                  números alinhados nas tabelas.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section" id="seguranca">
        <div className="lp-inner">
          <div className="detail-split">
            <div>
              <p className="eyebrow">Segurança e confiança</p>
              <h2>As tuas finanças são privadas por construção.</h2>
              <ul className="check-list">
                <li>
                  <Check size={16} aria-hidden="true" />
                  Sessão em cookie httpOnly assinado, nunca acessível por JavaScript.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Palavras-passe guardadas com bcrypt, jamais em texto simples.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Consultas SQL parametrizadas, sempre filtradas pelo utilizador da sessão.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Limite de tentativas no login e cabeçalhos de segurança HTTP.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Registo de auditoria das ações importantes da conta.
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  Testes que tentam aceder aos dados de outra conta e têm de falhar.
                </li>
              </ul>
            </div>
            <Reveal>
              <div className="code-card">
                <div>
                  <span className="c-com">// todas as consultas filtram pela sessão</span>
                </div>
                <div>
                  <span className="c-key">SELECT</span> id, amount_cents, occurred_on
                </div>
                <div>
                  <span className="c-key">FROM</span> transactions
                </div>
                <div>
                  <span className="c-key">WHERE</span> user_id = <span className="c-str">$1</span>
                </div>
                <div>&nbsp;</div>
                <div>
                  <span className="c-com">// e um teste garante o isolamento</span>
                </div>
                <div>
                  expect(intruder.get(<span className="c-str">'/api/transactions'</span>))
                </div>
                <div>
                  &nbsp;&nbsp;.toHaveLength(<span className="c-str">0</span>)
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="lp-inner">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Construído com
          </p>
          <div className="stack-strip">
            {[
              'React',
              'TypeScript',
              'Vite',
              'Express',
              'PostgreSQL',
              'Zod',
              'Vitest',
              'Docker',
              'GitHub Actions',
            ].map((t) => (
              <span className="chip" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-cta">
            <h2>Começa pelo mês em curso.</h2>
            <p>
              Cria a conta, lança o salário e duas despesas fixas. Em poucos minutos tens o teu
              primeiro dashboard em Kwanzas.
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
              Os teus dados só são acessíveis pela tua sessão.
            </li>
          </ul>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Projeto de engenharia por Adnírcio Inocêncio
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
