// src/pinyin/PinyinTable.jsx
// 声母韵母表 — IPA display + Azure TTS via SSML phoneme tags
import { useState } from 'react';
import VisemeMouth from './VisemeMouth';
import { useAzureViseme } from '../hooks/useAzureViseme';
import { INITIAL_IPA, FINAL_IPA } from '../data/pinyinIPA';

// ── Sound data ────────────────────────────────────────────────────────────────
const INITIAL_GROUPS = [
  { label:'双唇音', color:'#E53935', items:[
    { py:'b', eg:'爸', meaning:'father' },
    { py:'p', eg:'爬', meaning:'climb' },
    { py:'m', eg:'妈', meaning:'mother' },
  ]},
  { label:'唇齿音', color:'#FB8C00', items:[
    { py:'f', eg:'飞', meaning:'fly' },
  ]},
  { label:'舌尖音', color:'#43A047', items:[
    { py:'d', eg:'大', meaning:'big' },
    { py:'t', eg:'他', meaning:'he' },
    { py:'n', eg:'你', meaning:'you' },
    { py:'l', eg:'来', meaning:'come' },
  ]},
  { label:'舌根音', color:'#1E88E5', items:[
    { py:'g', eg:'个', meaning:'CLF' },
    { py:'k', eg:'看', meaning:'look' },
    { py:'h', eg:'好', meaning:'good' },
  ]},
  { label:'舌面音', color:'#00897B', items:[
    { py:'j', eg:'家', meaning:'home' },
    { py:'q', eg:'去', meaning:'go' },
    { py:'x', eg:'小', meaning:'small' },
  ]},
  { label:'翘舌音', color:'#E65100', items:[
    { py:'zh', eg:'这', meaning:'this' },
    { py:'ch', eg:'吃', meaning:'eat' },
    { py:'sh', eg:'是', meaning:'is' },
    { py:'r',  eg:'热', meaning:'hot' },
  ]},
  { label:'平舌音', color:'#00ACC1', items:[
    { py:'z', eg:'在', meaning:'at' },
    { py:'c', eg:'草', meaning:'grass' },
    { py:'s', eg:'三', meaning:'three' },
  ]},
  { label:'半元音', color:'#8E24AA', items:[
    { py:'y', eg:'一', meaning:'one' },
    { py:'w', eg:'我', meaning:'I' },
  ]},
];

const FINAL_GROUPS = [
  { label:'单韵母', color:'#E53935', items:[
    { py:'a',  eg:'啊', meaning:'ah' },
    { py:'o',  eg:'喔', meaning:'oh' },
    { py:'e',  eg:'鹅', meaning:'goose' },
    { py:'i',  eg:'衣', meaning:'clothes' },
    { py:'u',  eg:'乌', meaning:'crow' },
    { py:'ü',  eg:'鱼', meaning:'fish' },
  ]},
  { label:'复韵母', color:'#1E88E5', items:[
    { py:'ai', eg:'爱', meaning:'love' },
    { py:'ei', eg:'诶', meaning:'hey' },
    { py:'ui', eg:'位', meaning:'position' },
    { py:'ao', eg:'奥', meaning:'brilliant' },
    { py:'ou', eg:'欧', meaning:'Europe' },
    { py:'iu', eg:'牛', meaning:'cow' },
    { py:'ie', eg:'叶', meaning:'leaf' },
    { py:'üe', eg:'月', meaning:'moon' },
    { py:'er', eg:'耳', meaning:'ear' },
  ]},
  { label:'鼻韵母', color:'#43A047', items:[
    { py:'an',  eg:'安', meaning:'peace' },
    { py:'en',  eg:'恩', meaning:'grace' },
    { py:'in',  eg:'音', meaning:'sound' },
    { py:'un',  eg:'云', meaning:'cloud' },
    { py:'ün',  eg:'晕', meaning:'dizzy' },
    { py:'ang', eg:'昂', meaning:'upright' },
    { py:'eng', eg:'灯', meaning:'lamp' },
    { py:'ing', eg:'鹰', meaning:'eagle' },
    { py:'ong', eg:'红', meaning:'red' },
  ]},
];

