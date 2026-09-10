import { useEffect, useState } from 'react';
import { getAuditLog, type AuditRow } from '../api/audit';

const PAGE_SIZE = 50;

function formatTs(ts: string): string {
  return new Date(ts + 'Z').toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAuditLog(page, PAGE_SIZE)
      .then((res) => { setRows(res.rows); setTotal(res.total); })
      .catch(() => setError('Impossibile caricare il log audit'))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Intestazione */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#17324d' }}>
            Log audit
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>
            Tutte le operazioni degli operatori, ordinate dalla più recente
          </p>
        </div>
        <div
          style={{
            background: '#e7f0fb',
            color: '#0066cc',
            fontWeight: 700,
            fontSize: '0.8rem',
            padding: '0.4rem 1rem',
            borderRadius: '100px',
          }}
        >
          {total.toLocaleString('it-IT')} operazioni
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded" style={{ background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 6, overflow: 'hidden' }}>
        {loading ? (
          <div className="text-center py-5 text-muted" style={{ fontSize: '0.875rem' }}>
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Caricamento…
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table w-100" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Operatore</th>
                  <th>Servizio</th>
                  <th>Motivazione</th>
                  <th>CF</th>
                  <th>Esito</th>
                  <th>Errore</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6c757d', fontSize: '0.875rem' }}>
                      Nessuna operazione registrata
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ whiteSpace: 'nowrap', color: '#6c757d', fontSize: '0.8rem' }}>
                      {formatTs(r.timestamp)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.operatore}</td>
                    <td>
                      <span style={{ background: '#f0f3f8', color: '#17324d', fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>
                        {r.servizio}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.motivazione ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="cf-mono" style={{ fontSize: '0.8rem' }}>{r.cfMascherato ?? '—'}</td>
                    <td>
                      {r.esito === 'OK'
                        ? <span className="badge-ok">OK</span>
                        : <span className="badge-err">ERRORE</span>}
                    </td>
                    <td style={{ color: '#842029', fontSize: '0.8rem' }}>{r.dettaglioErrore ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{ borderTop: '1px solid #dee2e6', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}
          >
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ fontSize: '0.8rem' }}
            >
              ‹ Precedente
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
              Pagina {page} di {totalPages} &nbsp;·&nbsp; {total} totali
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ fontSize: '0.8rem' }}
            >
              Successiva ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
