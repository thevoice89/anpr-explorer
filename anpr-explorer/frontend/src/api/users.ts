import { apiClient } from './client';
import type { User, UserRole } from '../types';

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: UserRole;
}): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: { role?: UserRole; password?: string }
): Promise<User> {
  const { data } = await apiClient.put<User>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
