import type { ConsultaResidenzaResponse } from '../types';

interface ResultCardProps {
  result: ConsultaResidenzaResponse;
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT');
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}
function Field({ label, value, mono }: FieldProps) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className={`field-value${mono ? ' mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

export default function ResultCard({ result }: ResultCardProps) {
  const { deceduto } = result;
  return (
    <div
      className="result-card"
      style={
        deceduto
          ? {
              border: '1px solid #f5c2c7',
              borderLeft: '4px solid #dc3545',
              background: '#fff5f5',
            }
          : undefined
      }
    >
      <div className="result-card-header">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: deceduto ? '#dc3545' : '#008055',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span className="title">Accertamento residenza</span>
        {deceduto && <span className="anpr-pill anpr-pill--err">Deceduto</span>}
        {result.isAIRE && <span className="anpr-pill anpr-pill--info">AIRE</span>}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            color: '#6c757d',
            fontFamily: 'monospace',
            textAlign: 'right',
          }}
        >
          ID ANPR: {result.idANPR}
          {result.idOperazioneANPR && (
            <>
              <br />
              Rif. operazione: {result.idOperazioneANPR}
            </>
          )}
        </span>
      </div>

      <div className="result-card-body">
        {deceduto && (
          <div
            className="mb-4"
            style={{
              background: '#dc3545',
              color: '#fff',
              borderRadius: 16,
              padding: '0.7rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Soggetto deceduto il {formatData(result.dataDecesso)} — i dati di residenza sottostanti sono l'ultima situazione anagrafica registrata prima del decesso.
          </div>
        )}

        {/* Anagrafica */}
        <div className="section-title">Dati anagrafici</div>
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <Field label="Cognome" value={result.cognome} />
          </div>
          <div className="col-6 col-md-3">
            <Field label="Nome" value={result.nome} />
          </div>
          <div className="col-6 col-md-2">
            <Field label="Sesso" value={result.sesso} />
          </div>
          <div className="col-6 col-md-4">
            <Field label="Data di nascita" value={formatData(result.dataNascita)} />
          </div>
          <div className="col-6 col-md-5">
            <Field label="Comune di nascita" value={result.comuneNascita} />
          </div>
          <div className="col-6 col-md-4">
            <Field label="Codice fiscale" value={result.codiceFiscale} mono />
          </div>
        </div>

        {/* Residenza */}
        <div className="section-title">
          {result.isAIRE ? 'Residenza estera (AIRE)' : 'Residenza attuale'}
        </div>
        <div className="row g-3">
          <div className="col-md-5">
            <Field
              label={result.isAIRE ? 'Località / Stato' : 'Comune'}
              value={result.comune}
            />
          </div>
          <div className="col-md-5">
            <Field
              label={result.isAIRE ? 'Indirizzo estero' : 'Indirizzo'}
              value={result.indirizzo}
            />
          </div>
          <div className="col-md-2">
            <Field label="Dal" value={formatData(result.dataDecorrenza)} />
          </div>
        </div>

        {/* Storico residenze */}
        {result.storicoResidenze.length > 0 && (
          <div className="mt-4">
            <div className="section-title">Storico residenze</div>
            <div className="table-responsive">
              <table className="data-table w-100" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                    <th>Comune</th>
                    <th>Indirizzo</th>
                    <th>Dal</th>
                    <th>Al</th>
                  </tr>
                </thead>
                <tbody>
                  {result.storicoResidenze.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td>{r.comune || '—'}</td>
                      <td>{r.indirizzo || '—'}</td>
                      <td>{formatData(r.dataDecorrenza)}</td>
                      <td>{formatData(r.dataFine)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
