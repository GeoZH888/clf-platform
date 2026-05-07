import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { classesAPI } from '../services/api';
import api from '../services/api';

const TeacherMaterialsPage = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [materials, setMaterials] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    title_zh: '',
    title_it: '',
    description: '',
    type: 'document',
    hsk_level: 1,
    share_type: 'class', // 'class', 'individual', 'public'
    class_ids: [],
    student_ids: [],
    file: null
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [classesRes, materialsRes] = await Promise.all([
        classesAPI.getAll(),
        api.get('/materials/teacher')
      ]);
      setClasses(classesRes.data.classes || []);
      setMaterials(materialsRes.data.materials || []);
      
      // Extract students
      const allStudents = [];
      for (const cls of classesRes.data.classes || []) {
        if (cls.students) {
          cls.students.forEach(s => {
            if (!allStudents.find(st => st.id === s.id)) {
              allStudents.push({ ...s, class_name: cls.name });
            }
          });
        }
      }
      setStudents(allStudents);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(uploadForm).forEach(key => {
        if (key === 'file' && uploadForm.file) {
          formData.append('file', uploadForm.file);
        } else if (key === 'class_ids' || key === 'student_ids') {
          formData.append(key, JSON.stringify(uploadForm[key]));
        } else {
          formData.append(key, uploadForm[key]);
        }
      });

      await api.post('/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowUploadModal(false);
      setUploadForm({
        title: '', title_zh: '', title_it: '', description: '', type: 'document',
        hsk_level: 1, share_type: 'class', class_ids: [], student_ids: [], file: null
      });
      loadData();
    } catch (error) {
      alert('Failed to upload material');
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await api.delete(`/materials/${id}`);
      loadData();
    } catch (error) {
      alert('Failed to delete material');
    }
  };

  const texts = {
    zh: {
      title: '教学资料管理',
      upload: '上传资料',
      my_materials: '我的资料',
      material_title: '资料标题',
      material_type: '资料类型',
      share_to: '分享给',
      share_class: '分享给班级',
      share_individual: '分享给特定学生',
      share_public: '公开（所有学生）',
      select_classes: '选择班级',
      select_students: '选择学生',
      select_file: '选择文件',
      document: '文档',
      video: '视频',
      audio: '音频',
      image: '图片',
      ppt: 'PPT',
      no_materials: '暂无资料',
      download: '下载',
      delete: '删除',
      shared_with: '分享给'
    },
    en: {
      title: 'Teaching Materials Management',
      upload: 'Upload Material',
      my_materials: 'My Materials',
      material_title: 'Material Title',
      material_type: 'Material Type',
      share_to: 'Share To',
      share_class: 'Share with Classes',
      share_individual: 'Share with Specific Students',
      share_public: 'Public (All Students)',
      select_classes: 'Select Classes',
      select_students: 'Select Students',
      select_file: 'Select File',
      document: 'Document',
      video: 'Video',
      audio: 'Audio',
      image: 'Image',
      ppt: 'PPT',
      no_materials: 'No materials yet',
      download: 'Download',
      delete: 'Delete',
      shared_with: 'Shared with'
    },
    it: {
      title: 'Gestione Materiali Didattici',
      upload: 'Carica Materiale',
      my_materials: 'I Miei Materiali',
      material_title: 'Titolo Materiale',
      material_type: 'Tipo Materiale',
      share_to: 'Condividi Con',
      share_class: 'Condividi con Classi',
      share_individual: 'Condividi con Studenti Specifici',
      share_public: 'Pubblico (Tutti gli Studenti)',
      select_classes: 'Seleziona Classi',
      select_students: 'Seleziona Studenti',
      select_file: 'Seleziona File',
      document: 'Documento',
      video: 'Video',
      audio: 'Audio',
      image: 'Immagine',
      ppt: 'PPT',
      no_materials: 'Nessun materiale',
      download: 'Scarica',
      delete: 'Elimina',
      shared_with: 'Condiviso con'
    }
  };

  const txt = texts[language] || texts.en;
  const typeIcons = { document: '📄', video: '🎬', audio: '🎵', image: '🖼️', ppt: '📊', quiz: '❓', game: '🎮' };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>📚 {txt.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
          + {txt.upload}
        </button>
      </div>

      {/* Materials Grid */}
      {materials.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {materials.map(material => (
            <div key={material.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <span style={{ fontSize: '2rem' }}>{typeIcons[material.type] || '📄'}</span>
                  <h3 style={{ marginTop: '0.5rem' }}>
                    {language === 'zh' && material.title_zh ? material.title_zh : 
                     language === 'it' && material.title_it ? material.title_it : material.title}
                  </h3>
                </div>
                <span className="badge badge-primary">HSK {material.hsk_level}</span>
              </div>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.5rem 0' }}>
                {material.description}
              </p>
              
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {txt.shared_with}: {material.is_public ? 'Public' : material.shared_classes || material.shared_students || 'Private'}
              </p>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                {material.file_path && (
                  <a href={`/uploads/${material.file_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    ⬇️ {txt.download}
                  </a>
                )}
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => deleteMaterial(material.id)}>
                  🗑️ {txt.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '4rem' }}>📚</span>
            <p>{txt.no_materials}</p>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{txt.upload}</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                {/* Title in 3 languages */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Title (EN) *</label>
                    <input type="text" className="form-input" value={uploadForm.title} onChange={e => setUploadForm({...uploadForm, title: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">标题 (中文)</label>
                    <input type="text" className="form-input" value={uploadForm.title_zh} onChange={e => setUploadForm({...uploadForm, title_zh: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Titolo (IT)</label>
                    <input type="text" className="form-input" value={uploadForm.title_it} onChange={e => setUploadForm({...uploadForm, title_it: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{txt.material_type}</label>
                  <select className="form-select" value={uploadForm.type} onChange={e => setUploadForm({...uploadForm, type: e.target.value})}>
                    <option value="document">📄 {txt.document}</option>
                    <option value="video">🎬 {txt.video}</option>
                    <option value="audio">🎵 {txt.audio}</option>
                    <option value="image">🖼️ {txt.image}</option>
                    <option value="ppt">📊 {txt.ppt}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">HSK Level</label>
                  <select className="form-select" value={uploadForm.hsk_level} onChange={e => setUploadForm({...uploadForm, hsk_level: e.target.value})}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>

                {/* Share Type */}
                <div className="form-group">
                  <label className="form-label">{txt.share_to}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" checked={uploadForm.share_type === 'class'} onChange={() => setUploadForm({...uploadForm, share_type: 'class', student_ids: []})} />
                      {txt.share_class}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" checked={uploadForm.share_type === 'individual'} onChange={() => setUploadForm({...uploadForm, share_type: 'individual', class_ids: []})} />
                      {txt.share_individual}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" checked={uploadForm.share_type === 'public'} onChange={() => setUploadForm({...uploadForm, share_type: 'public', class_ids: [], student_ids: []})} />
                      {txt.share_public}
                    </label>
                  </div>
                </div>

                {uploadForm.share_type === 'class' && (
                  <div className="form-group">
                    <label className="form-label">{txt.select_classes}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {classes.map(cls => (
                        <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                          <input type="checkbox" checked={uploadForm.class_ids.includes(cls.id)} onChange={e => {
                            if (e.target.checked) setUploadForm({...uploadForm, class_ids: [...uploadForm.class_ids, cls.id]});
                            else setUploadForm({...uploadForm, class_ids: uploadForm.class_ids.filter(id => id !== cls.id)});
                          }} />
                          {cls.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {uploadForm.share_type === 'individual' && (
                  <div className="form-group">
                    <label className="form-label">{txt.select_students}</label>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                      {students.map(student => (
                        <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem' }}>
                          <input type="checkbox" checked={uploadForm.student_ids.includes(student.id)} onChange={e => {
                            if (e.target.checked) setUploadForm({...uploadForm, student_ids: [...uploadForm.student_ids, student.id]});
                            else setUploadForm({...uploadForm, student_ids: uploadForm.student_ids.filter(id => id !== student.id)});
                          }} />
                          {student.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({student.class_name})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">{txt.select_file}</label>
                  <input type="file" className="form-input" onChange={e => setUploadForm({...uploadForm, file: e.target.files[0]})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{txt.upload}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherMaterialsPage;
