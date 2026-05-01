import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage = () => {
  const { language, setLanguage } = useLanguage();
  const { supabase } = useAuth();
  const navigate = useNavigate();

  // 注册模式: invitation, application, guest
  const [mode, setMode] = useState('invitation');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 邀请码注册
  const [inviteCode, setInviteCode] = useState('');
  const [inviteInfo, setInviteInfo] = useState(null);

  // 申请注册
  const [applyRole, setApplyRole] = useState('student');
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [linkedStudent, setLinkedStudent] = useState('');

  // 通用表单
  const [form, setForm] = useState({
    name: '',
    nameZh: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    verificationCode: ''
  });

  // 验证状态
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verifyType, setVerifyType] = useState('phone'); // phone or email

  const languages = [
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
  ];

  const txt = {
    zh: {
      title: '注册账号',
      subtitle: '大卫学中文',
      selectMode: '选择注册方式',
      invitationMode: '邀请码注册',
      invitationDesc: '已有邀请码，快速注册',
      applicationMode: '申请加入学校',
      applicationDesc: '申请加入，等待审核',
      guestMode: '游客体验',
      guestDesc: '先体验，后加入',
      inviteCode: '邀请码',
      inviteCodePlaceholder: '输入邀请码（从学校或老师获得）',
      verifyCode: '验证邀请码',
      codeValid: '邀请码有效！',
      codeInvalid: '邀请码无效或已过期',
      role: '身份',
      school: '学校',
      class: '班级',
      selectSchool: '选择学校',
      selectClass: '选择班级',
      iAm: '我是',
      admin: '学校管理员',
      teacher: '教师',
      student: '学生',
      parent: '学生家长',
      linkedStudent: '关联学生',
      linkedStudentPlaceholder: '输入孩子的姓名或学号',
      name: '姓名',
      nameZh: '中文名',
      email: '邮箱',
      phone: '手机号',
      password: '密码',
      confirmPassword: '确认密码',
      verificationCode: '验证码',
      getCode: '获取验证码',
      resendCode: '重新发送',
      verifyPhone: '手机验证',
      verifyEmail: '邮箱验证',
      next: '下一步',
      back: '上一步',
      submit: '提交申请',
      register: '立即注册',
      registerGuest: '注册体验账号',
      haveAccount: '已有账号？',
      login: '去登录',
      passwordMismatch: '两次密码不一致',
      fillRequired: '请填写必填项',
      applicationSubmitted: '申请已提交！学校管理员将在1-2个工作日内审核，届时将通过邮件/短信通知您。',
      registrationSuccess: '注册成功！正在跳转...',
      quotaExceeded: '该学校配额已满，请联系学校管理员',
      step1: '选择身份',
      step2: '填写信息',
      step3: '验证身份',
      step4: '完成',
      applyNote: '提交后，学校管理员将审核您的申请',
      guestNote: '游客账号可访问公共学习空间，如需加入学校请后续申请'
    },
    en: {
      title: 'Register',
      subtitle: 'David Learns Chinese',
      selectMode: 'Select Registration Method',
      invitationMode: 'Invitation Code',
      invitationDesc: 'Have a code? Register instantly',
      applicationMode: 'Apply to Join School',
      applicationDesc: 'Apply and wait for approval',
      guestMode: 'Guest Experience',
      guestDesc: 'Try first, join later',
      inviteCode: 'Invitation Code',
      inviteCodePlaceholder: 'Enter code (from school or teacher)',
      verifyCode: 'Verify Code',
      codeValid: 'Code is valid!',
      codeInvalid: 'Invalid or expired code',
      role: 'Role',
      school: 'School',
      class: 'Class',
      selectSchool: 'Select School',
      selectClass: 'Select Class',
      iAm: 'I am a',
      admin: 'School Admin',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
      linkedStudent: 'Link to Student',
      linkedStudentPlaceholder: "Enter child's name or ID",
      name: 'Name',
      nameZh: 'Chinese Name',
      email: 'Email',
      phone: 'Phone',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      verificationCode: 'Verification Code',
      getCode: 'Get Code',
      resendCode: 'Resend',
      verifyPhone: 'Phone Verification',
      verifyEmail: 'Email Verification',
      next: 'Next',
      back: 'Back',
      submit: 'Submit Application',
      register: 'Register Now',
      registerGuest: 'Register as Guest',
      haveAccount: 'Have an account?',
      login: 'Login',
      passwordMismatch: 'Passwords do not match',
      fillRequired: 'Please fill required fields',
      applicationSubmitted: 'Application submitted! The school admin will review within 1-2 business days.',
      registrationSuccess: 'Registration successful! Redirecting...',
      quotaExceeded: 'School quota exceeded, please contact admin',
      step1: 'Select Role',
      step2: 'Fill Info',
      step3: 'Verify',
      step4: 'Complete',
      applyNote: 'After submission, school admin will review your application',
      guestNote: 'Guest accounts can access public learning space. Apply to join a school later.'
    },
    it: {
      title: 'Registrazione',
      subtitle: 'David Impara il Cinese',
      selectMode: 'Seleziona Metodo',
      invitationMode: 'Codice Invito',
      invitationDesc: 'Hai un codice? Registrati subito',
      applicationMode: 'Richiedi di Unirti',
      applicationDesc: 'Fai richiesta e attendi approvazione',
      guestMode: 'Prova Ospite',
      guestDesc: 'Prova prima, unisciti dopo',
      inviteCode: 'Codice Invito',
      inviteCodePlaceholder: 'Inserisci codice (dalla scuola)',
      verifyCode: 'Verifica Codice',
      codeValid: 'Codice valido!',
      codeInvalid: 'Codice non valido o scaduto',
      role: 'Ruolo',
      school: 'Scuola',
      class: 'Classe',
      selectSchool: 'Seleziona Scuola',
      selectClass: 'Seleziona Classe',
      iAm: 'Sono un',
      admin: 'Admin Scuola',
      teacher: 'Insegnante',
      student: 'Studente',
      parent: 'Genitore',
      linkedStudent: 'Collega Studente',
      linkedStudentPlaceholder: 'Nome o ID del figlio',
      name: 'Nome',
      nameZh: 'Nome Cinese',
      email: 'Email',
      phone: 'Telefono',
      password: 'Password',
      confirmPassword: 'Conferma Password',
      verificationCode: 'Codice Verifica',
      getCode: 'Invia Codice',
      resendCode: 'Reinvia',
      verifyPhone: 'Verifica Telefono',
      verifyEmail: 'Verifica Email',
      next: 'Avanti',
      back: 'Indietro',
      submit: 'Invia Richiesta',
      register: 'Registrati',
      registerGuest: 'Registra Ospite',
      haveAccount: 'Hai un account?',
      login: 'Accedi',
      passwordMismatch: 'Le password non corrispondono',
      fillRequired: 'Compila i campi obbligatori',
      applicationSubmitted: 'Richiesta inviata! L\'admin verificherà in 1-2 giorni.',
      registrationSuccess: 'Registrazione completata! Reindirizzamento...',
      quotaExceeded: 'Quota scuola esaurita, contatta l\'admin',
      step1: 'Seleziona Ruolo',
      step2: 'Info',
      step3: 'Verifica',
      step4: 'Completa',
      applyNote: 'L\'admin della scuola verificherà la tua richiesta',
      guestNote: 'Gli ospiti possono accedere allo spazio pubblico. Richiedi di unirti dopo.'
    }
  };
  const t = txt[language] || txt.en;

  // 加载学校列表
  useEffect(() => {
    loadSchools();
  }, []);

  // 加载班级
  useEffect(() => {
    if (selectedSchool) loadClasses(selectedSchool);
  }, [selectedSchool]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadSchools = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('dwxz_schools').select('id, name, name_zh, code').eq('is_active', true);
    setSchools(data || []);
  };

  const loadClasses = async (schoolId) => {
    if (!supabase) return;
    const { data } = await supabase.from('dwxz_classes').select('id, name, hsk_level').eq('school_id', schoolId);
    setClasses(data || []);
  };

  // 验证邀请码
  const verifyInviteCode = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await supabase
        .from('dwxz_invitation_codes')
        .select('*, schools(name, name_zh), classes(name, hsk_level)')
        .eq('code', inviteCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (err || !data) {
        setError(t.codeInvalid);
        setInviteInfo(null);
      } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError(t.codeInvalid);
        setInviteInfo(null);
      } else if (data.used_count >= data.max_uses) {
        setError(t.quotaExceeded);
        setInviteInfo(null);
      } else {
        setInviteInfo(data);
        setSuccess(t.codeValid);
        setStep(2);
      }
    } catch (err) {
      setError(t.codeInvalid);
    } finally {
      setLoading(false);
    }
  };

  // 发送验证码
  const sendVerificationCode = async () => {
    const target = verifyType === 'phone' ? form.phone : form.email;
    if (!target) return;

    setLoading(true);
    try {
      const code = Math.random().toString().slice(2, 8);
      await supabase.from('dwxz_verification_codes').insert([{
        target,
        code,
        purpose: 'register',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }]);
      setCodeSent(true);
      setCountdown(60);
      // 实际应发送短信/邮件
    } catch (err) {
      setError('Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  // 邀请码注册
  const handleInvitationRegister = async () => {
    if (form.password !== form.confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!form.name || !form.password || (!form.phone && !form.email)) {
      setError(t.fillRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 创建用户
      const { data: newUser, error: userErr } = await supabase.from('dwxz_users_view').insert([{
        username: form.phone || form.email.split('@')[0],
        name: form.name,
        name_zh: form.nameZh,
        email: form.email,
        phone: form.phone,
        password_hash: form.password, // 实际应加密
        role: inviteInfo.role,
        school_id: inviteInfo.school_id,
        registration_type: 'invitation',
        invitation_code_id: inviteInfo.id,
        is_active: true
      }]).select().single();

      if (userErr) throw userErr;

      // 更新邀请码使用次数
      await supabase.from('dwxz_invitation_codes').update({
        used_count: inviteInfo.used_count + 1
      }).eq('id', inviteInfo.id);

      // 记录使用
      await supabase.from('dwxz_invitation_code_usage').insert([{
        code_id: inviteInfo.id,
        user_id: newUser.id
      }]);

      // 如果有班级，加入班级
      if (inviteInfo.class_id && (inviteInfo.role === 'student' || inviteInfo.role === 'teacher')) {
        await supabase.from('dwxz_class_enrollments').insert([{
          class_id: inviteInfo.class_id,
          student_id: newUser.id,
          status: 'active'
        }]);
      }

      setSuccess(t.registrationSuccess);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 提交申请
  const handleApplicationSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!form.name || !form.password || !selectedSchool) {
      setError(t.fillRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await supabase.from('dwxz_user_applications').insert([{
        name: form.name,
        name_zh: form.nameZh,
        email: form.email,
        phone: form.phone,
        password_hash: form.password,
        apply_role: applyRole,
        school_id: selectedSchool,
        class_id: selectedClass || null,
        linked_student_name: linkedStudent || null,
        email_verified: codeSent && verifyType === 'email',
        phone_verified: codeSent && verifyType === 'phone',
        status: 'pending'
      }]);

      setSuccess(t.applicationSubmitted);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 游客注册
  const handleGuestRegister = async () => {
    if (form.password !== form.confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (!form.name || !form.password || (!form.phone && !form.email)) {
      setError(t.fillRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await supabase.from('dwxz_users_view').insert([{
        username: form.phone || form.email.split('@')[0],
        name: form.name,
        name_zh: form.nameZh,
        email: form.email,
        phone: form.phone,
        password_hash: form.password,
        role: 'student', // 游客默认学生角色
        registration_type: 'direct',
        is_active: true
      }]);

      setSuccess(t.registrationSuccess);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container" style={{ maxWidth: '480px' }}>
        {/* Logo */}
        <div className="login-header">
          <h1>{t.subtitle}</h1>
          <p>{t.title}</p>
        </div>

        {/* 语言选择 */}
        <div className="language-selector">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`language-btn ${language === lang.code ? 'active' : ''}`}
            >
              {lang.flag}
            </button>
          ))}
        </div>

        {/* 错误/成功消息 */}
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

        {/* 步骤1: 选择注册方式 */}
        {step === 1 && (
          <div>
            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              {t.selectMode}
            </h3>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* 邀请码注册 */}
              <div
                onClick={() => setMode('invitation')}
                style={{
                  padding: '1.25rem',
                  border: `2px solid ${mode === 'invitation' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: mode === 'invitation' ? 'rgba(196, 30, 58, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>🎫</span>
                  <div>
                    <div style={{ fontWeight: '600' }}>{t.invitationMode}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.invitationDesc}</div>
                  </div>
                </div>
              </div>

              {/* 申请加入 */}
              <div
                onClick={() => setMode('application')}
                style={{
                  padding: '1.25rem',
                  border: `2px solid ${mode === 'application' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: mode === 'application' ? 'rgba(196, 30, 58, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>📝</span>
                  <div>
                    <div style={{ fontWeight: '600' }}>{t.applicationMode}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.applicationDesc}</div>
                  </div>
                </div>
              </div>

              {/* 游客体验 */}
              <div
                onClick={() => setMode('guest')}
                style={{
                  padding: '1.25rem',
                  border: `2px solid ${mode === 'guest' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  background: mode === 'guest' ? 'rgba(196, 30, 58, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>👤</span>
                  <div>
                    <div style={{ fontWeight: '600' }}>{t.guestMode}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.guestDesc}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 邀请码输入 */}
            {mode === 'invitation' && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.inviteCode} *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t.inviteCodePlaceholder}
                    style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={verifyInviteCode} disabled={loading || !inviteCode}>
                  {loading ? '...' : t.verifyCode}
                </button>
              </div>
            )}

            {/* 申请加入 - 选择身份 */}
            {mode === 'application' && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.iAm}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {[
                      { value: 'admin', label: t.admin, icon: '👑' },
                      { value: 'teacher', label: t.teacher, icon: '👨‍🏫' },
                      { value: 'student', label: t.student, icon: '👨‍🎓' },
                      { value: 'parent', label: t.parent, icon: '👪' }
                    ].map(r => (
                      <button
                        key={r.value}
                        type="button"
                        className={`btn ${applyRole === r.value ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setApplyRole(r.value)}
                        style={{ padding: '0.75rem', fontSize: '0.875rem' }}
                      >
                        {r.icon} {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(2)}>
                  {t.next} →
                </button>
              </div>
            )}

            {/* 游客注册 */}
            {mode === 'guest' && (
              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
                  {t.guestNote}
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(2)}>
                  {t.next} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* 步骤2: 填写信息 */}
        {step === 2 && (
          <div>
            {/* 邀请码信息显示 */}
            {mode === 'invitation' && inviteInfo && (
              <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: '600' }}>
                      {inviteInfo.role === 'teacher' ? t.teacher : inviteInfo.role === 'student' ? t.student : inviteInfo.role === 'parent' ? t.parent : t.admin}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {inviteInfo.schools?.name_zh || inviteInfo.schools?.name}
                      {inviteInfo.classes && ` · ${inviteInfo.classes.name}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 申请 - 选择学校和班级 */}
            {mode === 'application' && (
              <>
                <div className="form-group">
                  <label className="form-label">{t.school} *</label>
                  <select className="form-select" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
                    <option value="">{t.selectSchool}</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name_zh || s.name}</option>
                    ))}
                  </select>
                </div>

                {(applyRole === 'teacher' || applyRole === 'student') && selectedSchool && (
                  <div className="form-group">
                    <label className="form-label">{t.class}</label>
                    <select className="form-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                      <option value="">{t.selectClass}</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (HSK{c.hsk_level})</option>
                      ))}
                    </select>
                  </div>
                )}

                {applyRole === 'parent' && (
                  <div className="form-group">
                    <label className="form-label">{t.linkedStudent}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={linkedStudent}
                      onChange={e => setLinkedStudent(e.target.value)}
                      placeholder={t.linkedStudentPlaceholder}
                    />
                  </div>
                )}
              </>
            )}

            {/* 通用表单 */}
            <div className="form-group">
              <label className="form-label">{t.name} *</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.nameZh}</label>
              <input
                type="text"
                className="form-input"
                value={form.nameZh}
                onChange={e => setForm({...form, nameZh: e.target.value})}
                placeholder="中文名（可选）"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{t.phone}</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.email}</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.password} *</label>
              <input
                type="password"
                className="form-input"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.confirmPassword} *</label>
              <input
                type="password"
                className="form-input"
                value={form.confirmPassword}
                onChange={e => setForm({...form, confirmPassword: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(1)}>
                ← {t.back}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>
                {t.next} →
              </button>
            </div>
          </div>
        )}

        {/* 步骤3: 验证 */}
        {step === 3 && (
          <div>
            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              {verifyType === 'phone' ? '📱' : '📧'} {verifyType === 'phone' ? t.verifyPhone : t.verifyEmail}
            </h3>

            <div className="form-group">
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={`btn ${verifyType === 'phone' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setVerifyType('phone')}
                  style={{ flex: 1 }}
                  disabled={!form.phone}
                >
                  📱 {t.phone}
                </button>
                <button
                  type="button"
                  className={`btn ${verifyType === 'email' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setVerifyType('email')}
                  style={{ flex: 1 }}
                  disabled={!form.email}
                >
                  📧 {t.email}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  value={form.verificationCode}
                  onChange={e => setForm({...form, verificationCode: e.target.value})}
                  placeholder={t.verificationCode}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-outline"
                  onClick={sendVerificationCode}
                  disabled={countdown > 0 || loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {countdown > 0 ? `${countdown}s` : codeSent ? t.resendCode : t.getCode}
                </button>
              </div>
            </div>

            {mode === 'application' && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1rem 0' }}>
                ℹ️ {t.applyNote}
              </p>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                ← {t.back}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  if (mode === 'invitation') handleInvitationRegister();
                  else if (mode === 'application') handleApplicationSubmit();
                  else handleGuestRegister();
                }}
                disabled={loading}
              >
                {loading ? '...' : mode === 'application' ? t.submit : t.register}
              </button>
            </div>
          </div>
        )}

        {/* 步骤4: 完成（仅申请模式） */}
        {step === 4 && mode === 'application' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ marginBottom: '1rem' }}>{language === 'zh' ? '申请已提交' : 'Application Submitted'}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              {t.applicationSubmitted}
            </p>
            <Link to="/login" className="btn btn-primary">
              {t.login}
            </Link>
          </div>
        )}

        {/* 登录链接 */}
        {step < 4 && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.haveAccount}</span>{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>{t.login}</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
