import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

// ==================== FORGOT PASSWORD PAGE ====================
export const ForgotPasswordPage = () => {
  const { language, languages, setLanguage } = useLanguage();
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState('');
  const [user, setUser] = useState(null);
  const [verificationMethod, setVerificationMethod] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const txt = {
    zh: {
      title: '忘记密码',
      account: '用户名/手机号/邮箱',
      findAccount: '查找账号',
      accountFound: '找到账号',
      verifyByEmail: '发送验证码到邮箱',
      verifyByPhone: '发送验证码到手机',
      sendCode: '发送验证码',
      verificationCode: '验证码',
      verify: '验证',
      newPassword: '新密码',
      confirmPassword: '确认新密码',
      passwordHint: '至少8位，包含字母和数字',
      resetPassword: '重置密码',
      back: '返回',
      backToLogin: '返回登录',
      success: '密码重置成功！',
      errors: {
        accountRequired: '请输入账号',
        accountNotFound: '账号不存在',
        noVerificationMethod: '该账号未绑定手机或邮箱',
        codeRequired: '请输入验证码',
        codeWrong: '验证码错误或已过期',
        passwordRequired: '请输入新密码',
        passwordWeak: '密码需要至少8位，包含字母和数字',
        passwordMismatch: '两次密码不一致',
        failed: '操作失败，请重试'
      }
    },
    en: {
      title: 'Forgot Password',
      account: 'Username/Phone/Email',
      findAccount: 'Find Account',
      accountFound: 'Account Found',
      verifyByEmail: 'Send code to email',
      verifyByPhone: 'Send code to phone',
      sendCode: 'Send Code',
      verificationCode: 'Verification Code',
      verify: 'Verify',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      passwordHint: 'At least 8 characters with letters and numbers',
      resetPassword: 'Reset Password',
      back: 'Back',
      backToLogin: 'Back to Login',
      success: 'Password reset successfully!',
      errors: {
        accountRequired: 'Please enter account',
        accountNotFound: 'Account not found',
        noVerificationMethod: 'No phone or email linked to this account',
        codeRequired: 'Please enter verification code',
        codeWrong: 'Invalid or expired verification code',
        passwordRequired: 'Please enter new password',
        passwordWeak: 'Password must be at least 8 characters with letters and numbers',
        passwordMismatch: 'Passwords do not match',
        failed: 'Operation failed, please try again'
      }
    },
    it: {
      title: 'Password Dimenticata',
      account: 'Nome utente/Telefono/Email',
      findAccount: 'Trova Account',
      accountFound: 'Account Trovato',
      verifyByEmail: 'Invia codice a email',
      verifyByPhone: 'Invia codice a telefono',
      sendCode: 'Invia Codice',
      verificationCode: 'Codice di Verifica',
      verify: 'Verifica',
      newPassword: 'Nuova Password',
      confirmPassword: 'Conferma Password',
      passwordHint: 'Almeno 8 caratteri con lettere e numeri',
      resetPassword: 'Reimposta Password',
      back: 'Indietro',
      backToLogin: 'Torna al Login',
      success: 'Password reimpostata con successo!',
      errors: {
        accountRequired: 'Inserisci account',
        accountNotFound: 'Account non trovato',
        noVerificationMethod: 'Nessun telefono o email collegato',
        codeRequired: 'Inserisci codice di verifica',
        codeWrong: 'Codice non valido o scaduto',
        passwordRequired: 'Inserisci nuova password',
        passwordWeak: 'Password deve avere almeno 8 caratteri con lettere e numeri',
        passwordMismatch: 'Le password non corrispondono',
        failed: 'Operazione fallita, riprova'
      }
    }
  };
  const t = txt[language] || txt.en;

  const findAccount = async () => {
    if (!account.trim()) {
      setError(t.errors.accountRequired);
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (supabase) {
        const { data } = await supabase
          .from('users')
          .select('id, username, name, email, phone')
          .or(`username.eq.${account},email.eq.${account},phone.eq.${account}`)
          .limit(1);
        if (!data || data.length === 0) {
          setError(t.errors.accountNotFound);
          return;
        }
        setUser(data[0]);
        if (!data[0].email && !data[0].phone) {
          setError(t.errors.noVerificationMethod);
          return;
        }
        setStep(2);
      }
    } catch (err) {
      setError(t.errors.failed);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    const target = verificationMethod === 'email' ? user.email : user.phone;
    setLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentCode(code);
      if (supabase) {
        await supabase.from('verification_codes').insert([{
          user_id: user.id,
          target: target,
          target_type: verificationMethod,
          code: code,
          purpose: 'reset_password',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        }]);
      }
      console.log('Reset code:', code);
      alert(`验证码: ${code}`);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      setStep(3);
    } catch (err) {
      setError(t.errors.failed);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = () => {
    if (!verificationCode) { setError(t.errors.codeRequired); return; }
    if (verificationCode !== sentCode) { setError(t.errors.codeWrong); return; }
    setStep(4);
    setError('');
  };

  const resetPassword = async () => {
    if (!newPassword) { setError(t.errors.passwordRequired); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)) { setError(t.errors.passwordWeak); return; }
    if (newPassword !== confirmPassword) { setError(t.errors.passwordMismatch); return; }
    setLoading(true);
    try {
      if (supabase) {
        const simpleHash = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return 'simple_' + Math.abs(hash).toString(16);
        };
        await supabase.from('users').update({ 
          password_hash: simpleHash(newPassword),
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
        setSuccess(t.success);
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(t.errors.failed);
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (email) => email ? email.substring(0, 2) + '***@' + email.split('@')[1] : '';
  const maskPhone = (phone) => phone ? phone.substring(0, 3) + '****' + phone.substring(phone.length - 4) : '';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>🔐 {t.title}</h1>
        </div>
        <div className="language-selector">
          {languages.map(lang => (
            <button key={lang.code} onClick={() => setLanguage(lang.code)} className={`language-btn ${language === lang.code ? 'active' : ''}`}>
              {lang.flag}
            </button>
          ))}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{ width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step >= s ? 'var(--primary)' : 'var(--background)', color: step >= s ? 'white' : 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '600' }}>{s}</div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <div className="form-group">
              <label className="form-label">{t.account}</label>
              <input type="text" className="form-input" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="username / email / phone" />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={findAccount} disabled={loading}>
              {loading ? '...' : t.findAccount}
            </button>
          </div>
        )}

        {step === 2 && user && (
          <div>
            <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <p style={{ fontWeight: '600' }}>{t.accountFound}:</p>
              <p style={{ fontSize: '1.25rem' }}>{user.name || user.username}</p>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {user.email && (
                <button className={`btn ${verificationMethod === 'email' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVerificationMethod('email')} style={{ padding: '1rem' }}>
                  📧 {t.verifyByEmail}<br /><small style={{ opacity: 0.7 }}>{maskEmail(user.email)}</small>
                </button>
              )}
              {user.phone && (
                <button className={`btn ${verificationMethod === 'phone' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVerificationMethod('phone')} style={{ padding: '1rem' }}>
                  📱 {t.verifyByPhone}<br /><small style={{ opacity: 0.7 }}>{maskPhone(user.phone)}</small>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(1)}>{t.back}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={sendVerificationCode} disabled={!verificationMethod || loading}>{t.sendCode}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="form-group">
              <label className="form-label">{t.verificationCode}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" className="form-input" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="123456" maxLength={6} style={{ flex: 1 }} />
                <button className="btn btn-outline" onClick={sendVerificationCode} disabled={countdown > 0}>{countdown > 0 ? `${countdown}s` : t.sendCode}</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(2)}>{t.back}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={verifyCode}>{t.verify}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="form-group">
              <label className="form-label">{t.newPassword}</label>
              <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.passwordHint} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.confirmPassword}</label>
              <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={resetPassword} disabled={loading}>
              {loading ? '...' : t.resetPassword}
            </button>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary)' }}>{t.backToLogin}</Link>
        </div>
      </div>
    </div>
  );
};

// ==================== CHANGE PASSWORD PAGE ====================
export const ChangePasswordPage = () => {
  const { language } = useLanguage();
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const txt = {
    zh: { title: '修改密码', currentPassword: '当前密码', newPassword: '新密码', confirmPassword: '确认新密码', passwordHint: '至少8位，包含字母和数字', change: '确认修改', success: '密码修改成功！', errors: { currentRequired: '请输入当前密码', newRequired: '请输入新密码', passwordWeak: '密码需要至少8位，包含字母和数字', passwordMismatch: '两次密码不一致', samePassword: '新密码不能与当前密码相同', failed: '修改失败' } },
    en: { title: 'Change Password', currentPassword: 'Current Password', newPassword: 'New Password', confirmPassword: 'Confirm New Password', passwordHint: 'At least 8 characters with letters and numbers', change: 'Change Password', success: 'Password changed successfully!', errors: { currentRequired: 'Please enter current password', newRequired: 'Please enter new password', passwordWeak: 'Password must be at least 8 characters with letters and numbers', passwordMismatch: 'Passwords do not match', samePassword: 'New password cannot be same as current', failed: 'Change failed' } },
    it: { title: 'Cambia Password', currentPassword: 'Password Attuale', newPassword: 'Nuova Password', confirmPassword: 'Conferma Nuova Password', passwordHint: 'Almeno 8 caratteri con lettere e numeri', change: 'Cambia Password', success: 'Password cambiata con successo!', errors: { currentRequired: 'Inserisci password attuale', newRequired: 'Inserisci nuova password', passwordWeak: 'Password deve avere almeno 8 caratteri', passwordMismatch: 'Le password non corrispondono', samePassword: 'La nuova password non può essere uguale', failed: 'Cambio fallito' } }
  };
  const t = txt[language] || txt.en;

  const handleChange = async () => {
    setError('');
    if (!currentPassword) { setError(t.errors.currentRequired); return; }
    if (!newPassword) { setError(t.errors.newRequired); return; }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)) { setError(t.errors.passwordWeak); return; }
    if (newPassword !== confirmPassword) { setError(t.errors.passwordMismatch); return; }
    if (currentPassword === newPassword) { setError(t.errors.samePassword); return; }
    
    setLoading(true);
    try {
      if (supabase && user) {
        const simpleHash = (str) => { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; } return 'simple_' + Math.abs(hash).toString(16); };
        await supabase.from('users').update({ password_hash: simpleHash(newPassword), updated_at: new Date().toISOString() }).eq('id', user.id);
        setSuccess(t.success);
        setTimeout(() => navigate('/profile'), 2000);
      }
    } catch (err) { setError(t.errors.failed); } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>🔐 {t.title}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <div className="form-group">
          <label className="form-label">{t.currentPassword} *</label>
          <input type="password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.newPassword} *</label>
          <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.passwordHint} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.confirmPassword} *</label>
          <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleChange} disabled={loading}>
          {loading ? '...' : t.change}
        </button>
      </div>
    </div>
  );
};

