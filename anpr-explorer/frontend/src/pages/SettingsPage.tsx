import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { getSettings, saveSettings, testConnection } from '../api/settings';
import { getUsers, createUser, deleteUser, updateUser } from '../api/users';
import type {
  AnprServiceCode,
  PdndEnvironment,
  PdndSettingsPublicView,
  PurposeMapEntry,
  User,
  UserRole,
} from '../types';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: string; dettagli?: Record<string, string[]> } | undefined;
    if (data?.dettagli) {
      const campi = Object.entries(data.dettagli)
        .map(([campo, errori]) => `${campo}: ${errori.join(', ')}`)
        .join(' — ');
      return `${data.error ?? fallback}: ${campi}`;
    }
    if (data?.error) return data.error;
  }
  return fallback;
}

const SERVICE_CODES: AnprServiceCode[] = ['C030', 'C020', 'C021'];

const SERVICE_LABELS: Record<AnprServiceCode, string> = {
  C030: 'C030 — Ricerca ID ANPR',
  C020: 'C020 — Accertamento residenza',
  C021: 'C021 — Stato di famiglia',
};

type PurposeState = Record<AnprServiceCode, string>;
const EMPTY_PURPOSE_STATE: PurposeState = { C030: '', C020: '', C021: '' };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#17324d', marginBottom: '0.3rem', display: 'block' }}>
      {children}
    </label>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h3>{title}</h3>
        {badge}
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [view, setView] = useState<PdndSettingsPublicView | null>(null);
  const [clientId, setClientId] = useState('');
  const [kid, setKid] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [tokenEndpoint, setTokenEndpoint] = useState('');
  const [clientAssertionAudience, setClientAssertionAudience] = useState('auth.interop.pagopa.it/client-assertion');
  const [anprBaseUrl, setAnprBaseUrl] = useState('');
  const [environment, setEnvironment] = useState<PdndEnvironment>('collaudo');
  const [purposeMap, setPurposeMap] = useState<PurposeState>(EMPTY_PURPOSE_STATE);
  const [ipaCode, setIpaCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Partial<Record<AnprServiceCode, { ok: boolean; msg: string }>>>({});

  const [users, setUsers] = useState<User[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [userFormLoading, setUserFormLoading] = useState(false);

  useEffect(() => {
    void refresh();
    void loadUsers();
  }, []);

  async function refresh() {
    try {
      const data = await getSettings();
      setView(data);
      setClientId(data.clientId ?? '');
      setTokenEndpoint(data.tokenEndpoint ?? '');
      setClientAssertionAudience(data.clientAssertionAudience ?? clientAssertionAudience);
      setAnprBaseUrl(data.anprBaseUrl ?? '');
      setEnvironment(data.environment ?? 'collaudo');
      setIpaCode(data.ipaCode ?? '');
      const map: PurposeState = { ...EMPTY_PURPOSE_STATE };
      data.purposeMap.forEach((entry: PurposeMapEntry) => { map[entry.serviceCode] = entry.purposeId; });
      setPurposeMap(map);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile caricare la configurazione'));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await saveSettings({
        clientId,
        ...(kid.trim() ? { kid } : {}),
        ...(privateKeyPem.trim() ? { privateKeyPem } : {}),
        tokenEndpoint,
        clientAssertionAudience,
        anprBaseUrl,
        environment,
        ipaCode,
        purposeMap: SERVICE_CODES.filter((c) => purposeMap[c]).map((c) => ({ serviceCode: c, purposeId: purposeMap[c] })),
      });
      setKid('');
      setPrivateKeyPem('');
      setSuccessMessage('Configurazione salvata correttamente');
      await refresh();
    } catch (err) {
      setError(extractErrorMessage(err, 'Errore durante il salvataggio'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTest(serviceCode: AnprServiceCode) {
    setTestResults((p) => ({ ...p, [serviceCode]: { ok: true, msg: 'Verifica in corso…' } }));
    try {
      const res = await testConnection(serviceCode);
      setTestResults((p) => ({ ...p, [serviceCode]: { ok: true, msg: res.message } }));
    } catch (err) {
      setTestResults((p) => ({ ...p, [serviceCode]: { ok: false, msg: extractErrorMessage(err, 'Voucher non ottenuto') } }));
    }
  }

  async function loadUsers() {
    try { setUsers(await getUsers()); }
    catch { setUsersError('Impossibile caricare gli utenti'); }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setUsersError(null);
    setUserFormLoading(true);
    try {
      await createUser({ username: newUsername, password: newPassword, role: newRole });
      setNewUsername(''); setNewPassword(''); setNewRole('viewer');
      await loadUsers();
    } catch (err) {
      setUsersError(extractErrorMessage(err, "Errore durante la creazione dell'utente"));
    } finally {
      setUserFormLoading(false);
    }
  }

  async function handleDeleteUser(id: number) {
    if (!confirm('Eliminare questo utente?')) return;
    try { await deleteUser(id); await loadUsers(); }
    catch (err) { setUsersError(extractErrorMessage(err, "Errore durante l'eliminazione")); }
  }

  async function handleChangeRole(id: number, role: UserRole) {
    try { await updateUser(id, { role }); await loadUsers(); }
    catch (err) { setUsersError(extractErrorMessage(err, "Errore durante l'aggiornamento del ruolo")); }
  }

  const configBadge = view ? (
    <span
      style={{
        background: view.configured ? '#d4edda' : '#fff3cd',
        color: view.configured ? '#155724' : '#856404',
        fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: '100px',
      }}
    >
      {view.configured ? 'Configurato' : 'Da completare'}
    </span>
  ) : null;

  return (
    <div>
      {/* Intestazione pagina */}
      <div className="mb-4">
        <h2 className="mb-1" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#17324d' }}>Impostazioni</h2>
        <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Credenziali PDND, finalità e gestione operatori</p>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded" style={{ background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-3 p-3 rounded" style={{ background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', fontSize: '0.875rem' }}>
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Credenziali PDND ─────────────────────────────────── */}
        <SectionCard title="Credenziali PDND" badge={configBadge}>
          <div className="row g-3">
            <div className="col-md-6">
              <FieldLabel>Client ID</FieldLabel>
              <input className="form-control" value={clientId} onChange={(e) => setClientId(e.target.value)} required style={{ fontSize: '0.875rem' }} />
            </div>
            <div className="col-md-6">
              <FieldLabel>Key ID (kid)</FieldLabel>
              <input
                className="form-control"
                value={kid}
                onChange={(e) => setKid(e.target.value)}
                placeholder={view?.kidMasked ? `${view.kidMasked} — lasciare vuoto per non modificare` : ''}
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <div className="col-12">
              <FieldLabel>Chiave privata (PEM) — write-only</FieldLabel>
              <textarea
                className="form-control"
                rows={5}
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                placeholder={
                  view?.hasPrivateKey
                    ? '•••••••• già configurata — lasciare vuoto per non modificarla'
                    : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
                }
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>
            <div className="col-md-8">
              <FieldLabel>Token endpoint PDND</FieldLabel>
              <input
                className="form-control"
                value={tokenEndpoint}
                onChange={(e) => setTokenEndpoint(e.target.value)}
                placeholder="https://auth.uat.interop.pagopa.it/token.oauth2"
                required
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <div className="col-md-4">
              <FieldLabel>Ambiente</FieldLabel>
              <select
                className="form-select"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as PdndEnvironment)}
                style={{ fontSize: '0.875rem' }}
              >
                <option value="collaudo">Collaudo</option>
                <option value="produzione">Produzione</option>
              </select>
            </div>
            <div className="col-md-8">
              <FieldLabel>Audience client assertion</FieldLabel>
              <input
                className="form-control"
                value={clientAssertionAudience}
                onChange={(e) => setClientAssertionAudience(e.target.value)}
                required
                style={{ fontSize: '0.875rem' }}
              />
            </div>
            <div className="col-12">
              <FieldLabel>Prefisso URL e-service ANPR (senza slash finale)</FieldLabel>
              <input
                className="form-control"
                value={anprBaseUrl}
                onChange={(e) => setAnprBaseUrl(e.target.value)}
                placeholder="https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND"
                required
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '0.72rem' }}>
                Collaudo: modipa-val.anpr.interno.it · Produzione: modipa.anpr.interno.it · Il backend aggiunge il segmento specifico per ogni e-service.
              </p>
            </div>
            <div className="col-md-4">
              <FieldLabel>Codice IPA del Comune</FieldLabel>
              <input
                className="form-control"
                value={ipaCode}
                onChange={(e) => setIpaCode(e.target.value)}
                placeholder="es. c_l219"
                maxLength={20}
                style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '0.72rem' }}>
                Usato come <code>userLocation</code> nel TrackingEvidence ModI (max 20 caratteri).
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Finalità (purposeId) ─────────────────────────────── */}
        <SectionCard title="Finalità (purposeId) per servizio">
          <div className="row g-3">
            {SERVICE_CODES.map((code) => (
              <div key={code} className="col-12">
                <div className="row g-2 align-items-center">
                  <div className="col-md-4">
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#17324d' }}>{SERVICE_LABELS[code]}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6c757d', fontFamily: 'monospace' }}>{code}</div>
                  </div>
                  <div className="col-md-6">
                    <input
                      className="form-control"
                      value={purposeMap[code]}
                      onChange={(e) => setPurposeMap((prev) => ({ ...prev, [code]: e.target.value }))}
                      placeholder="UUID purposeId"
                      style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary w-100"
                      disabled={!purposeMap[code]}
                      onClick={() => handleTest(code)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Test
                    </button>
                  </div>
                  {testResults[code] && (
                    <div className="col-12">
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: testResults[code]?.ok ? '#155724' : '#842029',
                          fontWeight: 500,
                        }}
                      >
                        {testResults[code]?.msg}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="mb-4">
          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ background: '#0066cc', color: '#fff', fontWeight: 600, fontSize: '0.875rem', minWidth: 160 }}
          >
            {loading ? (
              <span className="d-flex align-items-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" />
                Salvataggio…
              </span>
            ) : 'Salva configurazione'}
          </button>
        </div>
      </form>

      {/* ── Gestione utenti ──────────────────────────────────── */}
      <SectionCard title="Gestione utenti">
        {usersError && (
          <div className="mb-3 p-2 rounded" style={{ background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7', fontSize: '0.85rem' }}>
            {usersError}
          </div>
        )}

        <div className="table-responsive mb-4">
          <table className="data-table w-100" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ borderBottom: '2px solid #dee2e6' }}>
              <tr>
                <th>Username</th>
                <th>Ruolo</th>
                <th>Creato il</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
                    Nessun utente configurato
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                      style={{ width: 'auto', fontSize: '0.8rem', display: 'inline-block' }}
                    >
                      <option value="admin">Amministratore</option>
                      <option value="viewer">Visualizzatore</option>
                    </select>
                  </td>
                  <td style={{ color: '#6c757d', fontSize: '0.8rem' }}>
                    {new Date(u.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteUser(u.id)}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '1.25rem' }}>
          <div className="field-label mb-3">Aggiungi utente</div>
          <form onSubmit={handleCreateUser}>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <FieldLabel>Username</FieldLabel>
                <input
                  className="form-control"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={2}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
              <div className="col-md-4">
                <FieldLabel>Password (min. 8 caratteri)</FieldLabel>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
              <div className="col-md-3">
                <FieldLabel>Ruolo</FieldLabel>
                <select
                  className="form-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  style={{ fontSize: '0.875rem' }}
                >
                  <option value="viewer">Visualizzatore</option>
                  <option value="admin">Amministratore</option>
                </select>
              </div>
              <div className="col-md-2">
                <button
                  type="submit"
                  className="btn w-100"
                  disabled={userFormLoading}
                  style={{ background: '#0066cc', color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  {userFormLoading ? '…' : 'Aggiungi'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </SectionCard>
    </div>
  );
}
