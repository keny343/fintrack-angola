import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';

// Split by route so landing visitors never download the chart library.
const LandingPage = lazy(() =>
  import('./pages/AuthPages').then((m) => ({ default: m.LandingPage }))
);
const LoginPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/AuthPages').then((m) => ({ default: m.RegisterPage }))
);
const AppShell = lazy(() => import('./pages/AppPages').then((m) => ({ default: m.AppShell })));
const DashboardPage = lazy(() =>
  import('./pages/AppPages').then((m) => ({ default: m.DashboardPage }))
);
const TransactionsPage = lazy(() =>
  import('./pages/AppPages').then((m) => ({ default: m.TransactionsPage }))
);
const BudgetsPage = lazy(() =>
  import('./pages/AppPages').then((m) => ({ default: m.BudgetsPage }))
);
const RecurringPage = lazy(() =>
  import('./pages/AppPages').then((m) => ({ default: m.RecurringPage }))
);
const GoalsPage = lazy(() => import('./pages/AppPages').then((m) => ({ default: m.GoalsPage })));
const ReportsPage = lazy(() =>
  import('./pages/AppPages').then((m) => ({ default: m.ReportsPage }))
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="shell center">A carregar…</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="recurring" element={<RecurringPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
