import { createContext, useContext } from 'react';
import type { UserRole } from '../types';

export interface UserContextValue {
  username: string;
  role: UserRole;
}

export const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser deve essere usato dentro ProtectedRoute');
  return ctx;
}
