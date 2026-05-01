import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const InvitationCodePage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [codes, setCodes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filter, setFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState('');

  const [form, setForm] = useState({
    role: 'student',
    classId: '',
    maxUses: 20,
    expiresIn: 30,
    note: ''
  });

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';

  const txt = {
    zh: {
      title: '🎫 邀请码管理',
      generate: '生成邀请码',
      code: '邀请码',
      role: '角色',
      class: '班级',
      quota: '配额',
      used: '已用',
      status: '状态',
      expires: '过期时间',
      actions: '操作',
      active: '有效',
      expired: '已过期',
      exhausted: '已用完',
      disabled: '已禁用',
      teacher: '教师',
      student: '学生',
      parent: '家长',
      admin: '管理员',
      all: '全部',
      selectClass: '选择班级',
      allClasses: '不限班级',
      maxUses: '可使用次数',
      expiresIn: '有效期（天）',
      note: '备注',
      cancel: '取消',
      create: '生成',
      copy: '复制',
      copied: '已复制！',
      disable: '禁用',
      delete: '删除',
      share: '分享',
      noData: '暂无邀请码',
      success: '操作成功！',
      failed: '操作失败',
      shareText: '邀请您加入大卫学中文！\n\n邀请码：{code}\n角色：{role}\n\n请访问注册页面，选择"邀请码注册"，输入以上邀请码即可加入。',
      codeFormat: '{prefix}-{random}',
      generatedCode: '新邀请码已生成',
      quotaInfo: '当前配额',
      teachers: '教师',
      students: '学生',
      parents: '家长'
    },
    en: {
      title: '🎫 Invitation Codes',
      generate: 'Generate Code',
      code: 'Code',
      role: 'Role',
      class: 'Class',
      quota: 'Quota',
      used: 'Used',
      status: 'Status',
      expires: 'Expires',
      actions: 'Actions',
      active: 'Active',
      expired: 'Expired',
      exhausted: 'Exhausted',
      disabled: 'Disabled',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
      admin: 'Admin',
      all: 'All',
      selectClass: 'Select Class',
      allClasses: 'Any Class',
      maxUses: 'Max Uses',
      expiresIn: 'Valid Days',
      note: 'Note',
      cancel: 'Cancel',
      create: 'Create',
      copy: 'Copy',
      copied: 'Copied!',
      disable: 'Disable',
      delete: 'Delete',
      share: 'Share',
      noData: 'No invitation codes',
      success: 'Success!',
      failed: 'Failed',
      shareText: 'Join David Learns Chinese!\n\nInvitation Code: {code}\nRole: {role}\n\nGo to registration page, select "Invitation Code" and enter the code.',
      codeFormat: '{prefix}-{random}',
      generatedCode: 'New code generated',
      quotaInfo: 'Current Quota',
      teachers: 'Teachers',
      students: 'Students',
      parents: 'Parents'
    },
    it: {
      title: '🎫 Codici Invito',
      generate: 'Genera Codice',
      code: 'Codice',
      role: 'Ruolo',
      class: 'Classe',
      quota: 'Quota',
      used: 'Usati',
      status: 'Stato',
      expires: 'Scadenza',
      actions: 'Azioni',
      active: 'Attivo',
      expired: 'Scaduto',
      exhausted: 'Esaurito',
      disabled: 'Disabilitato',
      teacher: 'Insegnante',
      student: 'Studente',
      parent: 'Genitore',
      admin: 'Admin',
      all: 'Tutti',
      selectClass: 'Seleziona Classe',
      allClasses: 'Qualsiasi Classe',
      maxUses: 'Usi Massimi',
      expiresIn: 'Giorni Validità',
      note: 'Nota',
      cancel: 'Annulla',
      create: 'Crea',
      copy: 'Copia',
      copied: 'Copiato!',
      disable: 'Disabilita',
      delete: 'Elimina',
      share: 'Condividi',
      noData: 'Nessun codice',
      success: 'Successo!',
      failed: 'Fallito',
      shareText: 'Unisciti a David Impara il Cinese!\n\nCodice Invito: {code}\nRuolo: {role}\n\nVai alla pagina registrazione e inserisci il codice.',
      codeFormat: '{prefix}-{random}',
      generatedCode: 'Nuovo codice generato',
      quotaInfo: 'Quota Attuale',
      teachers: 'Insegnanti',
      students: 'Studenti',
      parents: 'Genitori'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase.from('dwxz_invitation_codes')
        .select('*, classes(name, hsk_level)')
        .order('created_at', { ascending: false });

      if (isTeacher) {
        query = query.eq('created_by', user?.id);
      } else if (user?.school_id) {
        query = query.eq('school_id', user.school_id);
      }

      if (filter !== 'all') {
        query = query.eq('role', filter);
      }

      const { data } = await query;
      setCodes(data || []);

      // 加载班级
      let classQuery = supabase.from('dwxz_classes').select('id, name, hsk_level');
      if (isTeacher) {
        classQuery = classQuery.eq('teacher_id', user?.id);
      } else if (user?.school_id) {
        classQuery = classQuery.eq('school_id', user.school_id);
      }
      const { data: classData } = await classQuery;
      setClasses(classData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const prefixes = { admin: 'A', teacher: 'T', student: 'S', parent: 'P' };
    const prefix = prefixes[form.role] || 'X';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  };

  const handleCreate = async () => {
    try {
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + form.expiresIn);

      await supabase.from('dwxz_invitation_codes').insert([{
        code,
        school_id: user?.school_id,
        class_id: form.classId || null,
        role: form.role,
        max_uses: form.maxUses,
        expires_at: expiresAt.toISOString(),
        created_by: user?.id,
        note: form.note,
        is_active: true
      }]);

      setShowModal(false);
      setForm({ role: 'student', classId: '', maxUses: 20, expiresIn: 30, note: '' });
      setMessage({ type: 'success', text: `${t.generatedCode}: ${code}` });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const handleCopy = async (code) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleShare = (item) => {
    const roleNames = { teacher: t.teacher, student: t.student, parent: t.parent, admin: t.admin };
    const text = t.shareText
      .replace('{code}', item.code)
      .replace('{role}', roleNames[item.role]);

    if (navigator.share) {
      navigator.share({ title: '大卫学中文邀请码', text });
    } else {
      navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: t.copied });
    }
  };

  const handleDisable = async (id) => {
    await supabase.from('dwxz_invitation_codes').update({ is_active: false }).eq('id', id);
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(language === 'zh' ? '确定删除吗？' : 'Confirm delete?')) return;
    await supabase.from('dwxz_invitation_codes').delete().eq('id', id);
    loadData();
  };

  const getStatus = (item) => {
    if (!item.is_active) return { text: t.disabled, color: 'var(--text-muted)' };
    if (item.used_count >= item.max_uses) return { text: t.exhausted, color: 'var(--error)' };
    if (item.expires_at && new Date(item.expires_at) < new Date()) return { text: t.expired, color: 'var(--warning)' };
    return { text: t.active, color: 'var(--success)' };
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: { bg: 'var(--error)', icon: '👑' },
      teacher: { bg: 'var(--primary)', icon: '👨‍🏫' },
      student: { bg: 'var(--info)', icon: '👨‍🎓' },
      parent: { bg: 'var(--success)', icon: '👪' }
    };
    const s = styles[role] || styles.student;
    return (
      <span className="badge" style={{ background: s.bg, color: 'white' }}>
        {s.icon} {t[role]}
      </span>
    );
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + {t.generate}
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* 筛选 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {['all', 'teacher', 'student', 'parent'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t.all : t[f]}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : codes.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.code}</th>
                  <th>{t.role}</th>
                  <th>{t.class}</th>
                  <th>{t.quota}</th>
                  <th>{t.status}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(item => {
                  const status = getStatus(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <code style={{ 
                          background: 'var(--background)', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontWeight: '600',
                          letterSpacing: '1px'
                        }}>
                          {item.code}
                        </code>
                      </td>
                      <td>{getRoleBadge(item.role)}</td>
                      <td>{item.classes?.name || '-'}</td>
                      <td>
                        <span style={{ color: item.used_count >= item.max_uses ? 'var(--error)' : 'inherit' }}>
                          {item.used_count}/{item.max_uses}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: status.color, fontWeight: '500' }}>
                          {status.text}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-outline btn-sm" 
                            onClick={() => handleCopy(item.code)}
                            style={{ minWidth: 'auto', padding: '0.25rem 0.5rem' }}
                          >
                            {copiedCode === item.code ? '✓' : '📋'}
                          </button>
                          <button 
                            className="btn btn-outline btn-sm"
                            onClick={() => handleShare(item)}
                            style={{ minWidth: 'auto', padding: '0.25rem 0.5rem' }}
                          >
                            📤
                          </button>
                          {item.is_active && (
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleDisable(item.id)}
                              style={{ minWidth: 'auto', padding: '0.25rem 0.5rem', color: 'var(--warning)' }}
                            >
                              ⏸
                            </button>
                          )}
                          <button 
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDelete(item.id)}
                            style={{ minWidth: 'auto', padding: '0.25rem 0.5rem', color: 'var(--error)' }}
                          >
                            ✗
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 生成模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>🎫 {t.generate}</h3>

            <div className="form-group">
              <label className="form-label">{t.role} *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {['teacher', 'student', 'parent'].map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`btn ${form.role === r ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({...form, role: r})}
                    style={{ padding: '0.5rem' }}
                  >
                    {r === 'teacher' ? '👨‍🏫' : r === 'student' ? '👨‍🎓' : '👪'} {t[r]}
                  </button>
                ))}
                {isAdmin && (
                  <button
                    type="button"
                    className={`btn ${form.role === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({...form, role: 'admin'})}
                    style={{ padding: '0.5rem' }}
                  >
                    👑 {t.admin}
                  </button>
                )}
              </div>
            </div>

            {(form.role === 'student' || form.role === 'teacher') && (
              <div className="form-group">
                <label className="form-label">{t.class}</label>
                <select className="form-select" value={form.classId} onChange={e => setForm({...form, classId: e.target.value})}>
                  <option value="">{t.allClasses}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (HSK{c.hsk_level})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.maxUses}</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.maxUses}
                  onChange={e => setForm({...form, maxUses: parseInt(e.target.value) || 1})}
                  min="1"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.expiresIn}</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.expiresIn}
                  onChange={e => setForm({...form, expiresIn: parseInt(e.target.value) || 7})}
                  min="1"
                  max="365"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.note}</label>
              <input
                type="text"
                className="form-input"
                value={form.note}
                onChange={e => setForm({...form, note: e.target.value})}
                placeholder={language === 'zh' ? '例如：2024春季班' : 'e.g., Spring 2024'}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>{t.create}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationCodePage;
