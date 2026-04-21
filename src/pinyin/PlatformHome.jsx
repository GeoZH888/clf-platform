// src/components/PlatformHome.jsx
// 汉字学习平台 — main hub, two sibling modules

import { useLang } from '../context/LanguageContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';

function greet() {
  const h = new Date().getHours();
  if (h < 6)  return { zh:'夜深了，还在学习 🌙', en:'Burning midnight oil 🌙', it:'Stai ancora studiando 🌙' };
  if (h < 12) return { zh:'早上好，开始学习 ☀️', en:'Good morning ☀️', it:'Buongiorno ☀️' };
  if (h < 18) return { zh:'下午好，继续加油 ✨', en:'Good afternoon ✨', it:'Buon pomeriggio ✨' };
  return       { zh:'晚上好，每天进步 🔥', en:'Good evening 🔥', it:'Buona sera 🔥' };
}

const MODULES = [
  {
    id: 'lianzi',
    emoji: '🐢',
    zh: '练字',
    en: 'Character Tracing',
    it: 'Tracciamento Caratteri',
    desc:   { zh:'甲骨文描红 · 笔顺练习', en:'Oracle bone script · stroke order', it:'Scrittura oracolo · ordine tratti' },
    color:  '#FBE9E7',
    border: '#8B4513',
    text:   '#5D2E0C',
    features: [
      { zh:'字形临摹', en:'Character tracing' },
      { zh:'笔顺测验', en:'Stroke order quiz' },
      { zh:'AI自动填充', en:'AI auto-fill' },
      { zh:'练习统计', en:'Practice stats' },
    ],
  },
  {
    id: 'pinyin',
    emoji: '🔤',
    zh: '拼音',
    en: 'Pinyin Learning',
    it: 'Impara il Pinyin',
    desc:   { zh:'声母韵母 · 四声练习', en:'Initials & finals · tone practice', it:'Iniziali e finali · toni' },
    color:  '#E3F2FD',
    border: '#1565C0',
    text:   '#0C3C7A',
    features: [
      { zh:'声母韵母表', en:'Initials & finals table' },
      { zh:'四声练习', en:'Tone practice' },
      { zh:'听音识调', en:'Listen & identify' },
      { zh:'拼音输入', en:'Type pinyin' },
    ],
  },
];

export default function PlatformHome({ onSelect, stats={} }) {
  const { lang } = useLang();
  const greeting = greet();
  const g = lang==='zh' ? greeting.zh : lang==='it' ? greeting.it : greeting.en;

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:40 }}>

      {/* Header */}
      <div style={{ padding:'16px 16px 12px',
        display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:16, fontWeight:500, color:'var(--text)' }}>{g}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>
            {new Date().toLocaleDateString('zh-CN',
              { month:'long', day:'numeric', weekday:'long' })}
          </div>
        </div>
        <LangSwitcher/>
      </div>

      {/* Platform title */}
      <div style={{ textAlign:'center', padding:'8px 16px 20px' }}>
        <div style={{ fontSize:22, fontWeight:500, color:'var(--text)',
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          汉字学习平台
        </div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>
          {lang==='zh' ? '选择学习模块' :
           lang==='it' ? 'Scegli il modulo' :
           'Choose a learning module'}
        </div>
      </div>

      {/* Module cards — side by side on wider screens, stacked on narrow */}
      <div style={{ padding:'0 16px',
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
        gap:14 }}>

        {MODULES.map(m => {
          const name = lang==='zh' ? m.zh : lang==='it' ? m.it : m.en;
          const desc = lang==='zh' ? m.desc.zh : lang==='it' ? m.desc.it : m.desc.en;
          return (
            <button key={m.id} onClick={() => onSelect(m.id)}
              style={{ background:m.color, border:`2px solid ${m.border}`,
                borderRadius:20, padding:'20px', cursor:'pointer',
                textAlign:'left', width:'100%',
                WebkitTapHighlightColor:'transparent',
                transition:'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>

              {/* Icon + title */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{ width:48, height:48, borderRadius:14,
                  background:m.border, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:24, flexShrink:0 }}>
                  {m.emoji}
                </div>
                <div>
                  <div style={{ fontSize:20, fontWeight:500, color:m.text,
                    fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
                    {name}
                  </div>
                  <div style={{ fontSize:11, color:m.border, marginTop:2, opacity:0.8 }}>
                    {desc}
                  </div>
                </div>
              </div>

              {/* Feature list */}
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
                {m.features.map((f, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center',
                    gap:6, fontSize:13, color:m.text }}>
                    <div style={{ width:5, height:5, borderRadius:'50%',
                      background:m.border, flexShrink:0 }}/>
                    {lang==='zh' ? f.zh : f.en}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ display:'flex', alignItems:'center',
                justifyContent:'space-between' }}>
                <div style={{ fontSize:12, color:m.border, opacity:0.7 }}>
                  {lang==='zh' ? '点击进入' : lang==='it' ? 'Tocca per iniziare' : 'Tap to start'}
                </div>
                <div style={{ width:32, height:32, borderRadius:'50%',
                  background:m.border, display:'flex', alignItems:'center',
                  justifyContent:'center', color:'#fff', fontSize:16 }}>›</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'24px 16px 0',
        fontSize:11, color:'var(--text-3)' }}>
        miaohong.netlify.app · 汉字学习平台
      </div>
    </div>
  );
}
