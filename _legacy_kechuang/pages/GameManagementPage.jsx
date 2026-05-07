import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const GameManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    title_zh: '',
    title_en: '',
    description_zh: '',
    game_type: 'matching',
    vocabulary: '',
    hsk_level: 3,
    difficulty: 'medium',
    is_active: true
  });

  const txt = {
    zh: {
      title: '游戏管理',
      subtitle: '创建和管理学习游戏',
      add: '创建游戏',
      search: '搜索游戏...',
      all: '全部',
      matching: '词汇配对',
      memory: '记忆翻牌',
      typing: '打字练习',
      puzzle: '汉字拼图',
      quiz: '问答挑战',
      titleZh: '游戏名称(中文)',
      titleEn: '游戏名称(英文)',
      descZh: '游戏说明',
      gameType: '游戏类型',
      vocabulary: '词汇列表',
      vocabularyHelp: '每行一个词，格式：汉字|拼音|意思',
      hskLevel: 'HSK等级',
      difficulty: '难度',
      easy: '简单',
      medium: '中等',
      hard: '困难',
      active: '已发布',
      inactive: '未发布',
      save: '保存',
      cancel: '取消',
      noData: '暂无游戏',
      plays: '次游玩',
      preview: '预览',
      edit: '编辑'
    },
    en: {
      title: 'Game Management',
      subtitle: 'Create and manage learning games',
      add: 'Create Game',
      search: 'Search games...',
      all: 'All',
      matching: 'Word Matching',
      memory: 'Memory Cards',
      typing: 'Typing Practice',
      puzzle: 'Character Puzzle',
      quiz: 'Quiz Challenge',
      titleZh: 'Game Name (Chinese)',
      titleEn: 'Game Name (English)',
      descZh: 'Description',
      gameType: 'Game Type',
      vocabulary: 'Vocabulary List',
      vocabularyHelp: 'One word per line, format: Chinese|Pinyin|Meaning',
      hskLevel: 'HSK Level',
      difficulty: 'Difficulty',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      active: 'Published',
      inactive: 'Unpublished',
      save: 'Save',
      cancel: 'Cancel',
      noData: 'No games',
      plays: 'plays',
      preview: 'Preview',
      edit: 'Edit'
    }
  };
  const t = txt[language] || txt.en;

  const gameTypes = [
    { id: 'matching', icon: '🔗', color: '#3b82f6' },
    { id: 'memory', icon: '🃏', color: '#8b5cf6' },
    { id: 'typing', icon: '⌨️', color: '#22c55e' },
    { id: 'puzzle', icon: '🧩', color: '#f59e0b' },
    { id: 'quiz', icon: '❓', color: '#ef4444' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Demo data
      setGames([
        { id: 1, title_zh: 'HSK3词汇配对', title_en: 'HSK3 Word Match', game_type: 'matching', hsk_level: 3, difficulty: 'medium', plays: 1250, is_active: true },
        { id: 2, title_zh: '汉字记忆挑战', title_en: 'Character Memory', game_type: 'memory', hsk_level: 2, difficulty: 'easy', plays: 980, is_active: true },
        { id: 3, title_zh: '拼音打字练习', title_en: 'Pinyin Typing', game_type: 'typing', hsk_level: 1, difficulty: 'easy', plays: 2100, is_active: true },
        { id: 4, title_zh: '汉字部首拼图', title_en: 'Radical Puzzle', game_type: 'puzzle', hsk_level: 4, difficulty: 'hard', plays: 560, is_active: false },
        { id: 5, title_zh: '文化知识问答', title_en: 'Culture Quiz', game_type: 'quiz', hsk_level: 5, difficulty: 'medium', plays: 890, is_active: true }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title_zh) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写游戏名称' : 'Please enter game name' });
      return;
    }

    try {
      if (editItem) {
        setGames(games.map(g => g.id === editItem.id ? { ...g, ...form } : g));
        setMessage({ type: 'success', text: language === 'zh' ? '修改成功！' : 'Updated!' });
      } else {
        const newItem = { ...form, id: Date.now(), plays: 0 };
        setGames([newItem, ...games]);
        setMessage({ type: 'success', text: language === 'zh' ? '创建成功！' : 'Created!' });
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
    if (!window.confirm(language === 'zh' ? '确定删除此游戏吗？' : 'Delete this game?')) return;
    setGames(games.filter(g => g.id !== id));
    setMessage({ type: 'success', text: language === 'zh' ? '删除成功！' : 'Deleted!' });
  };

  const resetForm = () => {
    setForm({
      title_zh: '', title_en: '', description_zh: '', game_type: 'matching',
      vocabulary: '', hsk_level: 3, difficulty: 'medium', is_active: true
    });
    setEditItem(null);
    setShowModal(false);
  };

  const filteredList = games.filter(g =>
    (filterType === 'all' || g.game_type === filterType) &&
    (!searchTerm || g.title_zh?.includes(searchTerm) || g.title_en?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getGameTypeInfo = (type) => gameTypes.find(g => g.id === type) || gameTypes[0];

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🎮 {t.title}</h1>
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterType('all')}
          >
            {t.all}
          </button>
          {gameTypes.map(type => (
            <button
              key={type.id}
              className={`btn btn-sm ${filterType === type.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterType(type.id)}
            >
              {type.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Games Grid */}
      {filteredList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎮</div>
          <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filteredList.map(game => {
            const typeInfo = getGameTypeInfo(game.game_type);
            return (
              <div key={game.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                  padding: '1.5rem',
                  background: `linear-gradient(135deg, ${typeInfo.color}20 0%, ${typeInfo.color}10 100%)`,
                  borderBottom: `3px solid ${typeInfo.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: typeInfo.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    {typeInfo.icon}
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '0.25rem' }}>{game.title_zh}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.title_en}</p>
                  </div>
                  {!game.is_active && (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '0.25rem 0.5rem',
                      background: '#f59e0b20',
                      color: '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {t.inactive}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="badge">{t[game.game_type]}</span>
                    <span className="badge badge-info">HSK {game.hsk_level}</span>
                    <span className="badge" style={{ 
                      background: game.difficulty === 'easy' ? '#22c55e20' : game.difficulty === 'hard' ? '#ef444420' : '#f59e0b20',
                      color: game.difficulty === 'easy' ? '#22c55e' : game.difficulty === 'hard' ? '#ef4444' : '#f59e0b'
                    }}>
                      {t[game.difficulty]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    🎮 {game.plays?.toLocaleString()} {t.plays}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }}>{t.preview}</button>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => handleEdit(game)}>{t.edit}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleDelete(game.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editItem ? '✏️ 编辑游戏' : '🎮 创建游戏'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.gameType}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  {gameTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      style={{
                        padding: '0.75rem',
                        border: form.game_type === type.id ? `2px solid ${type.color}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: form.game_type === type.id ? `${type.color}20` : 'var(--background)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      onClick={() => setForm({ ...form, game_type: type.id })}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{type.icon}</span>
                      <span style={{ fontSize: '0.7rem' }}>{t[type.id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.titleZh} *</label>
                <input type="text" className="form-input" value={form.title_zh} onChange={e => setForm({ ...form, title_zh: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label">{t.titleEn}</label>
                <input type="text" className="form-input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">{t.vocabulary}</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={form.vocabulary}
                  onChange={e => setForm({ ...form, vocabulary: e.target.value })}
                  placeholder={t.vocabularyHelp}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select className="form-select" value={form.hsk_level} onChange={e => setForm({ ...form, hsk_level: parseInt(e.target.value) })}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.difficulty}</label>
                  <select className="form-select" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                    <option value="easy">{t.easy}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="hard">{t.hard}</option>
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

export default GameManagementPage;
