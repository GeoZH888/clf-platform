// src/clf/components/CLFProfile.jsx
// Heritage learner onboarding — captures generation, native lang, goals, level

import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const STEPS = ['lang', 'generation', 'level', 'goals'];

const GOALS = [
  { id:'speak_family',  zh:'和家人用中文交流',      en:'Speak Chinese with family',         emoji:'👨‍👩‍👧' },
  { id:'read_write',    zh:'学会读写汉字',            en:'Learn to read & write characters',  emoji:'✍️' },
  { id:'hsk',           zh:'通过HSK考试',             en:'Pass HSK exam',                     emoji:'🎓' },
  { id:'culture',       zh:'了解中国文化',            en:'Understand Chinese culture',         emoji:'🏮' },
  { id:'heritage',      zh:'传承家族文化',            en:'Preserve family heritage',           emoji:'🏠' },
  { id:'fun',           zh:'好玩，感兴趣',            en:'Just for fun',                       emoji:'🎮' },
];

const LEVELS = [
  { v:0,  zh:'幼儿 (3-5岁)',       en:'Preschool (3-5)',        desc_en:'First words, colors, family' },
  { v:1,  zh:'小学低年级 (6-8岁)', en:'Early Primary (6-8)',    desc_en:'100-200 characters, basic conversation' },
  { v:3,  zh:'小学 (9-11岁)',      en:'Primary (9-11)',         desc_en:'400-800 characters, HSK 1-2' },
  { v:5,  zh:'小学高年级 (11-12)', en:'Upper Primary (11-12)', desc_en:'800-1000 characters, HSK 3' },
  { v:7,  zh:'初中 (12-15岁)',     en:'Middle School (12-15)', desc_en:'1200+ characters, HSK 4' },
  { v:10, zh:'高中/成人',          en:'High School / Adult',   desc_en:'HSK 5-6, classical Chinese' },
];

