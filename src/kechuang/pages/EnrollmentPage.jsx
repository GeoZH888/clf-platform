import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const EnrollmentPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('enrollment');
  const [enrollments, setEnrollments] = useState([]);
  const [hskRegs, setHskRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const t = {
    zh: { title: '📝 报名管理', enrollment: '入学报名', hsk: 'HSK报名', pending: '待审核', approved: '已通过', rejected: '已拒绝', name: '姓名', phone: '电话', date: '日期', level: 'HSK级别', status: '状态', actions: '操作', approve: '通过', reject: '拒绝', noData: '暂无数据', success: '操作成功' },
    en: { title: '📝 Enrollment', enrollment: 'School Enrollment', hsk: 'HSK Registration', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', name: 'Name', phone: 'Phone', date: 'Date', level: 'HSK Level', status: 'Status', actions: 'Actions', approve: 'Approve', reject: 'Reject', noData: 'No data', success: 'Success' },
    it: { title: '📝 Iscrizioni', enrollment: 'Iscrizione Scuola', hsk: 'Registrazione HSK', pending: 'In attesa', approved: 'Approvato', rejected: 'Rifiutato', name: 'Nome', phone: 'Telefono', date: 'Data', level: 'Livello HSK', status: 'Stato', actions: 'Azioni', approve: 'Approva', reject: 'Rifiuta', noData: 'Nessun dato', success: 'Successo' }
  }[language] || {};

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      if (activeTab === 'enrollment') {
        const { data } = await supabase.from('dwxz_enrollments').select('*').order('created_at', { ascending: false });
        setEnrollments(data || []);
      } else {
        const { data } = await supabase.from('dwxz_hsk_registrations').select('*').order('created_at', { ascending: false });
        setHskRegs(data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAction = async (id, status, table) => {
    try {
      await supabase.from(table).update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (e) { setMessage({ type: 'error', text: e.message }); }
  };

  const StatusBadge = ({ status }) => {
    const colors = { pending: 'var(--warning)', approved: 'var(--success)', rejected: 'var(--error)' };
    const labels = { pending: t.pending, approved: t.approved, rejected: t.rejected };
    return <span className="badge" style={{ background: colors[status], color: 'white' }}>{labels[status]}</span>;
  };

  return (
    <div>
      <div className="content-header"><h1>{t.title}</h1></div>
      {message.text && <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>{message.text}</div>}
      
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'enrollment' ? 'active' : ''}`} onClick={() => setActiveTab('enrollment')}>🎓 {t.enrollment}</button>
        <button className={`tab ${activeTab === 'hsk' ? 'active' : ''}`} onClick={() => setActiveTab('hsk')}>🏆 {t.hsk}</button>
      </div>

      <div className="card">
        {loading ? <p>Loading...</p> : (
          activeTab === 'enrollment' ? (
            enrollments.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t.noData}</p> : (
              <div className="table-container">
                <table style={{ width: '100%' }}>
                  <thead><tr><th>{t.name}</th><th>{t.phone}</th><th>{t.date}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead>
                  <tbody>
                    {enrollments.map(e => (
                      <tr key={e.id}>
                        <td>{e.student_name_zh || e.student_name}</td>
                        <td>{e.parent_phone || '-'}</td>
                        <td>{new Date(e.created_at).toLocaleDateString()}</td>
                        <td><StatusBadge status={e.status} /></td>
                        <td>
                          {e.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleAction(e.id, 'approved', 'enrollments')}>✓ {t.approve}</button>
                              <button className="btn btn-outline btn-sm" onClick={() => handleAction(e.id, 'rejected', 'enrollments')}>✗</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            hskRegs.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t.noData}</p> : (
              <div className="table-container">
                <table style={{ width: '100%' }}>
                  <thead><tr><th>{t.name}</th><th>{t.level}</th><th>{t.date}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead>
                  <tbody>
                    {hskRegs.map(r => (
                      <tr key={r.id}>
                        <td>{r.student_name_zh || r.student_name}</td>
                        <td><span className="badge badge-info">HSK {r.hsk_level}</span></td>
                        <td>{r.exam_date || new Date(r.created_at).toLocaleDateString()}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          {r.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleAction(r.id, 'approved', 'hsk_registrations')}>✓ {t.approve}</button>
                              <button className="btn btn-outline btn-sm" onClick={() => handleAction(r.id, 'rejected', 'hsk_registrations')}>✗</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
};

export default EnrollmentPage;