// ── Small sound card ──────────────────────────────────────────────────────────
function SoundCard({ item, ipaData, color, active, onTap }) {
  return (
    <button onClick={() => onTap(item.py)} style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      padding:'8px 10px', borderRadius:12, cursor:'pointer',
      border:`2px solid ${active ? color : '#E0E0E0'}`,
      background: active ? color+'18' : '#fff',
      transition:'all 0.18s', minWidth:54,
      WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
    }}>
      {/* Pinyin */}
      <div style={{ fontSize:20, fontWeight:700, color: active ? color : '#333', lineHeight:1 }}>
        {item.py}
      </div>
      {/* IPA */}
      {ipaData && (
        <div style={{
          fontSize:11, color: active ? color : '#999', lineHeight:1,
          fontFamily:'serif', letterSpacing:0.3,
        }}>
          /{ipaData.ipa}/
        </div>
      )}
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ item, ipaData, color, lang, onClose, speak, speaking, visemeId, azureError }) {
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  return (
    <div style={{
      background:'#fff', borderRadius:18,
      border:`2px solid ${color}44`,
      boxShadow:`0 6px 24px ${color}22`,
      padding:'16px 14px', margin:'0 0 16px', position:'relative',
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position:'absolute', top:10, right:12, border:'none',
        background:'none', fontSize:22, color:'#aaa', cursor:'pointer',
      }}>×</button>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
        {/* Big pinyin */}
        <div style={{ fontSize:46, fontWeight:800, color, lineHeight:1 }}>{item.py}</div>

        <div style={{ flex:1 }}>
          {/* IPA badge */}
          {ipaData && (
            <div style={{
              display:'inline-block',
              background: color+'15', border:`1px solid ${color}44`,
              borderRadius:8, padding:'2px 10px', marginBottom:6,
              fontSize:18, fontFamily:'serif', color,
              letterSpacing:0.5,
            }}>
              /{ipaData.ipa}/
            </div>
          )}
          {/* Description */}
          {ipaData && (
            <div style={{ fontSize:12, color:'#546E7A', lineHeight:1.5 }}>
              <div>{ipaData.desc}</div>
              <div style={{ color:'#90A4AE', fontSize:11 }}>{ipaData.en}</div>
            </div>
          )}
          {/* Example */}
          <div style={{ fontSize:12, color:'#aaa', marginTop:4 }}>
            {t('例词','Example','Esempio')}: {item.eg} · {item.meaning}
          </div>
        </div>
      </div>

      {/* Viseme mouth */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
        <VisemeMouth visemeId={visemeId} speaking={speaking} color={color} size={240} showLabel={true}/>
      </div>

      {/* Two TTS buttons */}
      <div style={{ display:'flex', gap:10 }}>
        {/* Button 1: Pure IPA phoneme — exact sound, no character ambiguity */}
        <button
          onClick={() => speak(item.eg, item.py)}   // passes phonemeKey
          disabled={speaking}
          style={{
            flex:1, padding:'11px 8px', borderRadius:12, border:'none',
            background: speaking ? '#E0E0E0' : color,
            color: speaking ? '#aaa' : '#fff',
            fontWeight:700, fontSize:14, cursor: speaking ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
          🔊 {t(`听"${item.py}"`,`"${item.py}"`,`"${item.py}"`)}
          {ipaData && <span style={{ fontSize:11, opacity:0.8 }}>/{ipaData.ipa}/</span>}
        </button>

        {/* Button 2: Example word in context */}
        <button
          onClick={() => speak(item.eg, null)}       // no phonemeKey → reads character
          disabled={speaking}
          style={{
            flex:1, padding:'11px 8px', borderRadius:12, border:'none',
            background: speaking ? '#E0E0E0' : '#546E7A',
            color: speaking ? '#aaa' : '#fff',
            fontWeight:600, fontSize:14, cursor: speaking ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
          🔊 {t(`听"${item.eg}"`,`"${item.eg}"`,`"${item.eg}"`)}
        </button>
      </div>

      {azureError && (
        <div style={{ marginTop:8, padding:'8px 12px', borderRadius:8,
          background:'#FFF3E0', fontSize:12, color:'#E65100' }}>
          ⚠️ {azureError}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PinyinTable({ lang='zh', onBack }) {
  const [tab,    setTab]    = useState('initial');
  const [active, setActive] = useState(null);
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  // speak() now accepts (text, phonemeKey)
  // phonemeKey → use IPA SSML; null → read character directly
  const { speak: speakRaw, speaking, visemeId, error: azureError, cancel } = useAzureViseme();

  function speak(text, phonemeKey) {
    speakRaw(text, phonemeKey);
  }

  const groups = tab === 'initial' ? INITIAL_GROUPS : FINAL_GROUPS;
  const ipaMap  = tab === 'initial' ? INITIAL_IPA : FINAL_IPA;

  let activeItem = null, activeColor = '#1976D2';
  for (const g of groups) {
    const found = g.items.find(i => i.py === active);
    if (found) { activeItem = found; activeColor = g.color; break; }
  }

  function handleTap(py) {
    if (active === py) { setActive(null); cancel(); }
    else { setActive(py); cancel(); }
  }

  return (
    <div style={{ background:'var(--bg,#f5f5f5)', minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{
        background:'#3F51B5', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12,
        position:'sticky', top:0, zIndex:10,
      }}>
        {onBack && (
          <button onClick={() => { cancel(); onBack(); }} style={{
            border:'none', background:'none', fontSize:26,
            color:'#fff', cursor:'pointer', lineHeight:1, padding:'0 4px',
          }}>‹</button>
        )}
        <div style={{ fontSize:16, fontWeight:600, color:'#fff' }}>
          {t('声母韵母表','Pinyin Table','Tabella Pinyin')}
        </div>
        {speaking && (
          <div style={{ marginLeft:'auto', fontSize:11, color:'#C5CAE9',
            display:'flex', alignItems:'center', gap:4 }}>
            <span>▶</span> {t('播放中…','Playing…','In riproduzione…')}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{
        display:'flex', gap:0, margin:'14px 16px',
        background:'#E8EAF6', borderRadius:12, padding:4,
      }}>
        {[['initial', t('声母','Initials','Iniziali')],
          ['final',   t('韵母','Finals','Finali')]].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setActive(null); cancel(); }}
            style={{
              flex:1, padding:'8px 0', borderRadius:10, border:'none',
              cursor:'pointer',
              background: tab===k ? '#3F51B5' : 'transparent',
              color:      tab===k ? '#fff' : '#5C6BC0',
              fontWeight: tab===k ? 700 : 400,
              fontSize:14, transition:'all 0.2s',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding:'0 14px' }}>
        {activeItem && (
          <DetailPanel
            item={activeItem}
            ipaData={ipaMap[activeItem.py]}
            color={activeColor} lang={lang}
            onClose={() => { setActive(null); cancel(); }}
            speak={speak} speaking={speaking}
            visemeId={visemeId} azureError={azureError}
          />
        )}

        {groups.map((group, gi) => (
          <div key={gi} style={{ marginBottom:18 }}>
            <div style={{
              fontSize:11, fontWeight:600, color:group.color,
              letterSpacing:1, marginBottom:6, paddingLeft:2,
            }}>{group.label}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {group.items.map(item => (
                <SoundCard key={item.py} item={item}
                  ipaData={ipaMap[item.py]}
                  color={group.color}
                  active={active===item.py} onTap={handleTap} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
