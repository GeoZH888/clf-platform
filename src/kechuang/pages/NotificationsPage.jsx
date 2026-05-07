import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const NotificationsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('send');
  const [notifications, setNotifications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [form, setForm] = useState({
    title: '',
    content: '',
    notification_type: 'general',
    target_type: 'class',
    target_class_id: '',
    target_roles: ['student'],
    is_pinned: false
  });

  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';

  const txt = {
    zh: {
      title: '📢 发送通知',
      send: '发送通知',
      history: '发送记录',
      notificationTitle: '通知标题',
      content: '通知内容',
      type: '通知类型',
      general: '普通通知',
      urgent: '紧急通知',
      announcement: '公告',
      reminder: '提醒',
      targetType: '发送范围',
      toAll: '全部用户',
      toSchool: '全校',
      toClass: '指定班级',
      toUser: '指定用户',
      selectClass: '选择班级',
      targetRoles: '目标角色',
      teachers: '教师',
      students: '学生',
      parents: '家长',
      pinned: '置顶通知',
      sendBtn: '发送',
      sending: '发送中...',
      success: '发送成功！',
      failed: '发送失败',
      noNotifications: '暂无通知记录',
      sentAt: '发送时间',
      recipients: '接收人',
      preview: '预览',
      placeholder: {
        title: '请输入通知标题',
        content: '请输入通知内容...'
      }
    },
    en: {
      title: '📢 Send Notifications',
      send: 'Send',
      history: 'History',
      notificationTitle: 'Title',
      content: 'Content',
      type: 'Type',
      general: 'General',
      urgent: 'Urgent',
      announcement: 'Announcement',
      reminder: 'Reminder',
      targetType: 'Recipients',
      toAll: 'All Users',
      toSchool: 'Entire School',
      toClass: 'Specific Class',
      toUser: 'Specific Users',
      selectClass: 'Select Class',
      targetRoles: 'Target Roles',
      teachers: 'Teachers',
      students: 'Students',
      parents: 'Parents',
      pinned: 'Pin Notification',
      sendBtn: 'Send',
      sending: 'Sending...',
      success: 'Sent successfully!',
      failed: 'Failed to send',
      noNotifications: 'No notifications',
      sentAt: 'Sent at',
      recipients: 'Recipients',
      preview: 'Preview',
      placeholder: {
        title: 'Enter notification title',
        content: 'Enter notification content...'
      }
    },
    it: {
      title: '📢 Invia Notifiche',
      send: 'Invia',
      history: 'Storico',
      notificationTitle: 'Titolo',
      content: 'Contenuto',
      type: 'Tipo',
      general: 'Generale',
      urgent: 'Urgente',
      announcement: 'Annuncio',
      reminder: 'Promemoria',
      targetType: 'Destinatari',
      toAll: 'Tutti',
      toSchool: 'Tutta la Scuola',
      toClass: 'Classe Specifica',
      toUser: 'Utenti Specifici',
      selectClass: 'Seleziona Classe',
      targetRoles: 'Ruoli Destinatari',
      teachers: 'Insegnanti',
      students: 'Studenti',
      parents: 'Genitori',
      pinned: 'Notifica in Evidenza',
      sendBtn: 'Invia',
      sending: 'Invio...',
      success: 'Inviato con successo!',
      failed: 'Invio fallito',
      noNotifications: 'Nessuna notifica',
      sentAt: 'Inviato alle',
      recipients: 'Destinatari',
      preview: 'Anteprima',
      placeholder: {
        title: 'Inserisci titolo notifica',
        content: 'Inserisci contenuto notifica...'
      }
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) return;
    
    try {
      // 加载班级（教师）
      if (isTeacher) {
        const { data } = await supabase
          .from('dwxz_classes')
          .select('*')
          .eq('teacher_id', user?.id);
        setClasses(data || []);
      }

      // 加载发送历史
      const { data: notifData } = await supabase
        .from('dwxz_notifications')
        .select('*')
        .eq('sender_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(notifData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!form.title.trim() || !form.content.trim()) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写标题和内容' : 'Please fill in title and content' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const notificationData = {
        sender_id: user?.id,
        sender_role: user?.role,
        title: form.title,
        content: form.content,
        notification_type: form.notification_type,
        target_type: form.target_type,
        target_class_id: form.target_type === 'class' ? form.target_class_id : null,
        target_roles: form.target_roles,
        is_pinned: form.is_pinned
      };

      await supabase.from('dwxz_notifications').insert([notificationData]);

      setMessage({ type: 'success', text: t.success });
      setForm({
        title: '',
        content: '',
        notification_type: 'general',
        target_type: 'class',
        target_class_id: '',
        target_roles: ['student'],
        is_pinned: false
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role) => {
    setForm(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role]
    }));
  };

  const getTypeIcon = (type) => {
    const icons = { general: '📢', urgent: '🚨', announcement: '📣', reminder: '⏰' };
    return icons[type] || '📢';
  };

  const getTargetLabel = (notif) => {
    if (notif.target_type === 'all') return t.toAll;
    if (notif.target_type === 'school') return t.toSchool;
    if (notif.target_type === 'class') return t.toClass;
    return t.toUser;
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

      {/* 标签页 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>
          ✉️ {t.send}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📋 {t.history}
        </button>
      </div>

      {/* 发送通知 */}
      {activeTab === 'send' && (
        <div className="card">
          <form onSubmit={handleSend}>
            {/* 通知类型 */}
            <div className="form-group">
              <label className="form-label">{t.type}</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['general', 'urgent', 'announcement', 'reminder'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`btn ${form.notification_type === type ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setForm({...form, notification_type: type})}
                  >
                    {getTypeIcon(type)} {t[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* 发送范围 */}
            <div className="form-group">
              <label className="form-label">{t.targetType}</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className={`btn ${form.target_type === 'all' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setForm({...form, target_type: 'all'})}
                    >
                      🌐 {t.toAll}
                    </button>
                    <button
                      type="button"
                      className={`btn ${form.target_type === 'school' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setForm({...form, target_type: 'school'})}
                    >
                      🏫 {t.toSchool}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={`btn ${form.target_type === 'class' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm({...form, target_type: 'class'})}
                >
                  📚 {t.toClass}
                </button>
              </div>
            </div>

            {/* 选择班级 */}
            {form.target_type === 'class' && (
              <div className="form-group">
                <label className="form-label">{t.selectClass}</label>
                <select
                  className="form-select"
                  value={form.target_class_id}
                  onChange={(e) => setForm({...form, target_class_id: e.target.value})}
                  required
                >
                  <option value="">-- {t.selectClass} --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 目标角色 */}
            <div className="form-group">
              <label className="form-label">{t.targetRoles}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['student', 'teacher', 'parent'].map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.target_roles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {role === 'student' ? t.students : role === 'teacher' ? t.teachers : t.parents}
                  </label>
                ))}
              </div>
            </div>

            {/* 标题 */}
            <div className="form-group">
              <label className="form-label">{t.notificationTitle} *</label>
              <input
                type="text"
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                placeholder={t.placeholder.title}
                required
              />
            </div>

            {/* 内容 */}
            <div className="form-group">
              <label className="form-label">{t.content} *</label>
              <textarea
                className="form-textarea"
                value={form.content}
                onChange={(e) => setForm({...form, content: e.target.value})}
                placeholder={t.placeholder.content}
                rows={5}
                required
              />
            </div>

            {/* 置顶 */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(e) => setForm({...form, is_pinned: e.target.checked})}
                />
                📌 {t.pinned}
              </label>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? t.sending : `📤 ${t.sendBtn}`}
            </button>
          </form>
        </div>
      )}

      {/* 发送历史 */}
      {activeTab === 'history' && (
        <div className="card">
          {notifications.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              {t.noNotifications}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {notifications.map(notif => (
                <div key={notif.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <h4>{getTypeIcon(notif.notification_type)} {notif.title}</h4>
                    {notif.is_pinned && <span className="badge badge-warning">📌</span>}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    {notif.content.substring(0, 100)}...
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{t.sentAt}: {new Date(notif.created_at).toLocaleString()}</span>
                    <span>{t.recipients}: {getTargetLabel(notif)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
