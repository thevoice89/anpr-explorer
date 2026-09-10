import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser, type SessionUser } from '../api/auth';
import { UserContext } from '../context/UserContext';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'forbidden';

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser()
      .then((u) => {
        if (!isMounted) return;
        if (adminOnly && u.role !== 'admin') {
          setStatus('forbidden');
        } else {
          setUser(u);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (isMounted) setStatus('unauthenticated');
      });
    return () => { isMounted = false; };
  }, [adminOnly]);

  if (status === 'loading') {
    return <div className="text-center mt-5">Verifica sessione in corso…</div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  if (status === 'forbidden') {
    return <Navigate to="/" replace />;
  }

  return (
    <UserContext.Provider value={{ username: user!.username, role: user!.role }}>
      {children}
    </UserContext.Provider>
  );
}
