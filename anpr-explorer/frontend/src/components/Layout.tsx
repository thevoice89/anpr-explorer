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
      <header
        className="py-3"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(125deg, #003f87 0%, #0066cc 55%, #3aa0f5 100%)',
          borderRadius: '0 0 28px 28px',
          boxShadow: '0 18px 36px -22px rgba(0, 72, 150, 0.65)',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            right: -70,
            top: -130,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
            pointerEvents: 'none',
          }}
        />
        <Container style={{ position: 'relative', zIndex: 1 }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                <span className="anpr-ms" style={{ fontSize: 22, color: '#fff' }}>account_balance</span>
              </span>
              <span className="text-white fw-bold" style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                ANPR Explorer
              </span>
              <nav className="nav-pill-tab ms-2">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
                >
                  Consultazione
                </NavLink>
                {role === 'admin' && (
                  <>
                    <NavLink
                      to="/log-audit"
                      className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
                    >
                      Log audit
                    </NavLink>
                    <NavLink
                      to="/impostazioni"
                      className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
                    >
                      Impostazioni
                    </NavLink>
                  </>
                )}
              </nav>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="text-white" style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  {username}
                </span>
                <span className={`anpr-pill anpr-pill--${role === 'admin' ? 'solid' : 'solid-soft'}`}>
                  {role === 'admin' ? 'Admin' : 'Viewer'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  fontSize: '0.8rem',
                }}
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

      <footer className="py-4 anpr-footer">
        <span>ANPR Explorer — Ente Fruitore PDND &nbsp;·&nbsp; uso riservato agli operatori autorizzati</span>
      </footer>
    </div>
  );
}