// ==================== TEACHER RESET APPROVAL PAGE ====================
export const TeacherResetApproval = () => {
  const { language } = useLanguage();
  const { user, supabase } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const txt = {
    zh: { title: '密码重置申请', noRequests: '暂无待处理的申请', student: '学生', reason: '原因', requestTime: '申请时间', approve: '批准', reject: '拒绝' },
    en: { title: 'Password Reset Requests', noRequests: 'No pending requests', student: 'Student', reason: 'Reason', requestTime: 'Request Time', approve: 'Approve', reject: 'Reject' },
    it: { title: 'Richieste Reset Password', noRequests: 'Nessuna richiesta in attesa', student: 'Studente', reason: 'Motivo', requestTime: 'Data Richiesta', approve: 'Approva', reject: 'Rifiuta' }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      if (supabase) {
        const { data } = await supabase.from('admin_password_resets').select('*, user:users(id, username, name)').eq('status', 'pending').order('created_at', { ascending: false });
        setRequests(data || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleAction = async (requestId, action) => {
    try {
      if (supabase) {
        const updateData = { status: action, reviewed_by: user?.id, reviewed_at: new Date().toISOString() };
        if (action === 'approved') {
          const tempPassword = Math.random().toString(36).slice(-8);
          updateData.temp_password = tempPassword;
          alert(`临时密码: ${tempPassword}`);
        }
        await supabase.from('admin_password_resets').update(updateData).eq('id', requestId);
        loadRequests();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header"><h1>🔐 {t.title}</h1></div>
      {requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: 'var(--text-muted)' }}>{t.noRequests}</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {requests.map(req => (
            <div key={req.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4>{t.student}: {req.user?.name || req.user?.username}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.reason}: {req.reason || 'N/A'}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.requestTime}: {new Date(req.created_at).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleAction(req.id, 'approved')}>✓ {t.approve}</button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleAction(req.id, 'rejected')}>✗ {t.reject}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
