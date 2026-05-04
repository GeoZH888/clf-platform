// src/components/UserSettings.jsx
// User-facing settings: change display name and password.
// Reads from clf_user_profiles, writes via supabase.auth.updateUser().
//
// Replaces the old version that read jgw_device_sessions → jgw_invites.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';

export default function UserSettings({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it||en : en;

  const [profile,     setProfile]    = useState(null);
  const [authEmail,   setAuthEmail]  = useState('');
  const [modules,     setModules]    = useState([]);
  const [newName,     setNewName]    = useState('');
  const [newPassword, setNewPassword]= useState('');
  const [confirmPw,   setConfirmPw]  = useState('');
  const [currentPw,   setCurrentPw]  = useState('');
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [msg,         setMsg]        = useState({ text:'', ok:true });
  const [showPw,      setShowPw]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1. Get current Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        setAuthEmail(session.user.email || '');

        // 2. Fetch profile from clf_user_profiles
        const { data: prof } = await supabase
          .from('clf_user_profiles')
          .select('user_id, email, role, display_name, display_name_zh, is_active')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (prof) {
          setProfile(prof);
          setNewName(prof.display_name_zh || prof.display_name || '');
        }

        // 3. Fetch user's modules (for display only)
        const { data: mods } = await supabase
          .from('clf_user_modules')
          .select('module_id, available, selected')
          .eq('user_id', session.user.id);

        const enabled = (mods || [])
          .filter(m => m.available && m.selected)
          .map(m => m.module_id);
        setModules(enabled);
      } catch (e) {
        console.error('[UserSettings] load:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setMsg({ text:'', ok:true });

    try {
      // ── Validate new password ──
      if (newPassword) {
        if (!currentPw) {
          setMsg({ text: t('请输入当前密码', 'Enter current password', 'Inserisci password attuale'), ok:false });
          setSaving(false); return;
        }
        if (newPassword !== confirmPw) {
          setMsg({ text: t('两次输入的新密码不一致', 'Passwords do not match', 'Le password non corrispondono'), ok:false });
          setSaving(false); return;
        }
        if (newPassword.length < 8) {
          setMsg({ text: t('新密码至少8位', 'New password ≥ 8 chars', 'Nuova password min 8 caratteri'), ok:false });
          setSaving(false); return;
        }

        // Verify current password by signing in (Supabase doesn't have a
        // "verify password" API — re-auth is the standard pattern).
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: currentPw,
        });
        if (reauthErr) {
          setMsg({ text: t('当前密码不正确', 'Current password incorrect', 'Password attuale errata'), ok:false });
          setSaving(false); return;
        }

        // Now update password
        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwErr) {
          setMsg({ text: pwErr.message, ok:false });
          setSaving(false); return;
        }
      }

      // ── Update display name in clf_user_profiles ──
      const trimmedName = newName.trim();
      const currentName = profile.display_name_zh || profile.display_name || '';
      if (trimmedName && trimmedName !== currentName) {
        // Heuristic: if the name contains any CJK, store it as display_name_zh;
        // otherwise display_name.
        const hasCJK = /[\u4e00-\u9fff]/.test(trimmedName);
        const update = hasCJK
          ? { display_name_zh: trimmedName }
          : { display_name: trimmedName };

        const { error: nameErr } = await supabase
          .from('clf_user_profiles')
          .update(update)
          .eq('user_id', profile.user_id);

        if (nameErr) {
          setMsg({ text: nameErr.message, ok:false });
          setSaving(false); return;
        }
        setProfile(p => ({ ...p, ...update }));
      }

      // ── Done ──
      setCurrentPw(''); setNewPassword(''); setConfirmPw('');
      setMsg({ text: t('✓ 保存成功！', '✓ Saved successfully!', '✓ Salvato!'), ok:true });
    } catch (e) {
      setMsg({ text: e.message || String(e), ok:false });
    } finally {
      setSaving(false);
    }
  }

  const V = {
    bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
    text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850', verm:'#8B4513',
  };

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:V.bg, color:V.text3 }}>
      {t('加载中…', 'Loading…', 'Caricamento…')}
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:V.bg, gap:16, padding:24 }}>
      <div style={{ fontSize:14, color:V.text3 }}>
        {t('请先登录', 'Please log in first', 'Effettua prima il login')}
      </div>
      <button onClick={onBack} style={{ padding:'9px 20px', borderRadius:10, border:'none',
        background:V.verm, color:'#fff', cursor:'pointer' }}>
        {t('返回', 'Back', 'Indietro')}
      </button>
    </div>
  );

  const moduleLabels = {
    lianzi:'练字', pinyin:'拼音', words:'词语', chengyu:'成语',
    poetry:'诗歌', grammar:'语法', hsk:'HSK', riddles:'灯谜',
    kechuang:'课程', lessons:'课时', chat:'聊天', voice:'语音',
    homework:'作业', shop:'商城', parents:'家长',
  };

  const username = authEmail?.split('@')[0] || '—';

  return (
    <div style={{ background:V.bg, minHeight:'100dvh', paddingBottom:40 }}>

      {/* Header */}
      <div style={{ background:V.verm, padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:24, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>
          {t('个人设置', 'My Settings', 'Impostazioni')}
        </div>
      </div>

      <div style={{ padding:'20px 16px', maxWidth:480, margin:'0 auto',
        display:'flex', flexDirection:'column', gap:14 }}>

        {/* Account info card */}
        <div style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:16, padding:'16px' }}>
          <div style={{ fontSize:12, color:V.text3, marginBottom:10, fontWeight:600 }}>
            {t('账号信息', 'Account Info', 'Info Account')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, color:V.text2 }}>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ color:V.text3, width:60 }}>{t('用户名','Username','Username')}:</span>
              <strong style={{ fontFamily:'monospace', color:V.verm }}>{username}</strong>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ color:V.text3, width:60 }}>{t('角色','Role','Ruolo')}:</span>
              <span>{profile.role || '—'}</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <span style={{ color:V.text3, width:60 }}>{t('模块','Modules','Moduli')}:</span>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {modules.length === 0
                  ? <span style={{ fontSize:11, color:V.text3 }}>—</span>
                  : modules.map(m => (
                      <span key={m} style={{ fontSize:10, padding:'2px 7px', borderRadius:8,
                        background:'#f0e8d8', color:V.verm }}>
                        {moduleLabels[m]||m}
                      </span>
                    ))}
              </div>
            </div>
          </div>
        </div>

        {/* Change name */}
        <div style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:16, padding:'16px' }}>
          <div style={{ fontSize:12, color:V.text3, marginBottom:12, fontWeight:600 }}>
            👤 {t('修改姓名', 'Change Name', 'Cambia Nome')}
          </div>
          <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
            {t('显示姓名', 'Display name', 'Nome visualizzato')}
          </label>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={profile.display_name_zh || profile.display_name || ''}
            style={{ width:'100%', padding:'9px 12px', fontSize:14, borderRadius:10,
              border:`1.5px solid ${V.border}`, background:V.bg, color:V.text,
              boxSizing:'border-box' }}/>
        </div>

        {/* Change password */}
        <div style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:16, padding:'16px' }}>
          <div style={{ fontSize:12, color:V.text3, marginBottom:12, fontWeight:600 }}>
            🔑 {t('修改密码', 'Change Password', 'Cambia Password')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                {t('当前密码', 'Current password', 'Password attuale')}
              </label>
              <div style={{ position:'relative' }}>
                <input type={showPw?'text':'password'} value={currentPw}
                  onChange={e=>setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  style={{ width:'100%', padding:'9px 36px 9px 12px', fontSize:14,
                    borderRadius:10, border:`1.5px solid ${V.border}`,
                    background:V.bg, color:V.text, boxSizing:'border-box',
                    fontFamily:'monospace' }}/>
                <button type="button" onClick={()=>setShowPw(p=>!p)}
                  style={{ position:'absolute', right:8, top:'50%',
                    transform:'translateY(-50%)', border:'none', background:'none',
                    cursor:'pointer', fontSize:16, color:V.text3 }}>
                  {showPw?'🙈':'👁'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                {t('新密码（至少8位）', 'New password (8+ chars)', 'Nuova password (min 8)')}
              </label>
              <input type={showPw?'text':'password'} value={newPassword}
                onChange={e=>setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', padding:'9px 12px', fontSize:14,
                  borderRadius:10, border:`1.5px solid ${V.border}`,
                  background:'#fffde7', color:V.text, boxSizing:'border-box',
                  fontFamily:'monospace' }}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:4 }}>
                {t('确认新密码', 'Confirm new password', 'Conferma nuova password')}
              </label>
              <input type={showPw?'text':'password'} value={confirmPw}
                onChange={e=>setConfirmPw(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', padding:'9px 12px', fontSize:14,
                  borderRadius:10,
                  border:`1.5px solid ${confirmPw && newPassword && confirmPw!==newPassword ? '#c0392b' : V.border}`,
                  background:V.bg, color:V.text, boxSizing:'border-box',
                  fontFamily:'monospace' }}/>
              {confirmPw && newPassword && confirmPw!==newPassword && (
                <div style={{ fontSize:11, color:'#c0392b', marginTop:4 }}>
                  {t('密码不一致', 'Passwords do not match', 'Le password non corrispondono')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feedback */}
        {msg.text && (
          <div style={{ padding:'10px 14px', borderRadius:12, fontSize:13,
            background: msg.ok ? '#E8F5E9' : '#FFEBEE',
            color: msg.ok ? '#2E7D32' : '#c0392b',
            border: `1px solid ${msg.ok ? '#A5D6A7' : '#FFCDD2'}` }}>
            {msg.text}
          </div>
        )}

        {/* Save button */}
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'13px', borderRadius:14, border:'none',
            background: saving ? '#E0E0E0' : V.verm,
            color: saving ? '#999' : '#fff',
            fontSize:15, fontWeight:700, cursor:saving?'default':'pointer',
            transition:'background 0.15s' }}>
          {saving ? t('保存中…','Saving…','Salvataggio…') : t('保存更改','Save Changes','Salva Modifiche')}
        </button>

        <div style={{ fontSize:11, color:V.text3, textAlign:'center', lineHeight:1.6 }}>
          {t(
            '用户名不可修改。如需更改用户名，请联系老师。',
            'Username cannot be changed. Contact your teacher to change it.',
            'Il nome utente non può essere modificato. Contatta il tuo insegnante.'
          )}
        </div>
      </div>
    </div>
  );
}