export default function CLFProfile({ token, onSaved }) {
  const [step,       setStep]       = useState(0);
  const [nativeLang, setNativeLang] = useState('it');
  const [generation, setGeneration] = useState(2);
  const [level,      setLevel]      = useState(1);
  const [goals,      setGoals]      = useState([]);
  const [name,       setName]       = useState('');
  const [saving,     setSaving]     = useState(false);

  const V = { bg:'#fdf6e3', verm:'#8B4513', border:'#e8d5b0', text:'#1a0a05' };

  function toggleGoal(id) {
    setGoals(g => g.includes(id) ? g.filter(x=>x!==id) : [...g, id]);
  }

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.from('clf_learner_profiles')
      .upsert({
        device_token:  token,
        display_name:  name.trim() || 'Learner',
        native_lang:   nativeLang,
        generation,
        current_level: level,
        goals,
      }, { onConflict:'device_token' })
      .select().maybeSingle();
    setSaving(false);
    if (!error && data) onSaved(data);
    else alert('Error: ' + error?.message);
  }

  const stepKey = STEPS[step];

  return (
    <div style={{ minHeight:'100dvh', background:V.bg, display:'flex',
      flexDirection:'column', padding:'24px 16px' }}>

      {/* Progress dots */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:28 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ width: i===step ? 24 : 8, height:8, borderRadius:4,
            background: i<=step ? V.verm : '#e8d5b0', transition:'all 0.3s' }}/>
        ))}
      </div>

      {/* Step: Language */}
      {stepKey === 'lang' && (
        <div style={{ flex:1 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>👋</div>
          <div style={{ fontSize:22, fontWeight:700, color:V.text, marginBottom:6 }}>
            你好！Welcome！Benvenuto！
          </div>
          <div style={{ fontSize:14, color:'#6b4c2a', marginBottom:28, lineHeight:1.7 }}>
            Heritage Chinese learning for the Chinese diaspora.<br/>
            大卫学中文 · 华裔子女中文学习平台
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:V.verm, marginBottom:12 }}>
            What's your main language at home?
          </div>
          {[
            { id:'it', flag:'🇮🇹', label:'Italiano' },
            { id:'en', flag:'🇬🇧', label:'English' },
            { id:'fr', flag:'🇫🇷', label:'Français' },
            { id:'de', flag:'🇩🇪', label:'Deutsch' },
            { id:'es', flag:'🇪🇸', label:'Español' },
            { id:'pt', flag:'🇵🇹', label:'Português' },
          ].map(l => (
            <button key={l.id} onClick={() => setNativeLang(l.id)}
              style={{ width:'100%', padding:'14px 16px', marginBottom:8, borderRadius:14,
                border:`2px solid ${nativeLang===l.id ? V.verm : V.border}`,
                background: nativeLang===l.id ? '#FFF3E0' : '#fff',
                display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                fontSize:15, fontWeight: nativeLang===l.id ? 600 : 400 }}>
              <span style={{ fontSize:24 }}>{l.flag}</span>{l.label}
              {nativeLang===l.id && <span style={{ marginLeft:'auto', color:V.verm }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Step: Generation */}
      {stepKey === 'generation' && (
        <div style={{ flex:1 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🏠</div>
          <div style={{ fontSize:20, fontWeight:700, color:V.text, marginBottom:6 }}>
            What's your connection to China?
          </div>
          <div style={{ fontSize:13, color:'#6b4c2a', marginBottom:24 }}>
            This helps us tailor the content for you
          </div>
          {[
            { v:1, emoji:'✈️', en:'I moved from China / I grew up there',     zh:'我从中国来' },
            { v:2, emoji:'🌏', en:'My parents are Chinese, I was born abroad', zh:'父母是华人，我在海外出生' },
            { v:3, emoji:'👴', en:'My grandparents are Chinese',               zh:'祖父母是华人' },
            { v:4, emoji:'❤️', en:'I love Chinese culture / heritage learner', zh:'我热爱中国文化' },
          ].map(g => (
            <button key={g.v} onClick={() => setGeneration(g.v)}
              style={{ width:'100%', padding:'16px', marginBottom:10, borderRadius:14,
                border:`2px solid ${generation===g.v ? V.verm : V.border}`,
                background: generation===g.v ? '#FFF3E0' : '#fff',
                textAlign:'left', cursor:'pointer' }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontSize:28 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:V.text }}>{g.en}</div>
                  <div style={{ fontSize:12, color:'#a07850', fontFamily:"'STKaiti','KaiTi',serif" }}>{g.zh}</div>
                </div>
                {generation===g.v && <span style={{ marginLeft:'auto', color:V.verm, fontSize:18 }}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Level */}
      {stepKey === 'level' && (
        <div style={{ flex:1 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
          <div style={{ fontSize:20, fontWeight:700, color:V.text, marginBottom:6 }}>
            What's your current Chinese level?
          </div>
          <div style={{ fontSize:13, color:'#6b4c2a', marginBottom:20 }}>
            Don't worry — you can always change this later
          </div>
          {LEVELS.map(l => (
            <button key={l.v} onClick={() => setLevel(l.v)}
              style={{ width:'100%', padding:'14px 16px', marginBottom:8, borderRadius:14,
                border:`2px solid ${level===l.v ? V.verm : V.border}`,
                background: level===l.v ? '#FFF3E0' : '#fff',
                textAlign:'left', cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:V.text }}>{l.en}</div>
                  <div style={{ fontSize:12, color:'#a07850', fontFamily:"'STKaiti','KaiTi',serif" }}>{l.zh}</div>
                  <div style={{ fontSize:11, color:'#c0a080', marginTop:2 }}>{l.desc_en}</div>
                </div>
                {level===l.v && <span style={{ marginLeft:'auto', color:V.verm, fontSize:18 }}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Goals + Name */}
      {stepKey === 'goals' && (
        <div style={{ flex:1 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
          <div style={{ fontSize:20, fontWeight:700, color:V.text, marginBottom:6 }}>
            Why are you learning Chinese?
          </div>
          <div style={{ fontSize:13, color:'#6b4c2a', marginBottom:16 }}>
            Pick all that apply
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
            {GOALS.map(g => {
              const on = goals.includes(g.id);
              return (
                <button key={g.id} onClick={() => toggleGoal(g.id)}
                  style={{ padding:'12px 10px', borderRadius:14, cursor:'pointer',
                    border:`2px solid ${on ? V.verm : V.border}`,
                    background: on ? '#FFF3E0' : '#fff',
                    textAlign:'center' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{g.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:V.text, lineHeight:1.4 }}>{g.en}</div>
                  <div style={{ fontSize:10, color:'#a07850', fontFamily:"'STKaiti','KaiTi',serif" }}>{g.zh}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:V.verm, display:'block', marginBottom:6, fontWeight:600 }}>
              Your name (optional)
            </label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="e.g. David, 大卫, Davide"
              style={{ width:'100%', padding:'12px 14px', fontSize:15, borderRadius:12,
                border:`2px solid ${V.border}`, boxSizing:'border-box', outline:'none',
                background:'#fff' }}/>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', gap:10, paddingTop:16 }}>
        {step > 0 && (
          <button onClick={() => setStep(s=>s-1)}
            style={{ padding:'14px 20px', borderRadius:14, border:`1px solid ${V.border}`,
              background:'#fff', color:V.verm, fontSize:14, cursor:'pointer' }}>
            ‹ Back
          </button>
        )}
        <button
          onClick={() => step < STEPS.length-1 ? setStep(s=>s+1) : save()}
          disabled={saving}
          style={{ flex:1, padding:'14px', borderRadius:14, border:'none',
            background: saving ? '#e0e0e0' : V.verm,
            color: saving ? '#aaa' : '#fff',
            fontSize:15, fontWeight:700, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : step < STEPS.length-1 ? 'Next →' : '🚀 Start Learning!'}
        </button>
      </div>
    </div>
  );
}
