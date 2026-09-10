import type { StatoFamigliaResponse } from '../types';

interface FamigliaCardProps {
  result: StatoFamigliaResponse;
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT');
}

export default function FamigliaCard({ result }: FamigliaCardProps) {
  const count = result.componenti.length;

  return (
    <div className="result-card">
      <div className="result-card-header">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#008055',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span className="title">Stato di famiglia</span>
        <span
          style={{
            background: '#e7f0fb',
            color: '#0066cc',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '100px',
          }}
        >
          {count} componente{count !== 1 ? 'i' : ''}
        </span>
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
                      <span
                        style={{
                          background: '#f0f3f8',
                          color: '#17324d',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {c.legame || '—'}
                      </span>
                    </td>
                    <td>
                      {c.deceduto ? (
                        <span
                          style={{
                            background: '#dc3545',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          Deceduto {formatData(c.dataDecesso)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
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
