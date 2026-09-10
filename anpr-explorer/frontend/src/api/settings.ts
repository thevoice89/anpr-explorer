import { apiClient } from './client';
import type { AnprServiceCode, PdndSettingsPublicView, SettingsInput } from '../types';

export async function getSettings(): Promise<PdndSettingsPublicView> {
  const { data } = await apiClient.get<PdndSettingsPublicView>('/settings');
  return data;
}

export async function saveSettings(input: SettingsInput): Promise<PdndSettingsPublicView> {
  const { data } = await apiClient.put<PdndSettingsPublicView>('/settings', input);
  return data;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

export async function testConnection(serviceCode: AnprServiceCode): Promise<TestConnectionResult> {
  const { data } = await apiClient.post<TestConnectionResult>('/settings/test', { serviceCode });
  return data;
}
