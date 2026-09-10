import { apiClient } from './client';

export interface AuditRow {
  id: number;
  timestamp: string;
  operatore: string;
  servizio: string;
  modalita: string | null;
  motivazione: string | null;
  esito: 'OK' | 'ERRORE';
  dettaglioErrore: string | null;
  cfMascherato: string | null;
}

export interface AuditPage {
  rows: AuditRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getAuditLog(page = 1, limit = 50): Promise<AuditPage> {
  const { data } = await apiClient.get<AuditPage>('/audit', { params: { page, limit } });
  return data;
}
