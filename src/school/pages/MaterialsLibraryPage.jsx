import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const MaterialsLibraryPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({ search: '', hskLevel: '', type: '' });
  
  const [uploadForm, setUploadForm] = useState({
    title: '', title_zh: '', description: '', material_type: 'document',
    source_type: 'internal', hsk_levels: [], skill_types: [], topics: '',
    content_url: '', content_text: ''
  });

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const txt = {
    zh: {
      title: '📚 教学资料库', all: '全部', internal: '内部', external: '外部',
      myUploads: '我的上传', pending: '待审核', upload: '上传资料',
      search: '搜索...', filterHSK: 'HSK等级', filterType: '类型',
      video: '视频', audio: '音频', document: '文档', exercise: '练习',
      save: '保存', cancel: '取消', noData: '暂无', success: '成功！',
      use: '使用', delete: '删除', approve: '通过', materialTitle: '标题',
      description: '描述', contentUrl: '链接', hskLevels: 'HSK等级'
    },
    en: {
      title: '📚 Materials Library', all: 'All', internal: 'Internal', external: 'External',
      myUploads: 'My Uploads', pending: 'Pending', upload: 'Upload',
      search: 'Search...', filterHSK: 'HSK Level', filterType: 'Type',
      video: 'Video', audio: 'Audio', document: 'Document', exercise: 'Exercise',
      save: 'Save', cancel: 'Cancel', noData: 'No data', success: 'Success!',
      use: 'Use', delete: 'Delete', approve: 'Approve', materialTitle: 'Title',
      description: 'Description', contentUrl: 'URL', hskLevels: 'HSK Levels'
    },
    it: {
      title: '📚 Libreria Materiali', all: 'Tutti', internal: 'Interni', external: 'Esterni',
      myUploads: 'Miei Upload', pending: 'In Revisione', upload: 'Carica',
      search: 'Cerca...', filterHSK: 'Livello HSK', filterType: 'Tipo',
      video: 'Video', audio: 'Audio', document: 'Documento', exercise: 'Esercizio',
      save: 'Salva', cancel: 'Annulla', noData: 'Nessun dato', success: 'Successo!',
      use: 'Usa', delete: 'Elimina', approve: 'Approva', materialTitle: 'Titolo',
      description: 'Descrizione', contentUrl: 'URL', hskLevels: 'Livelli HSK'
    }
  };
  const t = txt[language] || txt.en;

  const materialTypes = [
    { value: 'video', label: t.video, icon: '🎬' },
    { value: 'audio', label: t.audio, icon: '🎧' },
    { value: 'document', label: t.document, icon: '📄' },
    { value: 'exercise', label: t.exercise, icon: '📝' }
  ];

  useEffect(() => { loadMaterials(); }, [activeTab, filters]);

  const loadMaterials = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query = supabase.from('teaching_materials').select('*').order('created_at', { ascending: false });
      if (activeTab === 'internal') query = query.eq('source_type', 'internal');
      else if (activeTab === 'external') query = query.eq('source_type', 'external');
      else if (activeTab === 'myUploads') query = query.eq('uploaded_by', user?.id);
      else if (activeTab === 'pending') query = query.eq('is_reviewed', false);
      if (filters.hskLevel) query = query.contains('hsk_levels', [parseInt(filters.hskLevel)]);
      if (filters.type) query = query.eq('material_type', filters.type);
      const { data } = await query;
      let filtered = data || [];
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(m => m.title?.toLowerCase().includes(search) || m.title_zh?.toLowerCase().includes(search));
      }
      setMaterials(filtered);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUpload = async () => {
    try {
      await supabase.from('teaching_materials').insert([{
        ...uploadForm,
        title: uploadForm.title || uploadForm.title_zh,
        hsk_levels: uploadForm.hsk_levels.length > 0 ? uploadForm.hsk_levels : [1],
        uploaded_by: user?.id, is_active: true, is_reviewed: isAdmin
      }]);
      setShowUploadModal(false);
      setMessage({ type: 'success', text: t.success });
      loadMaterials();
    } catch (err) { setMessage({ type: 'error', text: 'Failed' }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Confirm?')) return;
    await supabase.from('teaching_materials').delete().eq('id', id);
    loadMaterials();
  };

  const handleApprove = async (id) => {
    await supabase.from('teaching_materials').update({ is_reviewed: true }).eq('id', id);
    loadMaterials();
  };

  const getTypeIcon = (type) => materialTypes.find(t => t.value === type)?.icon || '📄';

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>+ {t.upload}</button>
      </div>

      {message.text && <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>{message.text}</div>}

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {['all', 'internal', 'external', 'myUploads'].map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {t[tab]}
          </button>
        ))}
        {isAdmin && <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>⏳ {t.pending}</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="text" className="form-input" placeholder={t.search} value={filters.search}
          onChange={e => setFilters({...filters, search: e.target.value})} style={{ flex: 1, minWidth: '150px' }} />
        <select className="form-select" value={filters.hskLevel} onChange={e => setFilters({...filters, hskLevel: e.target.value})} style={{ width: 'auto' }}>
          <option value="">{t.filterHSK}</option>
          {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK{l}</option>)}
        </select>
        <select className="form-select" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} style={{ width: 'auto' }}>
          <option value="">{t.filterType}</option>
          {materialTypes.map(mt => <option key={mt.value} value={mt.value}>{mt.icon} {mt.label}</option>)}
        </select>
      </div>

      {loading ? <p>Loading...</p> : materials.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}><p style={{ color: 'var(--text-muted)' }}>{t.noData}</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {materials.map(m => (
            <div key={m.id} className="card">
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '2rem' }}>{getTypeIcon(m.material_type)}</div>
                <div style={{ flex: 1 }}>
                  <h4>{m.title_zh || m.title}</h4>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {m.hsk_levels?.map(l => <span key={l} className="badge badge-info" style={{ fontSize: '0.7rem' }}>HSK{l}</span>)}
                    <span className="badge" style={{ fontSize: '0.7rem' }}>{m.source_type}</span>
                  </div>
                </div>
              </div>
              {m.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{m.description.substring(0, 80)}...</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm">{t.use}</button>
                {activeTab === 'pending' && isAdmin && <button className="btn btn-outline btn-sm" onClick={() => handleApprove(m.id)}>{t.approve}</button>}
                {(isAdmin || m.uploaded_by === user?.id) && <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(m.id)}>✗</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1rem' }}>📤 {t.upload}</h3>
            <div className="form-group">
              <label className="form-label">{t.materialTitle} *</label>
              <input className="form-input" value={uploadForm.title_zh} onChange={e => setUploadForm({...uploadForm, title_zh: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.description}</label>
              <textarea className="form-textarea" rows={3} value={uploadForm.description} onChange={e => setUploadForm({...uploadForm, description: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.filterType}</label>
                <select className="form-select" value={uploadForm.material_type} onChange={e => setUploadForm({...uploadForm, material_type: e.target.value})}>
                  {materialTypes.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Source</label>
                <select className="form-select" value={uploadForm.source_type} onChange={e => setUploadForm({...uploadForm, source_type: e.target.value})}>
                  <option value="internal">{t.internal}</option>
                  <option value="external">{t.external}</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t.hskLevels}</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6].map(l => (
                  <button key={l} type="button" className={`btn btn-sm ${uploadForm.hsk_levels.includes(l) ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setUploadForm({...uploadForm, hsk_levels: uploadForm.hsk_levels.includes(l) 
                      ? uploadForm.hsk_levels.filter(x => x !== l) : [...uploadForm.hsk_levels, l]})}>
                    HSK{l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t.contentUrl}</label>
              <input className="form-input" value={uploadForm.content_url} onChange={e => setUploadForm({...uploadForm, content_url: e.target.value})} placeholder="https://..." />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowUploadModal(false)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpload}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialsLibraryPage;
