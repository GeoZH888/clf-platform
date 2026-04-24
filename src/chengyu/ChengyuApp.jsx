// src/chengyu/ChengyuApp.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import ModuleTemplate from '../components/ModuleTemplate.jsx';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';
import { useAdaptiveLearning } from '../hooks/useAdaptiveLearning.js';
import ChengyuFlash  from './ChengyuFlash.jsx';
import ChengyuQuiz   from './ChengyuQuiz.jsx';
import ChengyuMatch  from './ChengyuMatch.jsx';
import ChengyuChain  from './ChengyuChain.jsx';
import ChengyuStory  from './ChengyuStory.jsx';
import ChengyuFill   from './ChengyuFill.jsx';

// ── Level badge component ────────────────────────────────────────────────────
function LevelBadge({ level, size = 'sm' }) {
  const colors = ['#4CAF50','#2196F3','#FF9800','#E91E63'];
  const labels = ['基础','进阶','高级','精通'];
  const c = colors[Math.min(3, level - 1)] || '#90A4AE';
  return (
    <span style={{ fontSize:size==='sm'?9:11, padding:'1px 6px', borderRadius:8,
      background:c+'20', color:c, fontWeight:700, border:`1px solid ${c}44` }}>
      Lv{level} {labels[level-1]||''}
    </span>
  );
}

// ── Adaptive progress bar ────────────────────────────────────────────────────
function AdaptiveBar({ stats, lang }) {
  const t = (zh, en) => lang==='zh' ? zh : en;
  if (!stats.total) return null;
  const masteredPct = Math.round((stats.mastered / stats.total) * 100);
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px',
      border:'1px solid #E8D5B0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6,
        fontSize:12, color:'#5D2E0C' }}>
        <span>🏆 {t('掌握度','Mastery')}: {masteredPct}%</span>
        <span style={{ color:'#a07850' }}>{stats.mastered}/{stats.total} {t('个','items')}</span>
      </div>
      <div style={{ height:8, background:'#F5E6D0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${masteredPct}%`, borderRadius:4,
          background:`linear-gradient(90deg, #8B4513 0%, #C8A050 100%)`,
          transition:'width 0.5s ease' }}/>
      </div>
      <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11 }}>
        <span style={{ color:'#E65100' }}>📚 {stats.due} {t('待复习','due')}</span>
        <span style={{ color:'#1565C0' }}>✨ {stats.new} {t('待学','new')}</span>
        <span style={{ color:'#2E7D32' }}>✅ {stats.mastered} {t('已掌握','mastered')}</span>
      </div>
    </div>
  );
}

