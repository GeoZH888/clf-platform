import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const { t, language, setLanguage, languages } = useLanguage();
  const [formData, setFormData] = useState({ name: user?.name || '', phone: user?.phone || '', preferred_language: user?.preferred_language || 'zh' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await updateProfile(formData);
      if (result.success) {
        setMessage({ type: 'success', text: language === 'zh' ? '保存成功' : language === 'it' ? 'Salvato' : 'Saved successfully' });
        if (formData.preferred_language !== language) {
          setLanguage(formData.preferred_language);
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t('nav.profile')} 👤</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
        {/* Profile Card */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '3rem', color: 'white' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <h2>{user?.name}</h2>
          <p style={{ color: 'var(--text-muted)' }}>@{user?.username}</p>
          <span className="badge badge-primary" style={{ marginTop: '0.5rem' }}>{t(`roles.${user?.role}`)}</span>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
            <p><strong>{t('email')}:</strong> {user?.email}</p>
            <p><strong>{t('phone')}:</strong> {user?.phone || 'N/A'}</p>
            <p><strong>{language === 'zh' ? '注册时间' : language === 'it' ? 'Registrato' : 'Joined'}:</strong> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{language === 'zh' ? '编辑资料' : language === 'it' ? 'Modifica Profilo' : 'Edit Profile'}</h3>
          </div>

          {message && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('name')}</label>
              <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('phone')}</label>
              <input type="tel" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('select_language')}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    className={`btn ${formData.preferred_language === lang.code ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setFormData({...formData, preferred_language: lang.code})}
                  >
                    {lang.flag} {lang.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? t('loading') : t('save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
