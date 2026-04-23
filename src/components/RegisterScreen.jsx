// src/components/RegisterScreen.jsx
// Two modes, determined by ?invite=XYZ URL param:
//   1. Invite mode: user lands from QR scan. Code pre-filled + locked.
//      If valid auto-approve → direct_login on success (skips status page).
//   2. Public mode: no invite. Traditional apply-for-review flow.

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

export default function RegisterScreen({ onBack, onSuccess, onDirectLogin }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  // ── Detect invite code from URL on mount ──
  const urlInvite = (() => {
    try { return new URLSearchParams(window.location.search).get('invite') || ''; }
    catch { return ''; }
  })();

  const [inviteCode,  setInviteCode]  = useState(urlInvite);
  const [inviteState, setInviteState] = useState(urlInvite ? 'checking' : 'none');
  // 'none' | 'checking' | 'valid' | 'invalid' | 'expired' | 'exhausted'
  const [inviteMeta,  setInviteMeta]  = useState(null);
  const isInviteLocked = !!urlInvite;    // Prevent editing if came from QR

  // ── Form state ──
  const [form, setForm] = useState({
    name: '', username: '', password: '', passwordConfirm: '',
    email: '', reason: '', agree: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Check invite validity on mount ──
  useEffect(() => {
    if (!urlInvite) return;
    (async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/register-invite-check?code=${encodeURIComponent(urlInvite)}`
        );
        const data = await res.json();
        if (data.valid) {
          setInviteState('valid');
          setInviteMeta(data);
        } else {
          setInviteState(data.reason === 'expired'   ? 'expired'   :
                         data.reason === 'exhausted' ? 'exhausted' : 'invalid');
        }
      } catch {
        setInviteState('invalid');
      }
    })();
  }, [urlInvite]);

  // ── Submit ──
  async function submit() {
    setError(null);

    // Client-side validation
    if (!form.name.trim())    return setError(t('请填写姓名','Name required','Nome richiesto'));
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username))
      return setError(t('用户名 3-30 位字母/数字/下划线','Username: 3-30 chars','Username: 3-30 caratteri'));
    if (form.password.length < 8)
      return setError(t('密码至少 8 位','Password min 8 chars','Password min 8 caratteri'));
    if (form.password !== form.passwordConfirm)
      return setError(t('两次密码不一致','Passwords don\'t match','Le password non coincidono'));
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError(t('邮箱格式不正确','Invalid email','Email non valida'));

    // Reason only required WITHOUT invite
    if (!inviteCode && form.reason.trim().length < 3)
      return setError(t('请填写申请理由','Please enter a reason','Inserisci un motivo'));
    if (!form.agree)
      return setError(t('请勾选同意','Please agree','Accetta'));

    setSubmitting(true);

    try {
      const res = await fetch('/.netlify/functions/register-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name.trim(),
          username:    form.username.trim().toLowerCase(),
          password:    form.password,
          email:       form.email.trim() || null,
          reason:      form.reason.trim() || null,
          invite_code: inviteCode.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.direct_login) {
        onDirectLogin?.(data.username);    // parent handles "account created, go login"
      } else {
        try { localStorage.setItem('clf_register_token', data.status_token); } catch {}
        onSuccess?.(data.status_token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Invite banner rendering ──
  function InviteBanner() {
    if (inviteState === 'none') return null;
    if (inviteState === 'checking') {
      return <div style={{ ...S.banner, background: '#FFF8E1', color: '#E65100' }}>
        ⏳ {t('验证邀请码...','Verifying invite...','Verifica invito...')}
      </div>;
    }
    if (inviteState === 'valid') {
      return <div style={{ ...S.banner, background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          ✓ {t('邀请码有效','Valid invite','Invito valido')}
          {inviteMeta?.label && ` · ${inviteMeta.label}`}
        </div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>
          {inviteMeta?.auto_approve
            ? t('提交后立即开通账号，无需等待审核',
                'Account will be created immediately upon submission',
                'Account creato subito dopo l\'invio')
            : t('您的申请将更快通过审核',
                'Your application will be reviewed with priority',
                'La tua richiesta avrà priorità')}
        </div>
      </div>;
    }
    const msgs = {
      invalid:   t('邀请码无效','Invalid invite','Invito non valido'),
      expired:   t('邀请码已过期','Invite expired','Invito scaduto'),
      exhausted: t('邀请码已达使用上限','Invite fully used','Invito esaurito'),
    };
    return <div style={{ ...S.banner, background: '#FFEBEE', color: '#c62828', border: '1px solid #FFCDD2' }}>
      ⚠ {msgs[inviteState]}
    </div>;
  }

  // ── Can we submit? ──
  const canSubmit = !submitting
    && inviteState !== 'checking'
    && (inviteState !== 'invalid' && inviteState !== 'expired' && inviteState !== 'exhausted'
        || !isInviteLocked);    // If invite came from URL but is invalid, block submit

  return (
    <div style={S.page}>
      <div style={S.header}>
        {onBack && (
          <button onClick={onBack} style={S.backBtn}>‹ {t('返回','Back','Indietro')}</button>
        )}
        <div style={S.headerTitle}>
          {isInviteLocked && inviteState === 'valid'
            ? t('邀请注册','Invited Signup','Iscrizione con Invito')
            : t('账号申请','Account Application','Richiesta Account')}
        </div>
      </div>

      <div style={S.container}>
        <div style={S.card}>
          <h2 style={S.h2}>
            {isInviteLocked && inviteState === 'valid'
              ? t('🎉 欢迎加入大卫学中文',
                   '🎉 Welcome to David\'s Chinese',
                   '🎉 Benvenuto in Cinese di David')
              : t('申请加入大卫学中文',
                   'Apply to join David\'s Chinese',
                   'Iscriviti a Cinese di David')}
          </h2>
          <p style={S.subtitle}>
            {isInviteLocked && inviteState === 'valid' && inviteMeta?.auto_approve
              ? t('填写下方信息，立即开通账号。',
                   'Fill in below and your account is created instantly.',
                   'Compila sotto e il tuo account viene creato subito.')
              : t('管理员将审核您的申请，结果会显示在状态页面。',
                   'Admin will review. Result on status page.',
                   'L\'admin riviederà. Risultato sulla pagina stato.')}
          </p>

          <InviteBanner/>

          {/* Invite code field — locked if came from URL, editable otherwise */}
          <Field label={t('邀请码','Invite code','Codice invito')}
            hint={isInviteLocked
              ? t('来自二维码，已自动填入','From QR code','Dal QR code')
              : t('可选 · 有邀请码的申请优先通过',
                  'Optional · priority review',
                  'Opzionale · priorità')}>
            <input value={inviteCode} maxLength={40}
              onChange={e => !isInviteLocked && setInviteCode(e.target.value)}
              onBlur={() => {
                if (!isInviteLocked && inviteCode && inviteCode !== urlInvite) {
                  // Re-check if user typed a code manually
                  setInviteState('checking');
                  fetch(`/.netlify/functions/register-invite-check?code=${encodeURIComponent(inviteCode)}`)
                    .then(r => r.json())
                    .then(d => {
                      if (d.valid) { setInviteState('valid'); setInviteMeta(d); }
                      else setInviteState(d.reason || 'invalid');
                    })
                    .catch(() => setInviteState('invalid'));
                }
              }}
              disabled={isInviteLocked}
              placeholder="ABC123"
              style={{ ...S.input, fontFamily: 'ui-monospace,Menlo,monospace',
                background: isInviteLocked ? '#f5ede0' : '#fffdf9',
                cursor: isInviteLocked ? 'default' : 'text' }}/>
          </Field>

          <Field label={t('姓名','Name','Nome')} required>
            <input value={form.name} maxLength={80}
              onChange={e => set('name', e.target.value)}
              placeholder={t('您的姓名','Your name','Il tuo nome')}
              style={S.input}/>
          </Field>

          <Field label={t('用户名','Username','Username')} required
            hint={t('用于登录 · 字母/数字/下划线',
                    'For login · alphanumeric + underscore',
                    'Per login · alfanumerico')}>
            <input value={form.username} maxLength={30}
              onChange={e => set('username', e.target.value.toLowerCase())}
              placeholder="geo_florence"
              style={{ ...S.input, fontFamily: 'ui-monospace,Menlo,monospace' }}/>
          </Field>

          <Field label={t('密码','Password','Password')} required
            hint={t('至少 8 位','At least 8 chars','Almeno 8 caratteri')}>
            <input type="password" value={form.password} maxLength={100}
              onChange={e => set('password', e.target.value)} style={S.input}/>
          </Field>

          <Field label={t('确认密码','Confirm','Conferma')} required>
            <input type="password" value={form.passwordConfirm} maxLength={100}
              onChange={e => set('passwordConfirm', e.target.value)} style={S.input}/>
          </Field>

          <Field label={t('邮箱 (可选)','Email (optional)','Email (opzionale)')}>
            <input type="email" value={form.email} maxLength={120}
              onChange={e => set('email', e.target.value)}
              placeholder="name@example.com" style={S.input}/>
          </Field>

          {/* Reason only required without invite */}
          {(!inviteCode || inviteState !== 'valid' || !inviteMeta?.auto_approve) && (
            <Field label={t('申请理由','Reason','Motivo')}
              required={!inviteCode || inviteState !== 'valid'}>
              <textarea rows={2} value={form.reason} maxLength={500}
                onChange={e => set('reason', e.target.value)}
                placeholder={t('简要说明您希望使用此平台的原因',
                               'Why do you want to join?',
                               'Perché vuoi unirti?')}
                style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}/>
            </Field>
          )}

          <label style={S.consentRow}>
            <input type="checkbox" checked={form.agree}
              onChange={e => set('agree', e.target.checked)}/>
            <span>
              {t('我同意存储我的信息用于账号注册。被拒绝的申请 90 天后自动删除。',
                 'I consent to my info being stored for signup. Rejected apps auto-deleted after 90 days.',
                 'Acconsento alla memorizzazione per l\'iscrizione. Rifiuti cancellati dopo 90 giorni.')}
            </span>
          </label>

          {error && <div style={S.errorBanner}>⚠ {error}</div>}

          <button onClick={submit} disabled={!canSubmit} style={{
            ...S.submitBtn,
            background: canSubmit ? '#8B4513' : '#ccc',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
            {submitting
              ? t('处理中…','Processing…','Elaborazione…')
              : (inviteCode && inviteState === 'valid' && inviteMeta?.auto_approve)
                ? t('✨ 立即开通账号','✨ Create Account','✨ Crea Account')
                : t('✉ 提交申请','Submit Application','Invia Richiesta')}
          </button>

          {!isInviteLocked && (
            <div style={S.linkRow}>
              {t('已经申请过？','Already applied?','Già inviato?')}{' '}
              <button onClick={() => onSuccess?.(
                localStorage.getItem('clf_register_token') || ''
              )} style={S.linkBtn}>
                {t('查看状态','Check status','Verifica stato')} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5D2E0C', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#c0392b' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#a07850', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const S = {
  page: { minHeight: '100dvh', background: '#fdf6e3' },
  header: { background: '#8B4513', color: '#fdf6e3', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'none', border: 'none', color: '#fdf6e3',
    fontSize: 14, cursor: 'pointer', padding: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600 },
  container: { padding: '20px 14px', maxWidth: 540, margin: '0 auto' },
  card: { background: '#fff', border: '1px solid #e8d5b0', borderRadius: 14,
    padding: '22px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  h2: { margin: '0 0 6px', fontSize: 18, color: '#5D2E0C' },
  subtitle: { fontSize: 12, color: '#6b4c2a', marginBottom: 16, lineHeight: 1.5 },
  input: { width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #e8d5b0', borderRadius: 8, boxSizing: 'border-box', background: '#fffdf9' },
  banner: { padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14, lineHeight: 1.4 },
  consentRow: { display: 'flex', gap: 8, alignItems: 'flex-start',
    fontSize: 11, color: '#6b4c2a', lineHeight: 1.5,
    padding: '10px 12px', background: '#fdf6e3', borderRadius: 8,
    border: '1px solid #e8d5b0', marginBottom: 14 },
  errorBanner: { padding: '10px 12px', background: '#FFEBEE', color: '#c62828',
    borderRadius: 8, fontSize: 13, marginBottom: 12, border: '1px solid #FFCDD2' },
  submitBtn: { width: '100%', padding: 12, color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500 },
  linkRow: { textAlign: 'center', fontSize: 12, color: '#6b4c2a', marginTop: 14 },
  linkBtn: { background: 'none', border: 'none', color: '#8B4513',
    fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
};
