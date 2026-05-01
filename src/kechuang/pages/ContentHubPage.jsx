// src/pages/ContentHubPage.jsx
// 内容与知识库 — 整合 ContentEditorPage + KnowledgeBaseManagerPage
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const TXT = {
  zh: {
    title: '内容与知识库', subtitle: '统一管理教学内容和 AI 知识库',
    contentTab: '📚 教学内容', kbTab: '🧠 知识库 & RAG',
    // content section
    chengyu: '成语管理', videos: '视频管理', games: '游戏管理',
    quizzes: '测验管理', hsk: 'HSK真题', materials: '教材上传',
    // kb section
    fileLib: '文件库', vectorSettings: '向量化设置', upload: '上传',
    voiceQuery: '语音', smartQA: '智能问答',
    goManage: '进入管理',
  },
  en: {
    title: 'Content & Knowledge Base', subtitle: 'Unified management of teaching content and AI knowledge base',
    contentTab: '📚 Teaching Content', kbTab: '🧠 Knowledge Base & RAG',
    chengyu: 'Chengyu', videos: 'Videos', games: 'Games',
    quizzes: 'Quizzes', hsk: 'HSK Tests', materials: 'Materials Upload',
    fileLib: 'File Library', vectorSettings: 'Vector Settings', upload: 'Upload',
    voiceQuery: 'Voice', smartQA: 'Smart Q&A',
    goManage: 'Manage',
  },
  it: {
    title: 'Contenuti e Base di Conoscenza', subtitle: 'Gestione unificata di contenuti e knowledge base AI',
    contentTab: '📚 Contenuti Didattici', kbTab: '🧠 Knowledge Base & RAG',
    chengyu: 'Chengyu', videos: 'Video', games: 'Giochi',
    quizzes: 'Quiz', hsk: 'Test HSK', materials: 'Caricamento Materiali',
    fileLib: 'Libreria File', vectorSettings: 'Vettorizzazione', upload: 'Carica',
    voiceQuery: 'Voce', smartQA: 'Domande AI',
    goManage: 'Gestisci',
  },
};

const CONTENT_ITEMS = [
  { icon:'📜', key:'chengyu', path:'/editor/chengyu',   color:'#8B4513' },
  { icon:'🎬', key:'videos',  path:'/editor/videos',    color:'#1565C0' },
  { icon:'🎮', key:'games',   path:'/editor/games',     color:'#2E7D32' },
  { icon:'❓', key:'quizzes', path:'/editor/quizzes',   color:'#7B1FA2' },
  { icon:'📝', key:'hsk',     path:'/admin/hsk-tests',  color:'#C62828' },
  { icon:'📤', key:'materials',path:'/editor/materials',color:'#E65100' },
];

const KB_ITEMS = [
  { icon:'📁', key:'fileLib',        path:'/admin/knowledge?tab=browse',  color:'#1565C0' },
  { icon:'⚙️', key:'vectorSettings', path:'/admin/rag',                   color:'#7B1FA2' },
  { icon:'⬆️', key:'upload',         path:'/admin/knowledge?tab=upload',  color:'#2E7D32' },
  { icon:'🔍', key:'smartQA',        path:'/admin/rag?tab=query',         color:'#8B4513' },
];

export default function ContentHubPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = TXT[language] || TXT.en;
  const [tab, setTab] = useState('content');

  const Card = ({ icon, label, path, color }) => (
    <div onClick={() => navigate(path)}
      style={{
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:14, padding:'1.25rem 1rem', cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
        transition:'transform .15s, box-shadow .15s',
        textAlign:'center',
      }}
      onMouseOver={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; }}
      onMouseOut={e =>  { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
    >
      <div style={{ fontSize:36 }}>{icon}</div>
      <div style={{ fontWeight:600, fontSize:14, color }}>{label}</div>
      <div style={{
        padding:'3px 12px', borderRadius:20, fontSize:11,
        background: color + '18', color, fontWeight:500,
      }}>
        {t.goManage} →
      </div>
    </div>
  );

  return (
    <div>
      <div className="content-header">
        <h1>🗂️ {t.title}</h1>
        <p style={{ color:'var(--text-muted)', marginTop:4, fontSize:14 }}>{t.subtitle}</p>
      </div>

      {/* Tab switcher */}
      <div className="tabs" style={{ marginBottom:'1.5rem' }}>
        <button className={`tab ${tab==='content'?'active':''}`} onClick={()=>setTab('content')}>
          {t.contentTab}
        </button>
        <button className={`tab ${tab==='kb'?'active':''}`} onClick={()=>setTab('kb')}>
          {t.kbTab}
        </button>
      </div>

      {/* Content tab */}
      {tab === 'content' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'1rem' }}>
          {CONTENT_ITEMS.map(item => (
            <Card key={item.key} icon={item.icon} label={t[item.key]} path={item.path} color={item.color}/>
          ))}
        </div>
      )}

      {/* Knowledge base tab */}
      {tab === 'kb' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
            {KB_ITEMS.map(item => (
              <Card key={item.key} icon={item.icon} label={t[item.key]} path={item.path} color={item.color}/>
            ))}
          </div>
          {/* Info cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="card" style={{ padding:'1rem' }}>
              <h4 style={{ margin:'0 0 6px', fontSize:14 }}>📁 文件库 vs ⬆️ 上传</h4>
              <p style={{ margin:0, color:'var(--text-muted)', fontSize:12, lineHeight:1.6 }}>
                <strong>文件库</strong>：浏览已处理的文件，查看知识块数、搜索、删除<br/>
                <strong>上传</strong>：添加新文件并触发 AI 自动分类 + 向量化
              </p>
            </div>
            <div className="card" style={{ padding:'1rem' }}>
              <h4 style={{ margin:'0 0 6px', fontSize:14 }}>⚙️ Embedding 服务商</h4>
              <p style={{ margin:0, color:'var(--text-muted)', fontSize:12, lineHeight:1.6 }}>
                推荐 <strong>Voyage AI</strong>（免费 50M tokens）或 <strong>Jina AI</strong>（免费 1M tokens）<br/>
                在"向量化设置"里配置 API Key 即可，无需本地 GPU
              </p>
            </div>
          </div>
          <div className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h3 style={{ margin:0 }}>🧠 {language==='zh'?'知识库配置中心':'Knowledge Base Config'}</h3>
              <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:13 }}>
                {language==='zh'?'RAG向量化、Embedding设置、智能问答配置'
                 :language==='it'?'Configurazione RAG, Embedding e Q&A intelligente'
                 :'RAG vectorization, Embedding settings, Smart Q&A config'}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/admin/knowledge')}>
              {t.goManage} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
