import { apiClient } from './client';
import type { ConsultaResidenzaResponse, StatoFamigliaResponse } from '../types';

export interface ConsultaResidenzaRequest {
  codiceFiscale: string;
  motivazione: string;
}

export async function consultaResidenza(
  payload: ConsultaResidenzaRequest
): Promise<ConsultaResidenzaResponse> {
  const { data } = await apiClient.post<ConsultaResidenzaResponse>('/anpr/consulta', payload);
  return data;
}

export async function consultaStatoFamiglia(
  payload: ConsultaResidenzaRequest
): Promise<StatoFamigliaResponse> {
  const { data } = await apiClient.post<StatoFamigliaResponse>('/anpr/stato-famiglia', payload);
  return data;
}
