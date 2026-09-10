import { apiClient } from './client';
import type { UserRole } from '../types';

export interface SessionUser {
  username: string;
  role: UserRole;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const { data } = await apiClient.post<SessionUser>('/login', { username, password });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/logout');
}

export async function getCurrentUser(): Promise<SessionUser> {
  const { data } = await apiClient.get<SessionUser>('/me');
  return data;
}
