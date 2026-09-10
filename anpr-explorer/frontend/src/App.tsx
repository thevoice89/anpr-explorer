import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import AuditPage from './pages/AuditPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Rotte per tutti gli utenti autenticati */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<SearchPage />} />
      </Route>

      {/* Rotte riservate agli amministratori */}
      <Route
        element={
          <ProtectedRoute adminOnly>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/impostazioni" element={<SettingsPage />} />
        <Route path="/log-audit" element={<AuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
