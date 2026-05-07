import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const EventsPage = () => {
  const { user, isTeacher, isAdmin, supabase } = useAuth();
  const { t, language } = useLanguage();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', title_zh: '', description: '', event_type: 'general', start_date: '', end_date: '', location: '' });

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      if (supabase) {
        const { data } = await supabase
          .from('dwxz_events')
          .select('*')
          .order('start_date', { ascending: true })
          .limit(50);
        setEvents(data || []);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('dwxz_events').insert([{ ...formData, created_by: user.id }]);
      setShowModal(false);
      setFormData({ title: '', title_zh: '', description: '', event_type: 'general', start_date: '', end_date: '', location: '' });
      loadEvents();
    } catch (error) {
      alert('Failed to create event');
    }
  };

  const getEventTypeIcon = (type) => {
    switch (type) {
      case 'exam': return '📝';
      case 'holiday': return '🎉';
      case 'meeting': return '👥';
      case 'cultural': return '🎈';
      case 'class': return '📚';
      default: return '📢';
    }
  };

  const getEventTitle = (event) => {
    if (language === 'zh' && event.title_zh) return event.title_zh;
    if (language === 'it' && event.title_it) return event.title_it;
    return event.title;
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>{t('events.title')} 📅</h1>
        {(isTeacher || isAdmin) && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ {t('events.create')}</button>
        )}
      </div>

      {events.length > 0 ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {events.map((event, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
              <div style={{ fontSize: '2.5rem', padding: '0.5rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                {getEventTypeIcon(event.event_type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3>{getEventTitle(event)}</h3>
                    <span className="badge badge-info">{event.event_type}</span>
                  </div>
                  {event.is_pinned && <span className="badge badge-warning">📌 {language === 'zh' ? '置顶' : 'Pinned'}</span>}
                </div>
                <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                  {language === 'zh' && event.description_zh ? event.description_zh : 
                   language === 'it' && event.description_it ? event.description_it : 
                   event.description}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {event.start_date && <span>📅 {new Date(event.start_date).toLocaleDateString()}</span>}
                  {event.location && <span>📍 {event.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '4rem' }}>📅</span>
            <p>{language === 'zh' ? '暂无活动' : language === 'it' ? 'Nessun evento' : 'No events'}</p>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('events.create')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Title (EN) *</label>
                    <input type="text" className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">标题 (ZH)</label>
                    <input type="text" className="form-input" value={formData.title_zh} onChange={e => setFormData({...formData, title_zh: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titolo (IT)</label>
                    <input type="text" className="form-input" value={formData.title_it} onChange={e => setFormData({...formData, title_it: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '类型' : language === 'it' ? 'Tipo' : 'Type'}</label>
                  <select className="form-select" value={formData.event_type} onChange={e => setFormData({...formData, event_type: e.target.value})}>
                    <option value="notice">{language === 'zh' ? '通知' : 'Notice'}</option>
                    <option value="class">{language === 'zh' ? '课程' : 'Class'}</option>
                    <option value="exam">{language === 'zh' ? '考试' : 'Exam'}</option>
                    <option value="holiday">{language === 'zh' ? '假期' : 'Holiday'}</option>
                    <option value="meeting">{language === 'zh' ? '会议' : 'Meeting'}</option>
                    <option value="activity">{language === 'zh' ? '活动' : 'Activity'}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '描述' : language === 'it' ? 'Descrizione' : 'Description'}</label>
                  <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t('events.start_date')}</label>
                    <input type="datetime-local" className="form-input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('events.end_date')}</label>
                    <input type="datetime-local" className="form-input" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '地点' : language === 'it' ? 'Luogo' : 'Location'}</label>
                  <input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
