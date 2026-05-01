import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const AITrainingMaterialsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [materials, setMaterials] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    title: '',
    source_type: 'internal',
    content: '',
    category: 'teaching',
    tags: '',
    url: ''
  });

  const txt = {
    zh: {
      title: '🧠 智能训练资料管理',
      overview: '总览',
      materials: '资料库',
      pending: '待审核',
      sources: '数据源',
      settings: '设置',
      totalMaterials: '资料总数',
      pendingCount: '待审核',
      approvedCount: '已通过',
      rejectedCount: '已拒绝',
      sourceTypes: '数据来源分布',
      internal: '内部资料',
      external: '外部文献',
      communication: '师生沟通',
      teaching: '教学资料',
      learning: '学习资料',
      add: '添加资料',
      sourceType: '资料来源',
      materialTitle: '资料标题',
      content: '内容',
      category: '分类',
      tags: '标签',
      url: '链接地址',
      status: '状态',
      pending_review: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      approve: '通过',
      reject: '拒绝',
      delete: '删除',
      save: '保存',
      cancel: '取消',
      noData: '暂无数据',
      success: '操作成功！',
      failed: '操作失败',
      sourceInternal: '系统内部',
      sourceExternal: '外部导入',
      sourceTeacher: '教师上传',
      sourceCommunication: '师生沟通',
      reviewNote: '审核说明',
      lastUpdated: '最后更新',
      viewContent: '查看内容',
      aiUsageStats: 'AI使用统计',
      usedInTraining: '已用于训练',
      usedInChat: '用于对话',
      qualityScore: '质量评分',
      autoCollect: '自动采集',
      manualAdd: '手动添加',
      batchImport: '批量导入',
      dataSourceConfig: '数据源配置',
      enableAutoCollect: '启用自动采集',
      collectFromHomework: '从作业中采集',
      collectFromChat: '从对话中采集',
      collectFromMaterials: '从教学资料采集',
      reviewRequired: '需要审核',
      autoApprove: '自动通过'
    },
    en: {
      title: '🧠 Intelligent Training Materials',
      overview: 'Overview',
      materials: 'Materials',
      pending: 'Pending Review',
      sources: 'Data Sources',
      settings: 'Settings',
      totalMaterials: 'Total Materials',
      pendingCount: 'Pending',
      approvedCount: 'Approved',
      rejectedCount: 'Rejected',
      sourceTypes: 'Source Distribution',
      internal: 'Internal',
      external: 'External',
      communication: 'Communication',
      teaching: 'Teaching',
      learning: 'Learning',
      add: 'Add Material',
      sourceType: 'Source Type',
      materialTitle: 'Title',
      content: 'Content',
      category: 'Category',
      tags: 'Tags',
      url: 'URL',
      status: 'Status',
      pending_review: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      approve: 'Approve',
      reject: 'Reject',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      noData: 'No data',
      success: 'Success!',
      failed: 'Failed',
      sourceInternal: 'Internal',
      sourceExternal: 'External Import',
      sourceTeacher: 'Teacher Upload',
      sourceCommunication: 'Communication',
      reviewNote: 'Review Note',
      lastUpdated: 'Last Updated',
      viewContent: 'View Content',
      aiUsageStats: 'AI Usage Stats',
      usedInTraining: 'Used in Training',
      usedInChat: 'Used in Chat',
      qualityScore: 'Quality Score',
      autoCollect: 'Auto Collect',
      manualAdd: 'Manual Add',
      batchImport: 'Batch Import',
      dataSourceConfig: 'Data Source Config',
      enableAutoCollect: 'Enable Auto Collection',
      collectFromHomework: 'Collect from Homework',
      collectFromChat: 'Collect from Chat',
      collectFromMaterials: 'Collect from Materials',
      reviewRequired: 'Review Required',
      autoApprove: 'Auto Approve'
    },
    it: {
      title: '🧠 Materiali Formazione Intelligente',
      overview: 'Panoramica',
      materials: 'Materiali',
      pending: 'Da Revisionare',
      sources: 'Fonti Dati',
      settings: 'Impostazioni',
      totalMaterials: 'Materiali Totali',
      pendingCount: 'In Attesa',
      approvedCount: 'Approvati',
      rejectedCount: 'Rifiutati',
      sourceTypes: 'Distribuzione Fonti',
      internal: 'Interno',
      external: 'Esterno',
      communication: 'Comunicazione',
      teaching: 'Didattica',
      learning: 'Apprendimento',
      add: 'Aggiungi',
      sourceType: 'Tipo Fonte',
      materialTitle: 'Titolo',
      content: 'Contenuto',
      category: 'Categoria',
      tags: 'Tag',
      url: 'URL',
      status: 'Stato',
      pending_review: 'In Attesa',
      approved: 'Approvato',
      rejected: 'Rifiutato',
      approve: 'Approva',
      reject: 'Rifiuta',
      delete: 'Elimina',
      save: 'Salva',
      cancel: 'Annulla',
      noData: 'Nessun dato',
      success: 'Successo!',
      failed: 'Fallito',
      sourceInternal: 'Interno',
      sourceExternal: 'Importazione Esterna',
      sourceTeacher: 'Caricato Insegnante',
      sourceCommunication: 'Comunicazione',
      reviewNote: 'Nota Revisione',
      lastUpdated: 'Ultimo Aggiornamento',
      viewContent: 'Vedi Contenuto',
      aiUsageStats: 'Statistiche Uso AI',
      usedInTraining: 'Usato nel Training',
      usedInChat: 'Usato in Chat',
      qualityScore: 'Punteggio Qualità',
      autoCollect: 'Raccolta Auto',
      manualAdd: 'Aggiungi Manuale',
      batchImport: 'Importa Batch',
      dataSourceConfig: 'Config Fonti Dati',
      enableAutoCollect: 'Abilita Raccolta Auto',
      collectFromHomework: 'Raccogli da Compiti',
      collectFromChat: 'Raccogli da Chat',
      collectFromMaterials: 'Raccogli da Materiali',
      reviewRequired: 'Richiede Revisione',
      autoApprove: 'Approva Auto'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 加载智能训练资料
      const { data: materialsData } = await supabase
        .from('dwxz_ai_training_materials')
        .select('*')
        .order('created_at', { ascending: false });
      setMaterials(materialsData || []);

      // 加载待审核
      const { data: pendingData } = await supabase
        .from('dwxz_ai_training_materials')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingReviews(pendingData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('dwxz_ai_training_materials').insert([{
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(t => t),
        uploaded_by: user?.id,
        status: 'pending'
      }]);
      setShowAddModal(false);
      setForm({ title: '', source_type: 'internal', content: '', category: 'teaching', tags: '', url: '' });
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const handleReview = async (id, status) => {
    try {
      await supabase.from('dwxz_ai_training_materials').update({
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', id);
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(language === 'zh' ? '确定删除吗？' : 'Confirm delete?')) return;
    try {
      await supabase.from('dwxz_ai_training_materials').delete().eq('id', id);
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--warning)', text: t.pending_review },
      approved: { bg: 'var(--success)', text: t.approved },
      rejected: { bg: 'var(--error)', text: t.rejected }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  const stats = {
    total: materials.length,
    pending: materials.filter(m => m.status === 'pending').length,
    approved: materials.filter(m => m.status === 'approved').length,
    rejected: materials.filter(m => m.status === 'rejected').length,
    internal: materials.filter(m => m.source_type === 'internal').length,
    external: materials.filter(m => m.source_type === 'external').length,
    communication: materials.filter(m => m.source_type === 'communication').length
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

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        <button className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          📚 {t.materials}
        </button>
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          ⏳ {t.pending} {pendingReviews.length > 0 && <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>{pendingReviews.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ {t.settings}
        </button>
      </div>

      {/* 总览 */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>{stats.total}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.totalMaterials}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--warning)' }}>{stats.pending}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.pendingCount}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--success)' }}>{stats.approved}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.approvedCount}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--error)' }}>{stats.rejected}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.rejectedCount}</div>
            </div>
          </div>

          {/* 来源分布 */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>{t.sourceTypes}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏠</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.internal}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.internal}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🌐</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.external}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.external}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>💬</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.communication}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.communication}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 资料库 */}
      {activeTab === 'materials' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{t.materials} ({materials.length})</h3>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ {t.add}</button>
          </div>

          {materials.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.materialTitle}</th>
                    <th>{t.sourceType}</th>
                    <th>{t.category}</th>
                    <th>{t.status}</th>
                    <th>{language === 'zh' ? '操作' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: '500' }}>{m.title}</td>
                      <td><span className="badge badge-info">{m.source_type}</span></td>
                      <td>{m.category}</td>
                      <td>{getStatusBadge(m.status)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(m.id)}>
                          ✗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 待审核 */}
      {activeTab === 'pending' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>{t.pending}</h3>
          
          {pendingReviews.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pendingReviews.map(m => (
                <div key={m.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <h4>{m.title}</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span className="badge badge-info">{m.source_type}</span>
                        <span className="badge">{m.category}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {m.content?.substring(0, 200)}...
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleReview(m.id, 'approved')}>
                      ✓ {t.approve}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleReview(m.id, 'rejected')}>
                      ✗ {t.reject}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 设置 */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>{t.dataSourceConfig}</h3>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <input type="checkbox" defaultChecked />
              <div>
                <div style={{ fontWeight: '500' }}>{t.collectFromMaterials}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {language === 'zh' ? '自动从教学资料中提取训练数据' : 'Auto extract training data from teaching materials'}
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <input type="checkbox" defaultChecked />
              <div>
                <div style={{ fontWeight: '500' }}>{t.collectFromChat}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {language === 'zh' ? '从师生对话中提取有价值的问答' : 'Extract valuable Q&A from teacher-student conversations'}
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <input type="checkbox" />
              <div>
                <div style={{ fontWeight: '500' }}>{t.collectFromHomework}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {language === 'zh' ? '从优秀作业中提取示例' : 'Extract examples from excellent homework'}
                </div>
              </div>
            </label>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>{t.reviewRequired}</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="radio" name="review" defaultChecked />
                {language === 'zh' ? '所有资料需要人工审核' : 'All materials require manual review'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="radio" name="review" />
                {language === 'zh' ? '内部资料自动通过，外部资料需审核' : 'Auto approve internal, review external'}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 添加资料模态框 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '1rem' }}>📝 {t.add}</h3>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">{t.materialTitle} *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.sourceType}</label>
                  <select className="form-select" value={form.source_type} onChange={e => setForm({...form, source_type: e.target.value})}>
                    <option value="internal">{t.sourceInternal}</option>
                    <option value="external">{t.sourceExternal}</option>
                    <option value="teacher">{t.sourceTeacher}</option>
                    <option value="communication">{t.sourceCommunication}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.category}</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="teaching">{t.teaching}</option>
                    <option value="learning">{t.learning}</option>
                    <option value="communication">{t.communication}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t.content} *</label>
                <textarea className="form-textarea" rows={5} value={form.content} onChange={e => setForm({...form, content: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t.url}</label>
                <input className="form-input" type="url" value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">{t.tags}</label>
                <input className="form-input" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder={language === 'zh' ? '用逗号分隔' : 'Comma separated'} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITrainingMaterialsPage;
