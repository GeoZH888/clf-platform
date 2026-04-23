// src/components/RegisterStatusScreen.jsx
// Shows the status of a user's application.
// Reads status_token from localStorage or URL query.

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

export default function RegisterStatusScreen({ onBack, token: tokenProp }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  // Priority: prop > URL ?token= > localStorage
  const initialToken = tokenProp
    || new URLSearchParams(window.location.search).get('token')
    || (() => { try { return localStorage.getItem('clf_register_token') || ''; } catch { return ''; } })();

  const [token, setToken]       = useState(initialToken);
  const [input, setInput]       = useState(initialToken);
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState(null);
  const [error, setError]       = useState(null);

  async function load(tk) {
    if (!tk) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/.netlify/functions/register-status?token=${encodeURIComponent(tk)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function clearAndRestart() {
    try { localStorage.removeItem('clf_register_token'); } catch {}
    setToken(''); setInput(''); setData(null); setError(null);
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        {onBack && (
          <button onClick={onBack} style={S.backBtn}>‹ {t('返回','Back','Indietro')}</button>
        )}
        <div style={S.headerTitle}>
          {t('申请状态','Application Status','Stato Richiesta')}
        </div>
      </div>

      <div style={S.container}>

        {/* Token input (if no valid result yet) */}
        {(!data || error) && (
          <div style={S.card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#5D2E0C' }}>
              {t('输入申请凭证','Enter your token','Inserisci il codice')}
            </h3>
            <p style={{ fontSize: 11, color: '#a07850', marginBottom: 12, lineHeight: 1.5 }}>
              {t('提交申请后保存的凭证 (UUID 格式)。如果您勾选了保存，我们会自动记住。',
                 'The token saved after submission (UUID format). If you ticked remember, we auto-fill.',
                 'Il codice salvato dopo l\'invio (UUID). Se hai spuntato "ricorda", lo riempiamo automaticamente.')}
            </p>
            <input value={input} onChange={e => setInput(e.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ ...S.input, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11 }}/>
            <button onClick={() => setToken(input)}
              disabled={!input || loading}
              style={{ ...S.btn, marginTop: 10,
                background: input ? '#8B4513' : '#ccc',
                cursor: input ? 'pointer' : 'default' }}>
              {loading
                ? t('查询中…','Loading…','Caricamento…')
                : t('查询状态','Check Status','Verifica')}
            </button>

            {error && (
              <div style={S.errorBanner}>⚠ {error}</div>
            )}
          </div>
        )}

        {/* Result card */}
        {data && !error && (
          <div style={S.card}>
            <div style={S.statusRow}>
              <StatusBadge status={data.status} lang={lang}/>
            </div>

            <div style={S.dataGrid}>
              <DataRow label={t('姓名','Name','Nome')} value={data.name}/>
              <DataRow label={t('用户名','Username','Username')}
                value={<code style={{ fontSize: 12 }}>{data.username}</code>}/>
              {data.email && (
                <DataRow label="Email" value={data.email}/>
              )}
              <DataRow label={t('提交时间','Submitted','Inviato')}
                value={new Date(data.created_at).toLocaleString()}/>
              {data.reviewed_at && (
                <DataRow label={t('审核时间','Reviewed','Rivisto')}
                  value={new Date(data.reviewed_at).toLocaleString()}/>
              )}
            </div>

            {/* Status-specific messages */}
            {data.status === 'pending' && (
              <div style={{ ...S.infoBox, background: '#FFF8E1', borderColor: '#FFE082' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#E65100', marginBottom: 4 }}>
                  ⏳ {t('等待审核','Awaiting review','In attesa di revisione')}
                </div>
                <div style={{ fontSize: 11, color: '#8B6914', lineHeight: 1.5 }}>
                  {t('管理员通常在 1-3 天内完成审核。请稍后回来查看。',
                     'Admin usually reviews within 1-3 days. Check back later.',
                     'L\'admin rivede di solito entro 1-3 giorni.')}
                </div>
              </div>
            )}

            {data.status === 'approved' && (
              <div style={{ ...S.infoBox, background: '#E8F5E9', borderColor: '#A5D6A7' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2E7D32', marginBottom: 4 }}>
                  ✓ {t('申请已批准！','Application Approved!','Richiesta Approvata!')}
                </div>
                <div style={{ fontSize: 12, color: '#1B5E20', lineHeight: 1.6 }}>
                  {t(
                    `请使用您的用户名 ${data.username} 和设置的密码登录平台。`,
                    `Please log in with your username "${data.username}" and the password you set.`,
                    `Accedi con il tuo username "${data.username}" e la password scelta.`
                  )}
                </div>
                <button onClick={() => {
                  try { localStorage.removeItem('clf_register_token'); } catch {}
                  // This is just a prompt; you may want to set window.location
                  // to an actual login route in your app
                  onBack?.();
                }} style={{ ...S.btn, marginTop: 10, background: '#2E7D32' }}>
                  {t('前往登录','Go to Login','Vai al Login')} →
                </button>
              </div>
            )}

            {data.status === 'rejected' && (
              <div style={{ ...S.infoBox, background: '#FFEBEE', borderColor: '#EF9A9A' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#c62828', marginBottom: 4 }}>
                  ✕ {t('申请未通过','Not approved','Non approvato')}
                </div>
                {data.rejection_reason && (
                  <div style={{ fontSize: 12, color: '#b71c1c', lineHeight: 1.6,
                    marginTop: 6, padding: '6px 10px',
                    background: 'rgba(255,255,255,0.6)', borderRadius: 6 }}>
                    {t('原因','Reason','Motivo')}: {data.rejection_reason}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#8B0000', marginTop: 8, lineHeight: 1.5 }}>
                  {t(
                    '您可以联系 master@david-zhongwen.net 了解详情。',
                    'Contact master@david-zhongwen.net for details.',
                    'Contatta master@david-zhongwen.net per dettagli.'
                  )}
                </div>
              </div>
            )}

            <div style={S.linkRow}>
              <button onClick={clearAndRestart} style={S.linkBtn}>
                {t('查询其他申请','Check another','Verifica un\'altra')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, lang }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;
  const map = {
    pending:  { label: t('审核中','Pending','In attesa'),  bg: '#FFF8E1', fg: '#E65100', icon: '⏳' },
    approved: { label: t('已批准','Approved','Approvato'), bg: '#E8F5E9', fg: '#2E7D32', icon: '✓' },
    rejected: { label: t('未通过','Rejected','Rifiutato'), bg: '#FFEBEE', fg: '#c62828', icon: '✕' },
  };
  const m = map[status] || map.pending;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 20,
      background: m.bg, color: m.fg,
      fontSize: 13, fontWeight: 600,
    }}>
      <span>{m.icon}</span> {m.label}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      padding: '6px 0', borderBottom: '1px solid #f0e4ce', fontSize: 12 }}>
      <span style={{ color: '#a07850' }}>{label}</span>
      <span style={{ color: '#5D2E0C', fontWeight: 500, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

const S = {
  page: { minHeight: '100dvh', background: '#fdf6e3' },
  header: {
    background: '#8B4513', color: '#fdf6e3',
    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
  },
  backBtn: {
    background: 'none', border: 'none', color: '#fdf6e3',
    fontSize: 14, cursor: 'pointer', padding: 0,
  },
  headerTitle: { fontSize: 15, fontWeight: 600 },
  container: { padding: '20px 14px', maxWidth: 540, margin: '0 auto' },
  card: {
    background: '#fff', border: '1px solid #e8d5b0', borderRadius: 14,
    padding: '22px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
  },
  input: {
    width: '100%', padding: '9px 12px',
    border: '1px solid #e8d5b0', borderRadius: 8,
    boxSizing: 'border-box', background: '#fffdf9',
  },
  btn: {
    width: '100%', padding: 10, color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
  },
  statusRow: { textAlign: 'center', marginBottom: 16 },
  dataGrid: { marginBottom: 16 },
  infoBox: {
    padding: '12px 14px', borderRadius: 10,
    border: '1px solid', marginTop: 4,
  },
  errorBanner: {
    padding: '10px 12px', background: '#FFEBEE', color: '#c62828',
    borderRadius: 8, fontSize: 13, marginTop: 10,
    border: '1px solid #FFCDD2',
  },
  linkRow: { textAlign: 'center', marginTop: 14 },
  linkBtn: {
    background: 'none', border: 'none', color: '#8B4513',
    fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
  },
};
