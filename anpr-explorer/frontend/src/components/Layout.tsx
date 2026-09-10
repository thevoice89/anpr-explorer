import { NavLink, Outlet } from 'react-router-dom';
import { Container } from 'design-react-kit';
import { logout } from '../api/auth';
import { useUser } from '../context/UserContext';

export default function Layout() {
  const { username, role } = useUser();

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <header style={{ background: '#0066cc', borderBottom: '3px solid #004fa3' }} className="py-2">
        <Container>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <span className="text-white fw-bold" style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>
                ANPR Explorer
              </span>
              <nav className="d-flex align-items-center gap-1">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `text-white text-decoration-none px-3 py-2 rounded-1 ${isActive ? 'fw-bold' : ''}`
                  }
                  style={({ isActive }) => ({
                    background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    fontSize: '0.875rem',
                  })}
                >
                  Consultazione
                </NavLink>
                {role === 'admin' && (
                  <>
                    <NavLink
                      to="/log-audit"
                      className={({ isActive }) =>
                        `text-white text-decoration-none px-3 py-2 rounded-1 ${isActive ? 'fw-bold' : ''}`
                      }
                      style={({ isActive }) => ({
                        background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                        fontSize: '0.875rem',
                      })}
                    >
                      Log audit
                    </NavLink>
                    <NavLink
                      to="/impostazioni"
                      className={({ isActive }) =>
                        `text-white text-decoration-none px-3 py-2 rounded-1 ${isActive ? 'fw-bold' : ''}`
                      }
                      style={({ isActive }) => ({
                        background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                        fontSize: '0.875rem',
                      })}
                    >
                      Impostazioni
                    </NavLink>
                  </>
                )}
              </nav>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="text-white" style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                  {username}
                </span>
                <span
                  style={{
                    background: role === 'admin' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '2px 7px',
                    borderRadius: '100px',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {role === 'admin' ? 'Admin' : 'Viewer'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', fontSize: '0.8rem' }}
                onClick={handleLogout}
              >
                Esci
              </button>
            </div>
          </div>
        </Container>
      </header>

      <main className="flex-grow-1 py-4">
        <Container>
          <Outlet />
        </Container>
      </main>

      <footer style={{ background: '#f0f3f8', borderTop: '1px solid #dee2e6' }} className="py-3 text-center">
        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
          ANPR Explorer — Ente Fruitore PDND &nbsp;·&nbsp; uso riservato agli operatori autorizzati
        </small>
      </footer>
    </div>
  );
}
