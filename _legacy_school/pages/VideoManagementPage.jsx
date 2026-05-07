import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const VideoManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title_zh: '',
    title_en: '',
    title_it: '',
    description_zh: '',
    description_en: '',
    video_url: '',
    thumbnail: '🎬',
    duration: '',
    category: 'culture',
    hsk_level: 3,
    is_active: true
  });

  const txt = {
    zh: {
      title: '视频管理',
      subtitle: '上传和管理教学视频',
      add: '上传视频',
      search: '搜索视频...',
      all: '全部',
      festivals: '节日',
      food: '美食',
      art: '艺术',
      lifestyle: '生活',
      culture: '文化',
      history: '历史',
      language: '语言',
      titleZh: '标题(中文)',
      titleEn: '标题(英文)',
      descZh: '简介(中文)',
      descEn: '简介(英文)',
      videoUrl: '视频链接',
      duration: '时长',
      category: '分类',
      hskLevel: 'HSK等级',
      thumbnail: '缩略图',
      active: '已发布',
      inactive: '未发布',
      save: '保存',
      cancel: '取消',
      noData: '暂无视频',
      views: '播放',
      uploadFile: '上传文件',
      orPasteUrl: '或粘贴链接'
    },
    en: {
      title: 'Video Management',
      subtitle: 'Upload and manage teaching videos',
      add: 'Upload Video',
      search: 'Search videos...',
      all: 'All',
      festivals: 'Festivals',
      food: 'Food',
      art: 'Art',
      lifestyle: 'Lifestyle',
      culture: 'Culture',
      history: 'History',
      language: 'Language',
      titleZh: 'Title (Chinese)',
      titleEn: 'Title (English)',
      descZh: 'Description (Chinese)',
      descEn: 'Description (English)',
      videoUrl: 'Video URL',
      duration: 'Duration',
      category: 'Category',
      hskLevel: 'HSK Level',
      thumbnail: 'Thumbnail',
      active: 'Published',
      inactive: 'Unpublished',
      save: 'Save',
      cancel: 'Cancel',
      noData: 'No videos',
      views: 'views',
      uploadFile: 'Upload File',
      orPasteUrl: 'or paste URL'
    }
  };
  const t = txt[language] || txt.en;

  const categories = ['all', 'festivals', 'food', 'art', 'lifestyle', 'culture', 'history', 'language'];
  const thumbnails = ['🎬', '🎥', '📹', '🎞️', '🎭', '🎨', '🎵', '🏮', '🧧', '🍜', '🥟', '🍵'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const { data } = await supabase.from('culture_videos').select('*').order('created_at', { ascending: false });
        setVideos(data || []);
      } else {
        setVideos([
          { id: 1, title_zh: '中国春节习俗', title_en: 'Chinese New Year', thumbnail: '🧧', duration: '8:32', category: 'festivals', hsk_level: 3, views: 12500, is_active: true },
          { id: 2, title_zh: '中国茶文化', title_en: 'Tea Culture', thumbnail: '🍵', duration: '10:15', category: 'lifestyle', hsk_level: 4, views: 8900, is_active: true },
          { id: 3, title_zh: '中国书法入门', title_en: 'Chinese Calligraphy', thumbnail: '🖌️', duration: '15:20', category: 'art', hsk_level: 5, views: 7600, is_active: true },
          { id: 4, title_zh: '京剧艺术', title_en: 'Peking Opera', thumbnail: '🎭', duration: '12:45', category: 'art', hsk_level: 5, views: 5400, is_active: false },
          { id: 5, title_zh: '中国美食之旅', title_en: 'Chinese Cuisine Tour', thumbnail: '🥟', duration: '18:30', category: 'food', hsk_level: 3, views: 15200, is_active: true }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title_zh) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写标题' : 'Please enter a title' });
      return;
    }

    try {
      if (editItem) {
        if (supabase) {
          await supabase.from('culture_videos').update(form).eq('id', editItem.id);
        }
        setVideos(videos.map(v => v.id === editItem.id ? { ...v, ...form } : v));
        setMessage({ type: 'success', text: language === 'zh' ? '修改成功！' : 'Updated!' });
      } else {
        const newItem = { ...form, id: Date.now(), views: 0, created_at: new Date().toISOString() };
        if (supabase) {
          const { data } = await supabase.from('culture_videos').insert([form]).select();
          if (data) newItem.id = data[0].id;
        }
        setVideos([newItem, ...videos]);
        setMessage({ type: 'success', text: language === 'zh' ? '添加成功！' : 'Added!' });
      }
      resetForm();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setForm({ ...item });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(language === 'zh' ? '确定删除此视频吗？' : 'Delete this video?')) return;
    try {
      if (supabase) {
        await supabase.from('culture_videos').delete().eq('id', id);
      }
      setVideos(videos.filter(v => v.id !== id));
      setMessage({ type: 'success', text: language === 'zh' ? '删除成功！' : 'Deleted!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const resetForm = () => {
    setForm({
      title_zh: '', title_en: '', title_it: '', description_zh: '', description_en: '',
      video_url: '', thumbnail: '🎬', duration: '', category: 'culture', hsk_level: 3, is_active: true
    });
    setEditItem(null);
    setShowModal(false);
  };

  const filteredList = videos.filter(v =>
    (filterCategory === 'all' || v.category === filterCategory) &&
    (!searchTerm || v.title_zh?.includes(searchTerm) || v.title_en?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🎬 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + {t.add}
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, minWidth: '200px' }}
          placeholder={t.search}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select className="form-select" style={{ width: 'auto' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          {categories.map(cat => <option key={cat} value={cat}>{t[cat]}</option>)}
        </select>
      </div>

      {/* Video Grid */}
      {filteredList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
          <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filteredList.map(video => (
            <div key={video.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Thumbnail */}
              <div style={{
                height: '160px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <span style={{ fontSize: '4rem' }}>{video.thumbnail}</span>
                {video.duration && (
                  <span style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                  }}>
                    {video.duration}
                  </span>
                )}
                {!video.is_active && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#f59e0b',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                  }}>
                    {t.inactive}
                  </span>
                )}
              </div>
              
              {/* Info */}
              <div style={{ padding: '1rem' }}>
                <h4 style={{ marginBottom: '0.25rem' }}>{video.title_zh}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{video.title_en}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span className="badge">{t[video.category]}</span>
                  <span className="badge badge-info">HSK {video.hsk_level}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>👁️ {video.views?.toLocaleString()} {t.views}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => handleEdit(video)}>✏️ 编辑</button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleDelete(video.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editItem ? '✏️ 编辑视频' : '🎬 上传视频'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.titleZh} *</label>
                <input type="text" className="form-input" value={form.title_zh} onChange={e => setForm({ ...form, title_zh: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label">{t.titleEn}</label>
                <input type="text" className="form-input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">{t.descZh}</label>
                <textarea className="form-textarea" rows={3} value={form.description_zh} onChange={e => setForm({ ...form, description_zh: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">{t.videoUrl}</label>
                <input type="text" className="form-input" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.duration}</label>
                  <input type="text" className="form-input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="10:30" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.thumbnail}</label>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {thumbnails.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        style={{
                          width: '36px',
                          height: '36px',
                          border: form.thumbnail === emoji ? '2px solid var(--primary)' : '1px solid var(--border)',
                          borderRadius: '4px',
                          background: 'var(--background)',
                          cursor: 'pointer',
                          fontSize: '1.25rem'
                        }}
                        onClick={() => setForm({ ...form, thumbnail: emoji })}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.category}</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {categories.filter(c => c !== 'all').map(cat => <option key={cat} value={cat}>{t[cat]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select className="form-select" value={form.hsk_level} onChange={e => setForm({ ...form, hsk_level: parseInt(e.target.value) })}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">状态</label>
                  <select className="form-select" value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })}>
                    <option value="active">{t.active}</option>
                    <option value="inactive">{t.inactive}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={resetForm}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoManagementPage;
