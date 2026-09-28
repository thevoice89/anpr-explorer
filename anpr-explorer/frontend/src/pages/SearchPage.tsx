import { useState, type FormEvent } from 'react';
import { Container } from 'design-react-kit';
import ResultCard from '../components/ResultCard';
import FamigliaCard from '../components/FamigliaCard';
import { consultaResidenza, consultaStatoFamiglia } from '../api/anpr';
import type { ConsultaResidenzaResponse, StatoFamigliaResponse } from '../types';

const CF_REGEX = /^[A-Za-z0-9]{16}$/;

type Modalita = 'residenza' | 'famiglia';

type SearchResult =
  | { modalita: 'residenza'; data: ConsultaResidenzaResponse }
  | { modalita: 'famiglia'; data: StatoFamigliaResponse };

function extractErrorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? 'Errore durante la ricerca';
}

export default function SearchPage() {
  const [modalita, setModalita] = useState<Modalita>('residenza');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [motivazione, setMotivazione] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  function selectModalita(next: Modalita) {
    setModalita(next);
    setResult(null);
    setError(null);
  }

  function resetForm() {
    setCodiceFiscale('');
    setMotivazione('');
    setResult(null);
    setError(null);
  }

  async function cerca(tipo: Modalita, cf: string) {
    setError(null);
    setResult(null);

    if (!CF_REGEX.test(cf)) {
      setError('Il codice fiscale deve essere di 16 caratteri alfanumerici');
      return;
    }
    if (!motivazione.trim()) {
      setError('Indicare la motivazione/numero pratica per la tracciatura');
      return;
    }

    setLoading(true);
    try {
      if (tipo === 'residenza') {
        const data = await consultaResidenza({ codiceFiscale: cf, motivazione });
        setResult({ modalita: 'residenza', data });
      } else {
        const data = await consultaStatoFamiglia({ codiceFiscale: cf, motivazione });
        setResult({ modalita: 'famiglia', data });
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void cerca(modalita, codiceFiscale);
  }

  /** Dal nucleo di un deceduto: stato di famiglia attuale di un componente, stessa motivazione. */
  function consultaComponente(cf: string) {
    setCodiceFiscale(cf);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void cerca('famiglia', cf);
  }

  return (
    <Container>
      <div className="anpr-hero mb-4">
        <span className="anpr-hero__icon">
          <span className="anpr-ms">travel_explore</span>
        </span>
        <div className="anpr-hero__text">
          <div className="anpr-hero__title">Consultazione ANPR</div>
          <div className="anpr-hero__subtitle">
            Interrogazione in tempo reale dell'Anagrafe Nazionale della Popolazione Residente via PDND
          </div>
        </div>
      </div>

      <div className="search-card">
        {/* Selezione tipo consultazione */}
        <div className="consult-tabs mb-4">
          <button
            type="button"
            className={modalita === 'residenza' ? 'active' : ''}
            onClick={() => selectModalita('residenza')}
          >
            Accertamento residenza
          </button>
          <button
            type="button"
            className={modalita === 'famiglia' ? 'active' : ''}
            onClick={() => selectModalita('famiglia')}
          >
            Stato di famiglia
          </button>
        </div>

        {error && (
          <div
            className="mb-3 p-3"
            style={{ background: '#fde8eb', color: '#a3223a', fontSize: '0.875rem', border: '1px solid #f5c2c7', borderRadius: 16 }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-3 mb-3">
            <div className="col-md-5">
              <label
                htmlFor="codiceFiscale"
                style={{ fontSize: '0.78rem', fontWeight: 700, color: '#17324d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block' }}
              >
                Codice fiscale
              </label>
              <input
                id="codiceFiscale"
                className="form-control cf-mono"
                value={codiceFiscale}
                onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="RSSMRA80A01H501U"
                required
              />
            </div>
            <div className="col-md-7">
              <label
                htmlFor="motivazione"
                style={{ fontSize: '0.78rem', fontWeight: 700, color: '#17324d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block' }}
              >
                Motivazione / numero pratica
              </label>
              <input
                id="motivazione"
                className="form-control"
                value={motivazione}
                onChange={(e) => setMotivazione(e.target.value)}
                placeholder="Pratica n. 2026/123 — Ufficio Tributi"
                required
                style={{ fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>
            La motivazione è registrata nel log di audit e non viene inviata ad ANPR.
          </p>

          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn anpr-btn-primary"
              disabled={loading}
              style={{ fontSize: '0.875rem', minWidth: 100 }}
            >
              {loading ? (
                <span className="d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" />
                  Ricerca…
                </span>
              ) : 'Cerca'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={resetForm}
              style={{ fontSize: '0.875rem' }}
            >
              Nuova ricerca
            </button>
          </div>
        </form>
      </div>

      {result?.modalita === 'residenza' && <ResultCard result={result.data} />}
      {result?.modalita === 'famiglia' && (
        <FamigliaCard result={result.data} onConsultaComponente={consultaComponente} />
      )}
    </Container>
  );
}