export default function ChengyuApp({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it||en : en;
  const [screen, setScreen] = useState('home');
  const [theme,  setTheme]  = useState('all');
  const [idioms, setIdioms] = useState([]);
  const [loading, setLoading] = useState(true);
  const { total: points } = usePoints();

  const adaptive = useAdaptiveLearning(idioms, {
    idField:       'id',
    diffField:     'difficulty',
    hskField:      'hsk_level',
    module:        'chengyu',
    progressTable: 'clf_chengyu_progress',
    itemIdCol:     'idiom_id',
  });

  useEffect(() => {
    supabase.from('clf_chengyu')
      .select('*').eq('active', true).order('hsk_level').order('difficulty').order('sort_order')
      .then(({ data }) => { setIdioms(data ?? []); setLoading(false); });
  }, []);

  const filtered = theme === 'all' ? idioms : idioms.filter(i => i.theme === theme);
  const themes   = [...new Set(idioms.map(i => i.theme))].filter(Boolean);
  const THEME_LABELS = { wisdom:'智慧', animals:'动物', nature:'自然', history:'历史', general:'通用' };

  // Adaptive queue — sorted by priority (due first, then new at right level)
  const adaptiveQueue = adaptive.getAdaptiveQueue(filtered.length).filter(i =>
    theme === 'all' ? true : i.theme === theme
  );

  // Sub-screens
  if (screen === 'flash') return <ChengyuFlash  idioms={adaptiveQueue.length ? adaptiveQueue : filtered} lang={lang} onBack={() => setScreen('home')}/>;
  if (screen === 'quiz')  return <ChengyuQuiz   idioms={adaptiveQueue.length ? adaptiveQueue : filtered} lang={lang} onBack={() => setScreen('home')}/>;
  if (screen === 'match') return <ChengyuMatch  idioms={filtered} lang={lang} onBack={() => setScreen('home')}/>;
  if (screen === 'chain') return <ChengyuChain  idioms={idioms}   lang={lang} onBack={() => setScreen('home')}/>;
  if (screen === 'story') return <ChengyuStory  idioms={filtered} lang={lang} onBack={() => setScreen('home')}/>;
  if (screen === 'fill')  return <ChengyuFill   idioms={adaptiveQueue.length ? adaptiveQueue : filtered} lang={lang} onBack={() => setScreen('home')}/>;

  const nextLabel = adaptive.getNextFocusLabel(lang);

  const modules = [
    {
      id:'flash', icon:'🃏',
      title: t('成语闪卡','Flashcards','Flashcard'),
      desc: t('自适应顺序 · 看成语翻面看意思','Adaptive order · flip for meaning','Adattivo'),
      tag:  nextLabel || undefined,
      color:'#E3F2FD', accent:'#1565C0', onClick:()=>setScreen('flash'),
    },
    {
      id:'quiz', icon:'✅',
      title: t('选义测验','Choose Meaning','Quiz'),
      desc: t('4选1 · 按掌握度排序','4-choice · sorted by mastery','4 scelte'),
      color:'#E8F5E9', accent:'#2E7D32', onClick:()=>setScreen('quiz'),
    },
    {
      id:'fill', icon:'✏️',
      title: t('看义填词','Fill in Blank','Completa'),
      desc: t('看意思写成语 · 拼音提示','Write from meaning · pinyin hint','Scrivi il proverbio'),
      color:'#FFF8E1', accent:'#F57F17', onClick:()=>setScreen('fill'),
    },
    {
      id:'match', icon:'🔗',
      title: t('配对游戏','Matching Game','Abbinamento'),
      desc: t('6对快速配对','6-pair speed match','6 coppie'),
      color:'#FCE4EC', accent:'#C62828', onClick:()=>setScreen('match'),
    },
    {
      id:'story', icon:'📖',
      title: t('典故阅读','Read Story','Storia'),
      desc: t('了解历史典故','Read the origin','Leggi l\'origine'),
      color:'#F3E5F5', accent:'#6A1B9A', onClick:()=>setScreen('story'),
    },
    {
      id:'chain', icon:'⛓️',
      title: t('成语接龙','Idiom Chain','Catena'),
      desc: t('首字接末字 · 30秒挑战','Chain by last char · 30s challenge','Catena'),
      tag: t('挑战','Challenge','Sfida'),
      color:'#E0F2F1', accent:'#00695C', onClick:()=>setScreen('chain'),
    },
  ];

  return (
    <ModuleTemplate
      color="#8B4513"
      icon="📜"
      title={t('成语','Idioms','Proverbi')}
      subtitle={t('中华成语 · 典故 · 游戏','Chinese idioms · stories · games','Proverbi cinesi')}
      onBack={onBack}
      backLabel={t('‹ 返回主页','‹ Back','‹ Indietro')}
      stats={[
        { value: idioms.length,                    label: t('条成语','idioms','proverbi') },
        { value: `Lv${adaptive.userLevel}`,        label: t('当前等级','Level','Livello') },
        { value: adaptive.stats.due || '—',        label: t('待复习','To Review','Revisione') },
      ]}
      modules={modules}
      lang={lang}
      extra={
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Adaptive progress bar */}
          {!adaptive.loading && (
            <AdaptiveBar stats={adaptive.stats} lang={lang}/>
          )}

          {/* Points badge */}
          <div style={{ display:'flex', justifyContent:'center' }}>
            <PointsBadge total={points} size="normal" color="#8B4513"/>
          </div>

          {/* Level progression — show which levels have content */}
          {!adaptive.loading && (
            <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px',
              border:'1px solid #E8D5B0' }}>
              <div style={{ fontSize:11, color:'#a07850', marginBottom:8 }}>
                {t('按难度分布','By difficulty','Per livello')}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {[1,2,3,4].map(lv => {
                  const byLevel = adaptive.getByLevel();
                  const count   = byLevel[lv]?.length || 0;
                  const mastered = byLevel[lv]?.filter(i =>
                    adaptive.getItemMastery(i.id) >= 0.8).length || 0;
                  const isCurrentLevel = lv === adaptive.userLevel;
                  return (
                    <div key={lv} onClick={() => {
                      // Filter to this difficulty level
                      const lvItems = byLevel[lv];
                      if (lvItems?.length) setScreen('flash');
                    }} style={{
                      flex:1, textAlign:'center', padding:'8px 4px',
                      borderRadius:10, cursor:'pointer',
                      background: isCurrentLevel ? '#FBE9E7' : '#f9f5ef',
                      border: `2px solid ${isCurrentLevel ? '#8B4513' : '#E8D5B0'}`,
                    }}>
                      <LevelBadge level={lv}/>
                      <div style={{ fontSize:16, fontWeight:700, color:'#5D2E0C',
                        marginTop:4 }}>{count}</div>
                      <div style={{ fontSize:9, color:'#a07850' }}>
                        {mastered}/{count} ✅
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Theme filter */}
          {themes.length > 1 && (
            <div style={{ background:'#fff', borderRadius:14, padding:'12px 14px',
              border:'1px solid #E8D5B0' }}>
              <div style={{ fontSize:11, color:'#a07850', marginBottom:8 }}>
                {t('按主题筛选','Filter by theme','Filtra')}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['all', ...themes].map(th => (
                  <button key={th} onClick={() => setTheme(th)}
                    style={{ padding:'5px 12px', borderRadius:20, fontSize:12,
                      border:`1.5px solid ${theme===th?'#8B4513':'#E8D5B0'}`,
                      background: theme===th ? '#8B4513' : '#fff',
                      color: theme===th ? '#fff' : '#5D2E0C',
                      cursor:'pointer', fontWeight: theme===th ? 600 : 400 }}>
                    {th==='all' ? t('全部','All','Tutti') : (THEME_LABELS[th]||th)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          <div style={{ background:'#FFF8E1', borderRadius:14, padding:'12px 14px',
            border:'1px solid #FFE082', fontSize:12, color:'#7B5800',
            display:'flex', gap:8, alignItems:'flex-start' }}>
            <span>💡</span>
            <span>{t(
              '系统会优先显示需要复习的内容，再推送新成语，帮你高效记忆！',
              'Content is shown in adaptive order: reviews first, then new items at your level.',
              'Il sistema mostra prima le revisioni, poi i nuovi contenuti.'
            )}</span>
          </div>
        </div>
      }
    />
  );
}
