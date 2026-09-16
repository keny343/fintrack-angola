import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LandingPage, LoginPage, RegisterPage } from './pages/AuthPages';
import {
  AppShell,
  BudgetsPage,
  DashboardPage,
  GoalsPage,
  RecurringPage,
  ReportsPage,
  TransactionsPage,
} from './pages/AppPages';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
