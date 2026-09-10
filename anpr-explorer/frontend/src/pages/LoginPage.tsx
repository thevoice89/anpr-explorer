import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Credenziali non valide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="d-flex justify-content-center align-items-center min-vh-100"
      style={{ background: '#f0f3f8' }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="login-card">
          <div className="login-card-header">
            <div
              style={{
                width: 44,
                height: 44,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem',
                fontSize: '1.4rem',
              }}
            >
              🏛️
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
              ANPR Explorer
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.75, marginTop: '0.25rem' }}>
              Accesso operatori autorizzati
            </div>
          </div>

          <div className="login-card-body">
            {error && (
              <div
                className="mb-3 p-2 rounded"
                style={{
                  background: '#f8d7da',
                  color: '#842029',
                  fontSize: '0.875rem',
                  border: '1px solid #f5c2c7',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#17324d', marginBottom: '0.35rem', display: 'block' }}>
                  Nome utente
                </label>
                <input
                  id="username"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              <div className="mb-4">
                <label htmlFor="password" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#17324d', marginBottom: '0.35rem', display: 'block' }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              <button
                type="submit"
                className="btn w-100"
                disabled={loading}
                style={{ background: '#0066cc', color: '#fff', fontWeight: 600, fontSize: '0.9rem', padding: '0.5rem' }}
              >
                {loading ? 'Accesso in corso…' : 'Accedi'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-3 text-muted" style={{ fontSize: '0.72rem' }}>
          Ente Fruitore PDND · uso riservato agli operatori autorizzati
        </p>
      </div>
    </div>
  );
}
