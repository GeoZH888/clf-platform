import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ChengyuManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [chengyuList, setChengyuList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);

  const [form, setForm] = useState({
    chengyu: '',
    pinyin: '',
    literal: '',
    meaning_zh: '',
    meaning_en: '',
    meaning_it: '',
    story: '',
    story_en: '',
    example: '',
    example_en: '',
    category: 'fable',
    hsk_level: 3,
    is_active: true
  });

  // Load AI config from rag_config table
  useEffect(() => {
    const loadAIConfig = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('dwxz_rag_config').select('*').limit(1).single();
      setAiConfig(data);
    };
    loadAIConfig();
  }, [supabase]);

  // AI Auto-fill function using centralized config
  const handleAIAutoFill = async () => {
    if (!form.chengyu || form.chengyu.length < 2) {
      alert(language === 'zh' ? '请先输入成语！' : 'Please enter a chengyu first!');
      return;
    }

    // Get API key from config
    const provider = aiConfig?.ai_provider || 'openai';
    let apiKey = null;
    let model = 'gpt-4o-mini';
    let apiUrl = 'https://api.openai.com/v1/chat/completions';

    if (provider === 'openai') {
      apiKey = aiConfig?.openai_api_key;
      model = aiConfig?.openai_model || 'gpt-4o-mini';
      apiUrl = 'https://api.openai.com/v1/chat/completions';
    } else if (provider === 'claude' || provider === 'anthropic') {
      apiKey = aiConfig?.claude_api_key;
      model = aiConfig?.claude_model || 'claude-sonnet-4-20250514';
      apiUrl = 'https://api.anthropic.com/v1/messages';
    } else if (provider === 'deepseek') {
      apiKey = aiConfig?.deepseek_api_key;
      model = aiConfig?.deepseek_model || 'deepseek-chat';
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }

    if (!apiKey) {
      alert(language === 'zh' 
        ? '❌ AI未配置！请联系管理员在"知识库配置"中设置API密钥。' 
        : '❌ AI not configured! Please ask admin to set API key in Knowledge Base Settings.');
      return;
    }

    setAiGenerating(true);
    try {
      const prompt = `请为成语"${form.chengyu}"提供完整信息，返回JSON格式：

{
  "pinyin": "拼音（带声调，如 yī shí èr niǎo）",
  "literal": "字面意思（英文）",
  "meaning_zh": "中文释义（一句话）",
  "meaning_en": "English meaning",
  "meaning_it": "Significato in italiano",
  "story": "成语故事（100-200字）",
  "story_en": "Story in English (brief)",
  "example": "例句（中文）",
  "example_en": "Example sentence in English",
  "category": "分类：fable/history/strategy/art/culture/communication/nature/character 选一个",
  "hsk_level": "推荐HSK等级：1-6的数字"
}

只返回JSON，不要其他文字。`;

      let response;
      if (provider === 'claude' || provider === 'anthropic') {
        // Claude API
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
          })
        });
      } else {
        // OpenAI compatible API (OpenAI, DeepSeek)
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.7
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      let content = '';
      
      if (provider === 'claude' || provider === 'anthropic') {
        content = data.content?.[0]?.text || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }
      
      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        setForm(prev => ({
          ...prev,
          pinyin: result.pinyin || prev.pinyin,
          literal: result.literal || prev.literal,
          meaning_zh: result.meaning_zh || prev.meaning_zh,
          meaning_en: result.meaning_en || prev.meaning_en,
          meaning_it: result.meaning_it || prev.meaning_it,
          story: result.story || prev.story,
          story_en: result.story_en || prev.story_en,
          example: result.example || prev.example,
          example_en: result.example_en || prev.example_en,
          category: result.category || prev.category,
          hsk_level: parseInt(result.hsk_level) || prev.hsk_level
        }));
        setMessage({ type: 'success', text: `✨ AI自动填充成功！(${provider.toUpperCase()} - ${model})` });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('AI auto-fill error:', error);
      setMessage({ type: 'error', text: language === 'zh' ? '❌ AI填充失败: ' + error.message : '❌ AI fill failed: ' + error.message });
    } finally {
      setAiGenerating(false);
    }
  };

  const txt = {
    zh: {
      title: '成语管理',
      subtitle: '添加、编辑和管理成语内容',
      add: '添加成语',
      search: '搜索成语...',
      all: '全部',
      fable: '寓言',
      history: '历史',
      strategy: '策略',
      art: '艺术',
      culture: '文化',
      communication: '沟通',
      nature: '自然',
      character: '品格',
      chengyu: '成语',
      pinyin: '拼音',
      literal: '字面意思',
      meaningZh: '中文释义',
      meaningEn: '英文释义',
      meaningIt: '意大利语释义',
      story: '成语故事',
      storyEn: '故事(英文)',
      example: '例句',
      exampleEn: '例句(英文)',
      category: '分类',
      hskLevel: 'HSK等级',
      active: '已发布',
      inactive: '未发布',
      save: '保存',
      cancel: '取消',
      edit: '编辑',
      delete: '删除',
      confirmDelete: '确定删除这个成语吗？',
      noData: '暂无成语数据',
      addSuccess: '添加成功！',
      editSuccess: '修改成功！',
      deleteSuccess: '删除成功！'
    },
    en: {
      title: 'Chengyu Management',
      subtitle: 'Add, edit and manage Chengyu content',
      add: 'Add Chengyu',
      search: 'Search Chengyu...',
      all: 'All',
      fable: 'Fables',
      history: 'History',
      strategy: 'Strategy',
      art: 'Art',
      culture: 'Culture',
      communication: 'Communication',
      nature: 'Nature',
      character: 'Character',
      chengyu: 'Chengyu',
      pinyin: 'Pinyin',
      literal: 'Literal Meaning',
      meaningZh: 'Chinese Meaning',
      meaningEn: 'English Meaning',
      meaningIt: 'Italian Meaning',
      story: 'Story (Chinese)',
      storyEn: 'Story (English)',
      example: 'Example (Chinese)',
      exampleEn: 'Example (English)',
      category: 'Category',
      hskLevel: 'HSK Level',
      active: 'Published',
      inactive: 'Unpublished',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this Chengyu?',
      noData: 'No Chengyu data',
      addSuccess: 'Added successfully!',
      editSuccess: 'Updated successfully!',
      deleteSuccess: 'Deleted successfully!'
    }
  };
  const t = txt[language] || txt.en;

  const categories = ['all', 'fable', 'history', 'strategy', 'art', 'culture', 'communication', 'nature', 'character'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const { data } = await supabase.from('dwxz_chengyu').select('*').order('created_at', { ascending: false });
        setChengyuList(data || []);
      } else {
        // Demo data
        setChengyuList([
          { id: 1, chengyu: '一石二鸟', pinyin: 'yī shí èr niǎo', literal: 'One stone, two birds', meaning_zh: '一举两得', meaning_en: 'Kill two birds with one stone', category: 'strategy', hsk_level: 4, is_active: true },
          { id: 2, chengyu: '画龙点睛', pinyin: 'huà lóng diǎn jīng', literal: 'Paint dragon, dot eyes', meaning_zh: '在关键处加上精辟的话', meaning_en: 'Add the finishing touch', category: 'art', hsk_level: 5, is_active: true },
          { id: 3, chengyu: '守株待兔', pinyin: 'shǒu zhū dài tù', literal: 'Guard stump, wait for rabbit', meaning_zh: '不努力而等待意外收获', meaning_en: 'Wait for gains without effort', category: 'fable', hsk_level: 4, is_active: true },
          { id: 4, chengyu: '亡羊补牢', pinyin: 'wáng yáng bǔ láo', literal: 'Lose sheep, mend pen', meaning_zh: '及时补救', meaning_en: 'Better late than never', category: 'fable', hsk_level: 3, is_active: true },
          { id: 5, chengyu: '对牛弹琴', pinyin: 'duì niú tán qín', literal: 'Play lute to cow', meaning_zh: '对外行讲内行话', meaning_en: 'Cast pearls before swine', category: 'communication', hsk_level: 4, is_active: false }
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
    if (!form.chengyu || !form.meaning_zh) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写必填项' : 'Please fill required fields' });
      return;
    }

    try {
      if (editItem) {
        // Update
        if (supabase) {
          await supabase.from('dwxz_chengyu').update(form).eq('id', editItem.id);
        }
        setChengyuList(chengyuList.map(c => c.id === editItem.id ? { ...c, ...form } : c));
        setMessage({ type: 'success', text: t.editSuccess });
      } else {
        // Add new
        const newItem = { ...form, id: Date.now(), created_at: new Date().toISOString() };
        if (supabase) {
          const { data } = await supabase.from('dwxz_chengyu').insert([form]).select();
          if (data) newItem.id = data[0].id;
        }
        setChengyuList([newItem, ...chengyuList]);
        setMessage({ type: 'success', text: t.addSuccess });
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
    if (!window.confirm(t.confirmDelete)) return;
    try {
      if (supabase) {
        await supabase.from('dwxz_chengyu').delete().eq('id', id);
      }
      setChengyuList(chengyuList.filter(c => c.id !== id));
      setMessage({ type: 'success', text: t.deleteSuccess });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const resetForm = () => {
    setForm({
      chengyu: '', pinyin: '', literal: '', meaning_zh: '', meaning_en: '', meaning_it: '',
      story: '', story_en: '', example: '', example_en: '', category: 'fable', hsk_level: 3, is_active: true
    });
    setEditItem(null);
    setShowModal(false);
  };

  const filteredList = chengyuList.filter(c => 
    (filterCategory === 'all' || c.category === filterCategory) &&
    (!searchTerm || c.chengyu?.includes(searchTerm) || c.meaning_zh?.includes(searchTerm) || c.pinyin?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📜 {t.title}</h1>
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

      {/* List */}
      <div className="card">
        {filteredList.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.chengyu}</th>
                  <th>{t.pinyin}</th>
                  <th>{t.meaningZh}</th>
                  <th>{t.category}</th>
                  <th>HSK</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600', fontSize: '1.125rem' }}>{item.chengyu}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.pinyin}</td>
                    <td>{item.meaning_zh}</td>
                    <td><span className="badge">{t[item.category] || item.category}</span></td>
                    <td><span className="badge badge-info">HSK {item.hsk_level}</span></td>
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : ''}`}>
                        {item.is_active ? t.active : t.inactive}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(item)}>✏️</button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(item.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Improved with better visibility */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => !aiGenerating && setShowModal(false)}
        >
          <div 
            style={{ 
              backgroundColor: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editItem ? '✏️ 编辑成语' : '📜 添加新成语'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* AI Auto-Fill Section - Prominent */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
              border: '2px solid var(--primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🤖</span>
                <h3 style={{ margin: 0, color: 'var(--primary)' }}>AI 智能填充</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                只需输入成语，AI 将自动生成：拼音、释义、故事、例句等全部内容
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ 
                    flex: 1,
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    letterSpacing: '0.25em'
                  }}
                  value={form.chengyu} 
                  onChange={e => setForm({ ...form, chengyu: e.target.value })} 
                  placeholder="请输入成语"
                  disabled={aiGenerating}
                />
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleAIAutoFill}
                  disabled={aiGenerating || !form.chengyu || form.chengyu.length < 2}
                  style={{ 
                    whiteSpace: 'nowrap',
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {aiGenerating ? (
                    <>
                      <span className="loading-spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                      生成中...
                    </>
                  ) : (
                    <>✨ 一键生成</>
                  )}
                </button>
              </div>
              {aiConfig?.ai_provider && (
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: aiConfig?.openai_api_key || aiConfig?.claude_api_key || aiConfig?.deepseek_api_key ? 'var(--success)' : 'var(--danger)',
                    display: 'inline-block'
                  }}></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    AI Provider: {aiConfig.ai_provider === 'openai' ? 'OpenAI' : aiConfig.ai_provider === 'claude' ? 'Claude' : 'DeepSeek'}
                    {' · '}
                    {aiConfig?.openai_api_key || aiConfig?.claude_api_key || aiConfig?.deepseek_api_key ? '已配置' : '未配置'}
                  </span>
                </div>
              )}
            </div>

            {/* Loading overlay during AI generation */}
            {aiGenerating && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.05)',
                border: '1px dashed var(--primary)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem',
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 600 }}>
                  🤖 AI 正在为 "{form.chengyu}" 生成内容...
                </p>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  请稍候，这通常需要 5-10 秒
                </p>
              </div>
            )}

            {/* Form - shown when not loading or after AI fills */}
            <form onSubmit={handleSubmit}>
              {/* Show form fields with generated content */}
              <div style={{ 
                display: 'grid', 
                gap: '1rem',
                opacity: aiGenerating ? 0.5 : 1,
                pointerEvents: aiGenerating ? 'none' : 'auto'
              }}>
                {/* Pinyin & Literal */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.pinyin}</label>
                    <input type="text" className="form-input" value={form.pinyin} onChange={e => setForm({ ...form, pinyin: e.target.value })} placeholder="yī shí èr niǎo" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.literal}</label>
                    <input type="text" className="form-input" value={form.literal} onChange={e => setForm({ ...form, literal: e.target.value })} placeholder="Literal meaning" />
                  </div>
                </div>

                {/* Chinese Meaning */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t.meaningZh} *</label>
                  <textarea className="form-textarea" rows={2} value={form.meaning_zh} onChange={e => setForm({ ...form, meaning_zh: e.target.value })} required placeholder="中文释义" />
                </div>

                {/* English & Italian Meaning */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.meaningEn}</label>
                    <input type="text" className="form-input" value={form.meaning_en} onChange={e => setForm({ ...form, meaning_en: e.target.value })} placeholder="English meaning" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.meaningIt}</label>
                    <input type="text" className="form-input" value={form.meaning_it} onChange={e => setForm({ ...form, meaning_it: e.target.value })} placeholder="Significato italiano" />
                  </div>
                </div>

                {/* Story */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t.story}</label>
                  <textarea className="form-textarea" rows={3} value={form.story} onChange={e => setForm({ ...form, story: e.target.value })} placeholder="成语故事..." />
                </div>

                {/* Example */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t.example}</label>
                  <input type="text" className="form-input" value={form.example} onChange={e => setForm({ ...form, example: e.target.value })} placeholder="例句" />
                </div>

                {/* Category, HSK Level, Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.category}</label>
                    <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {categories.filter(c => c !== 'all').map(cat => <option key={cat} value={cat}>{t[cat]}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t.hskLevel}</label>
                    <select className="form-select" value={form.hsk_level} onChange={e => setForm({ ...form, hsk_level: parseInt(e.target.value) })}>
                      {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">状态</label>
                    <select className="form-select" value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })}>
                      <option value="active">{t.active}</option>
                      <option value="inactive">{t.inactive}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-outline" onClick={resetForm} disabled={aiGenerating}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={aiGenerating || !form.chengyu || !form.meaning_zh}>
                  ✓ {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChengyuManagementPage;
