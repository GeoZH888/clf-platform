import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ApplicationReviewPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDetail, setShowDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const txt = {
    zh: {
      title: '📋 申请审核',
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      all: '全部',
      name: '姓名',
      role: '申请身份',
      school: '学校',
      class: '班级',
      contact: '联系方式',
      applyTime: '申请时间',
      status: '状态',
      actions: '操作',
      approve: '通过',
      reject: '拒绝',
      viewDetail: '详情',
      noData: '暂无申请',
      admin: '管理员',
      teacher: '教师',
      student: '学生',
      parent: '家长',
      phone: '手机',
      email: '邮箱',
      verified: '已验证',
      unverified: '未验证',
      linkedStudent: '关联学生',
      rejectReason: '拒绝原因',
      rejectPlaceholder: '请输入拒绝原因（可选）',
      cancel: '取消',
      confirm: '确认',
      success: '操作成功！',
      failed: '操作失败',
      approveConfirm: '确定通过此申请？用户将可以立即登录使用。',
      reviewedBy: '审核人',
      reviewedAt: '审核时间',
      sendNotification: '发送通知',
      notifyEmail: '邮件通知',
      notifySms: '短信通知'
    },
    en: {
      title: '📋 Application Review',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      all: 'All',
      name: 'Name',
      role: 'Applied Role',
      school: 'School',
      class: 'Class',
      contact: 'Contact',
      applyTime: 'Applied',
      status: 'Status',
      actions: 'Actions',
      approve: 'Approve',
      reject: 'Reject',
      viewDetail: 'Details',
      noData: 'No applications',
      admin: 'Admin',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
      phone: 'Phone',
      email: 'Email',
      verified: 'Verified',
      unverified: 'Unverified',
      linkedStudent: 'Linked Student',
      rejectReason: 'Rejection Reason',
      rejectPlaceholder: 'Enter reason (optional)',
      cancel: 'Cancel',
      confirm: 'Confirm',
      success: 'Success!',
      failed: 'Failed',
      approveConfirm: 'Approve this application? User will be able to login immediately.',
      reviewedBy: 'Reviewed by',
      reviewedAt: 'Reviewed at',
      sendNotification: 'Send Notification',
      notifyEmail: 'Email',
      notifySms: 'SMS'
    },
    it: {
      title: '📋 Revisione Richieste',
      pending: 'In Attesa',
      approved: 'Approvate',
      rejected: 'Rifiutate',
      all: 'Tutte',
      name: 'Nome',
      role: 'Ruolo Richiesto',
      school: 'Scuola',
      class: 'Classe',
      contact: 'Contatto',
      applyTime: 'Data Richiesta',
      status: 'Stato',
      actions: 'Azioni',
      approve: 'Approva',
      reject: 'Rifiuta',
      viewDetail: 'Dettagli',
      noData: 'Nessuna richiesta',
      admin: 'Admin',
      teacher: 'Insegnante',
      student: 'Studente',
      parent: 'Genitore',
      phone: 'Telefono',
      email: 'Email',
      verified: 'Verificato',
      unverified: 'Non verificato',
      linkedStudent: 'Studente Collegato',
      rejectReason: 'Motivo Rifiuto',
      rejectPlaceholder: 'Inserisci motivo (opzionale)',
      cancel: 'Annulla',
      confirm: 'Conferma',
      success: 'Successo!',
      failed: 'Fallito',
      approveConfirm: 'Approvare questa richiesta? L\'utente potrà accedere immediatamente.',
      reviewedBy: 'Revisionato da',
      reviewedAt: 'Revisionato il',
      sendNotification: 'Invia Notifica',
      notifyEmail: 'Email',
      notifySms: 'SMS'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase.from('user_applications')
        .select('*, schools(name, name_zh), classes(name)')
        .order('created_at', { ascending: false });

      // 根据用户角色过滤
      if (user?.role === 'admin' && user?.school_id) {
        query = query.eq('school_id', user.school_id);
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setApplications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app) => {
    if (!window.confirm(t.approveConfirm)) return;

    try {
      // 创建用户账号
      const { data: newUser, error: userErr } = await supabase.from('users').insert([{
        username: app.phone || app.email?.split('@')[0] || `user_${Date.now()}`,
        name: app.name,
        name_zh: app.name_zh,
        email: app.email,
        phone: app.phone,
        password_hash: app.password_hash,
        role: app.apply_role,
        school_id: app.school_id,
        registration_type: 'application',
        application_id: app.id,
        is_active: true
      }]).select().single();

      if (userErr) throw userErr;

      // 如果有班级，加入班级
      if (app.class_id && (app.apply_role === 'student' || app.apply_role === 'teacher')) {
        await supabase.from('class_enrollments').insert([{
          class_id: app.class_id,
          student_id: newUser.id,
          status: 'active'
        }]);
      }

      // 更新申请状态
      await supabase.from('user_applications').update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', app.id);

      // 发送通知
      await sendNotification(app, 'approved');

      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReject = async (app) => {
    try {
      await supabase.from('user_applications').update({
        status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason
      }).eq('id', app.id);

      // 发送通知
      await sendNotification(app, 'rejected');

      setShowDetail(null);
      setRejectReason('');
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const sendNotification = async (app, type) => {
    // 创建通知记录
    const content = type === 'approved'
      ? (language === 'zh' ? '您的加入申请已通过，现在可以登录使用了！' : 'Your application has been approved!')
      : (language === 'zh' ? `您的加入申请未通过。${rejectReason ? '原因：' + rejectReason : ''}` : `Your application was rejected. ${rejectReason ? 'Reason: ' + rejectReason : ''}`);

    await supabase.from('review_notifications').insert([{
      application_id: app.id,
      recipient_email: app.email,
      recipient_phone: app.phone,
      notification_type: type,
      channel: app.email ? 'email' : 'sms',
      content
    }]);
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: { bg: 'var(--error)', icon: '👑' },
      teacher: { bg: 'var(--primary)', icon: '👨‍🏫' },
      student: { bg: 'var(--info)', icon: '👨‍🎓' },
      parent: { bg: 'var(--success)', icon: '👪' }
    };
    const s = styles[role] || styles.student;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.icon} {t[role]}</span>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--warning)', text: t.pending },
      approved: { bg: 'var(--success)', text: t.approved },
      rejected: { bg: 'var(--error)', text: t.rejected }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* 筛选 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {t[f]} {f === 'pending' && applications.filter(a => a.status === 'pending').length > 0 && (
              <span className="badge badge-error" style={{ marginLeft: '0.25rem' }}>
                {applications.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : applications.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {applications.map(app => (
              <div key={app.id} style={{ 
                padding: '1rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)',
                borderLeft: `4px solid ${app.status === 'pending' ? 'var(--warning)' : app.status === 'approved' ? 'var(--success)' : 'var(--error)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong>{app.name_zh || app.name}</strong>
                      {getRoleBadge(app.apply_role)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {app.schools?.name_zh || app.schools?.name}
                      {app.classes && ` · ${app.classes.name}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {getStatusBadge(app.status)}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                  {app.phone && (
                    <span>
                      📱 {app.phone} 
                      <span style={{ color: app.phone_verified ? 'var(--success)' : 'var(--text-muted)', marginLeft: '0.25rem' }}>
                        {app.phone_verified ? '✓' : '○'}
                      </span>
                    </span>
                  )}
                  {app.email && (
                    <span>
                      📧 {app.email}
                      <span style={{ color: app.email_verified ? 'var(--success)' : 'var(--text-muted)', marginLeft: '0.25rem' }}>
                        {app.email_verified ? '✓' : '○'}
                      </span>
                    </span>
                  )}
                  {app.linked_student_name && (
                    <span>👶 {app.linked_student_name}</span>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleApprove(app)}>
                      ✓ {t.approve}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setShowDetail(app)}>
                      ✗ {t.reject}
                    </button>
                  </div>
                )}

                {app.status === 'rejected' && app.rejection_reason && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', fontSize: '0.875rem' }}>
                    <strong>{t.rejectReason}:</strong> {app.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 拒绝原因模态框 */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>✗ {t.reject}</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              {showDetail.name_zh || showDetail.name} - {t[showDetail.apply_role]}
            </p>
            <div className="form-group">
              <label className="form-label">{t.rejectReason}</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder={t.rejectPlaceholder}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => { setShowDetail(null); setRejectReason(''); }}>
                {t.cancel}
              </button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={() => handleReject(showDetail)}>
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationReviewPage;
