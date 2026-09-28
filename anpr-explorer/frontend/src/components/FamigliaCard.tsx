import type { StatoFamigliaResponse } from '../types';

interface FamigliaCardProps {
  result: StatoFamigliaResponse;
  /** Avvia lo stato di famiglia attuale di un componente (usato per i superstiti di un deceduto). */
  onConsultaComponente?: (codiceFiscale: string) => void;
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT');
}

export default function FamigliaCard({ result, onConsultaComponente }: FamigliaCardProps) {
  const { decesso } = result;
  const count = result.componenti.length;
  const superstiti = result.componenti.filter((c) => !c.deceduto);
  const nucleoStorico = !!decesso && !decesso.erroreNucleoStorico;
  const mostraAzioni = nucleoStorico && !!onConsultaComponente;

  return (
    <div
      className="result-card"
      style={
        decesso
          ? { border: '1px solid #f5c2c7', borderLeft: '4px solid #dc3545' }
          : undefined
      }
    >
      <div className="result-card-header">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: decesso ? '#dc3545' : '#008055',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span className="title">Stato di famiglia</span>
        <span className="anpr-pill anpr-pill--info">
          {count} component{count !== 1 ? 'i' : 'e'}
        </span>
        {nucleoStorico && (
          <span className="anpr-pill anpr-pill--warn">Nucleo al {formatData(result.dataRiferimento)}</span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            color: '#6c757d',
            fontFamily: 'monospace',
          }}
        >
          ID ANPR: {result.idANPR}
        </span>
      </div>

      <div className="result-card-body">
        {decesso && (
          <div
            className="mb-4"
            style={{
              background: '#fff5f5',
              border: '1px solid #f5c2c7',
              color: '#a3223a',
              borderRadius: 16,
              padding: '0.8rem 1rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: '0.25rem' }}>
              Soggetto deceduto il {formatData(decesso.dataDecesso)}
            </div>
            {decesso.erroreNucleoStorico ? (
              <>
                ANPR non restituisce il nucleo familiare dei deceduti e l'interrogazione alla data del
                decesso non è riuscita: {decesso.erroreNucleoStorico}
              </>
            ) : superstiti.length === 0 ? (
              <>
                Il giorno precedente il decesso ({formatData(result.dataRiferimento)}) il soggetto risultava
                unico componente del nucleo familiare: non ci sono altri componenti rimasti.
              </>
            ) : (
              <>
                ANPR non restituisce il nucleo familiare dei deceduti: di seguito la famiglia com'era il giorno
                precedente il decesso ({formatData(result.dataRiferimento)}). Nel nucleo restavano{' '}
                <strong>
                  {superstiti.length} component{superstiti.length !== 1 ? 'i' : 'e'}
                </strong>
                . I legami sono riferiti all'intestatario della scheda a quella data; per la situazione di
                oggi usare «Famiglia attuale» sul singolo componente.
              </>
            )}
          </div>
        )}

        {count === 0 ? (
          <p className="text-muted mb-0" style={{ fontSize: '0.875rem' }}>
            Nessun componente trovato nella risposta.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="data-table w-100" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th>Cognome e nome</th>
                  <th>Codice fiscale</th>
                  <th>Data di nascita</th>
                  <th>Comune di nascita</th>
                  <th>Sesso</th>
                  <th>Legame</th>
                  <th>Stato</th>
                  {mostraAzioni && <th />}
                </tr>
              </thead>
              <tbody>
                {result.componenti.map((c, i) => (
                  <tr
                    key={c.idANPR || i}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: c.deceduto ? '#fff5f5' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      {c.cognome} {c.nome}
                    </td>
                    <td className="cf-mono">{c.codiceFiscale || '—'}</td>
                    <td>{formatData(c.dataNascita)}</td>
                    <td>{c.comuneNascita || '—'}</td>
                    <td>{c.sesso || '—'}</td>
                    <td>
                      <span className="anpr-pill anpr-pill--neutral">{c.legame || '—'}</span>
                    </td>
                    <td>
                      {c.deceduto ? (
                        <span className="anpr-pill anpr-pill--err">
                          Deceduto {formatData(c.dataDecesso)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {mostraAzioni && (
                      <td style={{ textAlign: 'right' }}>
                        {!c.deceduto && c.codiceFiscale && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', borderRadius: 999 }}
                            onClick={() => onConsultaComponente?.(c.codiceFiscale)}
                          >
                            Famiglia attuale
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
