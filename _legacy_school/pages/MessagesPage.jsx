import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const MessagesPage = () => {
  const { user, supabase } = useAuth();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchContact, setSearchContact] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientType, setRecipientType] = useState('individual');
  const [composeData, setComposeData] = useState({ subject: '', content: '', send_email: false });

  const txt = {
    zh: {
      title: '消息中心',
      compose: '撰写',
      inbox: '收件箱',
      sent: '已发送',
      noMessages: '暂无消息',
      recipient: '收件人',
      subject: '主题',
      content: '内容',
      send: '发送',
      cancel: '取消',
      sendEmail: '同时发送邮件',
      searchPlaceholder: '搜索联系人...',
      recipientType: '发送对象',
      individual: '指定用户',
      role: '按角色',
      selectRecipients: '选择收件人',
      selected: '已选择',
      people: '人',
      teachers: '所有教师',
      students: '所有学生',
      parents: '所有家长',
      noContacts: '暂无联系人',
      from: '来自',
      reply: '回复',
      unread: '未读',
      messageRequired: '请输入消息内容',
      recipientRequired: '请选择收件人',
      sendSuccess: '发送成功！'
    },
    en: {
      title: 'Messages',
      compose: 'Compose',
      inbox: 'Inbox',
      sent: 'Sent',
      noMessages: 'No messages',
      recipient: 'Recipients',
      subject: 'Subject',
      content: 'Content',
      send: 'Send',
      cancel: 'Cancel',
      sendEmail: 'Also send as email',
      searchPlaceholder: 'Search contacts...',
      recipientType: 'Send To',
      individual: 'Individual',
      role: 'By Role',
      selectRecipients: 'Select Recipients',
      selected: 'Selected',
      people: 'people',
      teachers: 'All Teachers',
      students: 'All Students',
      parents: 'All Parents',
      noContacts: 'No contacts',
      from: 'From',
      reply: 'Reply',
      unread: 'Unread',
      messageRequired: 'Please enter message content',
      recipientRequired: 'Please select recipients',
      sendSuccess: 'Message sent!'
    },
    it: {
      title: 'Messaggi',
      compose: 'Scrivi',
      inbox: 'Posta in arrivo',
      sent: 'Inviati',
      noMessages: 'Nessun messaggio',
      recipient: 'Destinatari',
      subject: 'Oggetto',
      content: 'Contenuto',
      send: 'Invia',
      cancel: 'Annulla',
      sendEmail: 'Invia anche email',
      searchPlaceholder: 'Cerca contatti...',
      recipientType: 'Invia a',
      individual: 'Individuale',
      role: 'Per Ruolo',
      selectRecipients: 'Seleziona Destinatari',
      selected: 'Selezionati',
      people: 'persone',
      teachers: 'Tutti gli Insegnanti',
      students: 'Tutti gli Studenti',
      parents: 'Tutti i Genitori',
      noContacts: 'Nessun contatto',
      from: 'Da',
      reply: 'Rispondi',
      unread: 'Non letto',
      messageRequired: 'Inserisci il contenuto',
      recipientRequired: 'Seleziona i destinatari',
      sendSuccess: 'Messaggio inviato!'
    }
  };
  const tx = txt[language] || txt.en;

  useEffect(() => { loadMessages(); loadContacts(); }, [activeFolder]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      if (supabase && user) {
        let query = supabase.from('messages').select('*, sender:users!messages_sender_id_fkey(id, name, name_zh, username, role)');
        if (activeFolder === 'inbox') {
          query = query.eq('recipient_id', user.id);
        } else {
          query = query.eq('sender_id', user.id);
        }
        const { data } = await query.order('created_at', { ascending: false });
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      if (supabase && user) {
        const { data } = await supabase
          .from('users')
          .select('id, name, name_zh, username, role, email')
          .neq('id', user.id)
          .eq('is_active', true)
          .order('name');
        setContacts(data || []);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!composeData.content.trim()) { alert(tx.messageRequired); return; }
    if (selectedRecipients.length === 0) { alert(tx.recipientRequired); return; }

    try {
      const messagesToInsert = selectedRecipients.map(recipientId => ({
        sender_id: user.id,
        recipient_id: recipientId,
        subject: composeData.subject,
        content: composeData.content,
        send_email: composeData.send_email
      }));
      await supabase.from('messages').insert(messagesToInsert);
      setShowComposeModal(false);
      setComposeData({ subject: '', content: '', send_email: false });
      setSelectedRecipients([]);
      setSearchContact('');
      loadMessages();
      alert(tx.sendSuccess);
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  const toggleRecipient = (id) => {
    setSelectedRecipients(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectByRole = (role) => {
    const ids = contacts.filter(c => c.role === role).map(c => c.id);
    setSelectedRecipients(ids);
  };

  const markAsRead = async (id) => {
    try {
      await supabase.from('messages').update({ is_read: true }).eq('id', id);
      loadMessages();
    } catch (error) {
      console.error('Mark read failed:', error);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      teacher: { label: language === 'zh' ? '教师' : 'Teacher', color: '#3b82f6' },
      student: { label: language === 'zh' ? '学生' : 'Student', color: '#22c55e' },
      parent: { label: language === 'zh' ? '家长' : 'Parent', color: '#f59e0b' },
      admin: { label: language === 'zh' ? '管理' : 'Admin', color: '#ef4444' },
      super_admin: { label: language === 'zh' ? '超管' : 'Super', color: '#8b5cf6' }
    };
    const b = badges[role] || { label: role, color: '#6b7280' };
    return <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: `${b.color}20`, color: b.color }}>{b.label}</span>;
  };

  const filteredContacts = contacts.filter(c => {
    const s = searchContact.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.name_zh?.includes(searchContact) || c.username?.toLowerCase().includes(s);
  });

  const unreadCount = messages.filter(m => !m.is_read && activeFolder === 'inbox').length;

  if (loading && messages.length === 0) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>💬 {tx.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowComposeModal(true)}>✏️ {tx.compose}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <button className={`btn ${activeFolder === 'inbox' ? 'btn-primary' : 'btn-outline'}`} style={{ width: '100%', marginBottom: '0.5rem', justifyContent: 'space-between' }} onClick={() => setActiveFolder('inbox')}>
            <span>📥 {tx.inbox}</span>
            {unreadCount > 0 && <span style={{ background: 'var(--danger)', color: 'white', borderRadius: '1rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}>{unreadCount}</span>}
          </button>
          <button className={`btn ${activeFolder === 'sent' ? 'btn-primary' : 'btn-outline'}`} style={{ width: '100%' }} onClick={() => setActiveFolder('sent')}>📤 {tx.sent}</button>
        </div>

        <div className="card">
          {messages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(msg => (
                <div key={msg.id} onClick={() => { setSelectedMessage(msg); markAsRead(msg.id); }} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: msg.is_read ? 'var(--background)' : 'rgba(196, 30, 58, 0.05)', border: msg.is_read ? '1px solid var(--border)' : '1px solid var(--primary)', cursor: 'pointer', display: 'flex', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{(msg.sender?.name_zh || msg.sender?.name || '?').charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: msg.is_read ? 'normal' : 'bold' }}>{msg.sender?.name_zh || msg.sender?.name || msg.sender?.username}</span>
                        {msg.sender?.role && getRoleBadge(msg.sender.role)}
                        {!msg.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(msg.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {msg.subject && <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{msg.subject}</div>}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
              <p>{tx.noMessages}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="modal-overlay" onClick={() => setShowComposeModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0 }}>✏️ {tx.compose}</h3>
              <button onClick={() => setShowComposeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <form onSubmit={handleSend}>
              {/* Recipient Type */}
              <div className="form-group">
                <label className="form-label">{tx.recipientType}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className={`btn btn-sm ${recipientType === 'individual' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRecipientType('individual')}>👤 {tx.individual}</button>
                  <button type="button" className={`btn btn-sm ${recipientType === 'role' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRecipientType('role')}>👥 {tx.role}</button>
                </div>
              </div>

              {/* Role Selection */}
              {recipientType === 'role' && (
                <div className="form-group">
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => selectByRole('teacher')}>👨‍🏫 {tx.teachers}</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => selectByRole('student')}>👨‍🎓 {tx.students}</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => selectByRole('parent')}>👨‍👩‍👧 {tx.parents}</button>
                  </div>
                </div>
              )}

              {/* Contact List */}
              {recipientType === 'individual' && (
                <div className="form-group">
                  <label className="form-label">{tx.selectRecipients}</label>
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
                    <input type="text" className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder={tx.searchPlaceholder} value={searchContact} onChange={e => setSearchContact(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--background)' }}>
                    {filteredContacts.length > 0 ? filteredContacts.slice(0, 30).map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selectedRecipients.includes(c.id) ? 'rgba(196, 30, 58, 0.08)' : 'transparent', transition: 'background 0.15s' }}>
                        <input type="checkbox" checked={selectedRecipients.includes(c.id)} onChange={() => toggleRecipient(c.id)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: selectedRecipients.includes(c.id) ? 'var(--primary)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 'bold', flexShrink: 0 }}>{(c.name_zh || c.name || c.username).charAt(0)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name_zh || c.name || c.username}</span>
                            {getRoleBadge(c.role)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{c.username}</div>
                        </div>
                        {selectedRecipients.includes(c.id) && <span style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>✓</span>}
                      </label>
                    )) : <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                      {tx.noContacts}
                    </div>}
                  </div>
                </div>
              )}

              {/* Selected Display */}
              {selectedRecipients.length > 0 && (
                <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>✓ {tx.selected}: {selectedRecipients.length} {tx.people}</span>
                  {selectedRecipients.slice(0, 5).map(id => {
                    const c = contacts.find(x => x.id === id);
                    return c ? <span key={id} style={{ padding: '0.25rem 0.5rem', background: 'white', borderRadius: '1rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{c.name_zh || c.name}<button type="button" onClick={() => toggleRecipient(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--danger)' }}>×</button></span> : null;
                  })}
                  {selectedRecipients.length > 5 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{selectedRecipients.length - 5}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{tx.subject}</label>
                <input type="text" className="form-input" value={composeData.subject} onChange={e => setComposeData({...composeData, subject: e.target.value})} placeholder={language === 'zh' ? '可选' : 'Optional'} />
              </div>

              <div className="form-group">
                <label className="form-label">{tx.content} *</label>
                <textarea className="form-textarea" value={composeData.content} onChange={e => setComposeData({...composeData, content: e.target.value})} required rows={4} />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={composeData.send_email} onChange={e => setComposeData({...composeData, send_email: e.target.checked})} />
                  📧 {tx.sendEmail}
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowComposeModal(false)}>{tx.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={selectedRecipients.length === 0 || !composeData.content.trim()}>📤 {tx.send} {selectedRecipients.length > 0 && `(${selectedRecipients.length})`}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Detail */}
      {selectedMessage && (
        <div className="modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedMessage.subject || (language === 'zh' ? '无主题' : 'No Subject')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <span>{tx.from}:</span>
                  <span style={{ fontWeight: '500', color: 'var(--text)' }}>{selectedMessage.sender?.name_zh || selectedMessage.sender?.name}</span>
                  {selectedMessage.sender?.role && getRoleBadge(selectedMessage.sender.role)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{new Date(selectedMessage.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</div>
              </div>
              <button onClick={() => setSelectedMessage(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', minHeight: '100px' }}>{selectedMessage.content}</div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => { setSelectedMessage(null); setSelectedRecipients([selectedMessage.sender?.id].filter(Boolean)); setComposeData({ subject: `Re: ${selectedMessage.subject || ''}`, content: '', send_email: false }); setShowComposeModal(true); }}>↩️ {tx.reply}</button>
              <button className="btn btn-outline" onClick={() => setSelectedMessage(null)}>{tx.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
