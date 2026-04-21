// src/grammar/GrammarApp.jsx
// 语法 Grammar module — patterns, examples, fill-blank, sentence builder

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import ModuleTemplate from '../components/ModuleTemplate.jsx';
import AdaptiveCard   from '../components/AdaptiveCard.jsx';
import { supabase }   from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

// ── Grammar patterns database ─────────────────────────────────────────────────
const PATTERNS = [
  {
    id:'shi_de', level:1, hsk:3,
    pattern:'是…的', pattern_en:'Emphasis: 是…的',
    rule_zh:'强调动作发生的时间、地点或方式，用"是…的"结构',
    rule_en:'Emphasizes when, where, or how a past action occurred',
    template_zh:'我是{昨天}来的。',
    template_en:'I came {yesterday}.',
    examples:[
      { zh:'我是坐飞机来的。', en:'I came by plane.', it:'Sono venuto in aereo.' },
      { zh:'他是在北京出生的。', en:'He was born in Beijing.', it:'È nato a Pechino.' },
      { zh:'她是去年开始学中文的。', en:'She started learning Chinese last year.', it:'Ha iniziato lo scorso anno.' },
    ],
    quiz:[
      { sentence:'他＿上海来的。', answer:'是', options:['是','有','在','从'], blank:1 },
      { sentence:'我是坐火车＿的。', answer:'来', options:['来','去','走','回'], blank:1 },
    ],
  },
  {
    id:'ba', level:1, hsk:3,
    pattern:'把字句', pattern_en:'Disposal: 把',
    rule_zh:'用"把"把宾语提前，强调对宾语的处理方式',
    rule_en:'Moves the object before the verb to emphasize how it is handled',
    template_zh:'我把{书}放在桌子上。',
    template_en:'I put the {book} on the table.',
    examples:[
      { zh:'请把门关上。', en:'Please close the door.', it:'Per favore chiudi la porta.' },
      { zh:'他把作业做完了。', en:'He finished his homework.', it:'Ha finito i compiti.' },
      { zh:'我把手机忘在家里了。', en:'I left my phone at home.', it:'Ho lasciato il telefono a casa.' },
    ],
    quiz:[
      { sentence:'请＿窗户打开。', answer:'把', options:['把','被','让','给'], blank:1 },
      { sentence:'他把书＿在桌上。', answer:'放', options:['放','有','是','在'], blank:1 },
    ],
  },
  {
    id:'bei', level:2, hsk:4,
    pattern:'被字句', pattern_en:'Passive: 被',
    rule_zh:'"被"表示被动，宾语成为主语，受到动作影响',
    rule_en:'"被" marks passive voice — the object becomes subject',
    template_zh:'{书}被他借走了。',
    template_en:'The {book} was borrowed by him.',
    examples:[
      { zh:'蛋糕被小狗吃了。', en:'The cake was eaten by the dog.', it:'La torta è stata mangiata dal cane.' },
      { zh:'他的钱包被偷了。', en:'His wallet was stolen.', it:'Il suo portafoglio è stato rubato.' },
      { zh:'窗户被风吹开了。', en:'The window was blown open by the wind.', it:'La finestra è stata aperta dal vento.' },
    ],
    quiz:[
      { sentence:'他的钱包＿偷了。', answer:'被', options:['被','把','让','给'], blank:1 },
      { sentence:'作业被老师＿走了。', answer:'收', options:['收','有','是','看'], blank:1 },
    ],
  },
  {
    id:'bijiao', level:1, hsk:3,
    pattern:'比较句 A比B+adj', pattern_en:'Comparison: A 比 B',
    rule_zh:'用"比"比较两者差异：A比B+形容词(+差距)',
    rule_en:'Use "比" to compare: A is more [adj] than B',
    template_zh:'苹果比橙子{甜}。',
    template_en:'Apples are {sweeter} than oranges.',
    examples:[
      { zh:'今天比昨天冷。', en:'Today is colder than yesterday.', it:'Oggi fa più freddo di ieri.' },
      { zh:'他比我高十厘米。', en:'He is 10cm taller than me.', it:'È 10cm più alto di me.' },
      { zh:'中文比英文难一点。', en:'Chinese is a bit harder than English.', it:'Il cinese è un po\' più difficile dell\'inglese.' },
    ],
    quiz:[
      { sentence:'他＿我跑得快。', answer:'比', options:['比','被','把','和'], blank:1 },
      { sentence:'这个苹果比那个＿。', answer:'大', options:['大','多','是','有'], blank:1 },
    ],
  },
  {
    id:'guo', level:2, hsk:3,
    pattern:'动词+过 (experience)', pattern_en:'Experience: verb+过',
    rule_zh:'动词后加"过"表示曾经有过某种经历',
    rule_en:'Adding "过" after a verb means you have experienced it before',
    template_zh:'我去{过}北京。',
    template_en:'I have been to Beijing {before}.',
    examples:[
      { zh:'我吃过北京烤鸭。', en:'I have eaten Peking duck.', it:'Ho già mangiato l\'anatra alla pechinese.' },
      { zh:'你去过上海吗？', en:'Have you ever been to Shanghai?', it:'Sei mai stato a Shanghai?' },
      { zh:'他没学过法语。', en:'He has never studied French.', it:'Non ha mai studiato il francese.' },
    ],
    quiz:[
      { sentence:'我去＿中国。', answer:'过', options:['过','了','着','的'], blank:1 },
      { sentence:'他没吃＿日本料理。', answer:'过', options:['过','了','着','好'], blank:1 },
    ],
  },
  {
    id:'zhe', level:2, hsk:4,
    pattern:'动词+着 (ongoing state)', pattern_en:'Duration: verb+着',
    rule_zh:'"着"表示动作或状态的持续',
    rule_en:'"着" indicates a continuing action or state',
    template_zh:'门开{着}呢。',
    template_en:'The door is (staying) open.',
    examples:[
      { zh:'她笑着说话。', en:'She spoke with a smile.', it:'Parlava sorridendo.' },
      { zh:'请听着！', en:'Listen carefully!', it:'Ascolta bene!' },
      { zh:'桌上放着一本书。', en:'A book is sitting on the table.', it:'C\'è un libro sul tavolo.' },
    ],
    quiz:[
      { sentence:'她站＿说话。', answer:'着', options:['着','过','了','完'], blank:1 },
      { sentence:'窗户开＿呢。', answer:'着', options:['着','过','了','好'], blank:1 },
    ],
  },
  {
    id:'yaoshi', level:2, hsk:4,
    pattern:'要是…就… (conditional)', pattern_en:'Conditional: 要是…就',
    rule_zh:'"要是"引出条件，"就"引出结果，表示假设',
    rule_en:'"要是" introduces the condition, "就" introduces the result',
    template_zh:'要是你来了，我{就}高兴了。',
    template_en:'If you come, I will be happy.',
    examples:[
      { zh:'要是明天下雨，我就不去了。', en:'If it rains tomorrow, I won\'t go.', it:'Se piove domani, non ci vado.' },
      { zh:'要是你努力学，就能成功。', en:'If you study hard, you\'ll succeed.', it:'Se studi, riuscirai.' },
      { zh:'要是有钱，我就去旅游。', en:'If I had money, I would travel.', it:'Se avessi soldi, viaggerei.' },
    ],
    quiz:[
      { sentence:'要是下雨，我＿不出去。', answer:'就', options:['就','也','都','才'], blank:1 },
      { sentence:'＿你喜欢，就买吧。', answer:'要是', options:['要是','因为','虽然','但是'], blank:1 },
    ],
  },
  {
    id:'suiran', level:2, hsk:4,
    pattern:'虽然…但是… (concession)', pattern_en:'Concession: 虽然…但是',
    rule_zh:'"虽然"承认前提，"但是"转折，表示让步关系',
    rule_en:'"虽然" acknowledges, "但是" pivots — even though…but',
    template_zh:'虽然很难，但是很有意思。',
    template_en:'Although it\'s hard, it\'s very interesting.',
    examples:[
      { zh:'虽然很贵，但是质量很好。', en:'Although it\'s expensive, the quality is good.', it:'Sebbene sia costoso, la qualità è buona.' },
      { zh:'虽然他很忙，但是他总是帮助别人。', en:'Although he\'s busy, he always helps others.', it:'Sebbene sia occupato, aiuta sempre gli altri.' },
    ],
    quiz:[
      { sentence:'虽然很难，＿我还是要学。', answer:'但是', options:['但是','所以','因为','而且'], blank:1 },
      { sentence:'＿下雨，我还是去了。', answer:'虽然', options:['虽然','因为','要是','如果'], blank:1 },
    ],
  },
];

// ── Sub-screen: Pattern Explorer ──────────────────────────────────────────────
function PatternExplorer({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const [selected, setSelected] = useState(null);

  if (selected) {
    const p = PATTERNS.find(x => x.id === selected);
    return (
      <div style={{ minHeight:'100dvh', background:'#F3E5F5', display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#6A1B9A', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => setSelected(null)} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
          <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>
            {p.pattern} {p.pattern_en !== p.pattern && <span style={{ fontSize:11, opacity:0.8 }}>· {p.pattern_en}</span>}
          </div>
          <span style={{ marginLeft:'auto', fontSize:10, background:'#fff2', color:'#fff', padding:'2px 8px', borderRadius:8 }}>
            HSK{p.hsk} · Lv{p.level}
          </span>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
          {/* Rule */}
          <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12,
            border:'1.5px solid #CE93D8' }}>
            <div style={{ fontSize:11, color:'#6A1B9A', fontWeight:600, marginBottom:6 }}>
              {t('语法规则','Grammar Rule')}
            </div>
            <div style={{ fontSize:13, color:'#1a0a05', lineHeight:1.7 }}>
              {lang === 'zh' ? p.rule_zh : p.rule_en}
            </div>
            <div style={{ marginTop:10, fontSize:14, color:'#6A1B9A', fontFamily:"'STKaiti','KaiTi',serif",
              background:'#F3E5F5', borderRadius:10, padding:'8px 12px', textAlign:'center', letterSpacing:2 }}>
              {p.pattern}
            </div>
          </div>
          {/* Examples */}
          <div style={{ fontSize:11, color:'#6A1B9A', fontWeight:600, marginBottom:8 }}>{t('例句','Examples')}</div>
          {p.examples.map((ex, i) => (
            <div key={i} style={{ background:'#fff', borderRadius:12, padding:'12px 14px',
              marginBottom:8, border:'1px solid #E1BEE7' }}>
              <div style={{ fontSize:16, color:'#1a0a05', fontFamily:"'STKaiti','KaiTi',serif",
                letterSpacing:1, marginBottom:4 }}>{ex.zh}</div>
              <div style={{ fontSize:12, color:'#6A1B9A', marginBottom:2 }}>{ex.en}</div>
              {lang === 'it' && <div style={{ fontSize:11, color:'#a07850' }}>{ex.it}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const byLevel = [1, 2];
  return (
    <div style={{ minHeight:'100dvh', background:'#F3E5F5' }}>
      <div style={{ background:'#6A1B9A', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>📐 {t('语法点','Grammar Patterns')}</div>
      </div>
      <div style={{ padding:'14px' }}>
        {byLevel.map(lv => (
          <div key={lv} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'#6A1B9A', fontWeight:600, marginBottom:8, letterSpacing:1 }}>
              {'★'.repeat(lv)}{'☆'.repeat(2-lv)} Level {lv}
            </div>
            {PATTERNS.filter(p => p.level === lv).map(p => (
              <button key={p.id} onClick={() => setSelected(p.id)}
                style={{ width:'100%', background:'#fff', border:'1.5px solid #CE93D8',
                  borderRadius:12, padding:'12px 14px', marginBottom:8, cursor:'pointer',
                  textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#6A1B9A',
                    fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>{p.pattern}</div>
                  <div style={{ fontSize:11, color:'#a07850', marginTop:2 }}>
                    {lang === 'zh' ? p.rule_zh.slice(0, 28) + '…' : p.pattern_en}
                  </div>
                </div>
                <span style={{ fontSize:10, background:'#F3E5F5', color:'#6A1B9A',
                  padding:'2px 8px', borderRadius:8 }}>HSK{p.hsk}</span>
                <span style={{ color:'#CE93D8', fontSize:18 }}>›</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-screen: Fill-in-blank Quiz ────────────────────────────────────────────
function GrammarQuiz({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en) => lang === 'zh' ? zh : en;

  const allQuiz = PATTERNS.flatMap(p => p.quiz.map(q => ({ ...q, pattern:p.pattern, patternId:p.id })));
  const [items]   = useState(() => [...allQuiz].sort(() => Math.random() - 0.5));
  const [idx,      setIdx]     = useState(0);
  const [chosen,   setChosen]  = useState(null);
  const [score,    setScore]   = useState({ correct:0, total:0 });
  const [done,     setDone]    = useState(false);

  const item = items[idx];

  function choose(opt) {
    if (chosen) return;
    setChosen(opt);
    const ok = opt === item.answer;
    setScore(s => ({ correct:s.correct+(ok?1:0), total:s.total+1 }));
    if (ok) {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) supabase.from('jgw_points').insert({
        device_token:token, module:'grammar', action:'grammar_quiz_right', points:5
      }).then(()=>{});
    }
  }

  function next() {
    if (idx >= items.length - 1) { setDone(true); return; }
    setIdx(i => i+1);
    setChosen(null);
  }

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#F3E5F5', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:20, gap:16 }}>
      <div style={{ fontSize:60 }}>{score.correct/score.total >= 0.8 ? '🏆' : score.correct/score.total >= 0.6 ? '👍' : '💪'}</div>
      <div style={{ fontSize:28, fontWeight:700, color:'#6A1B9A' }}>{score.correct} / {score.total}</div>
      <div style={{ fontSize:14, color:'#4A148C' }}>
        {score.correct/score.total >= 0.8 ? t('语法掌握很好！','Grammar mastery is great!') :
         score.correct/score.total >= 0.6 ? t('继续练习！','Keep practicing!') :
         t('多看看语法点吧','Review the patterns!')}
      </div>
      <button onClick={onBack} style={{ padding:'12px 28px', borderRadius:12, border:'none',
        background:'#6A1B9A', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
        {t('返回','Back')}
      </button>
    </div>
  );

  const parts = item.sentence.split('＿');
  return (
    <div style={{ minHeight:'100dvh', background:'#F3E5F5', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#6A1B9A', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>✅ {t('填空练习','Fill in the Blank')}</div>
        <div style={{ marginLeft:'auto', fontSize:12, color:'#E1BEE7' }}>{idx+1}/{items.length} · ⭐{score.correct}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'20px 16px', gap:20 }}>

        <div style={{ fontSize:11, color:'#6A1B9A', background:'#fff', padding:'4px 12px',
          borderRadius:10, fontWeight:600 }}>{item.pattern}</div>

        {/* Sentence with blank */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px 24px', width:'100%',
          maxWidth:340, textAlign:'center', border:'2px solid #CE93D8',
          boxShadow:'0 4px 16px #6A1B9A22' }}>
          <div style={{ fontSize:22, lineHeight:1.8, color:'#1a0a05',
            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>
            {parts[0]}
            <span style={{ display:'inline-block', minWidth:36, borderBottom:'2px solid #6A1B9A',
              color: chosen ? (chosen===item.answer?'#2E7D32':'#C62828') : '#6A1B9A',
              fontWeight:700, textAlign:'center', margin:'0 4px' }}>
              {chosen || '＿'}
            </span>
            {parts[1]}
          </div>
        </div>

        {/* Options */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:340 }}>
          {item.options.map(opt => {
            const isCorrect = opt === item.answer;
            const isChosen  = opt === chosen;
            const bg = !chosen ? '#fff'
              : isChosen && isCorrect ? '#E8F5E9'
              : isChosen ? '#FFEBEE'
              : isCorrect && chosen ? '#E8F5E9'
              : '#fff';
            const border = !chosen ? '#CE93D8'
              : isCorrect && chosen ? '#2E7D32'
              : isChosen ? '#C62828'
              : '#E1BEE7';
            return (
              <button key={opt} onClick={() => choose(opt)}
                style={{ padding:'13px', borderRadius:12, cursor:chosen?'default':'pointer',
                  border:`2px solid ${border}`, background:bg, fontSize:18,
                  fontFamily:"'STKaiti','KaiTi',serif", fontWeight:600,
                  color: !chosen ? '#6A1B9A' : isCorrect && chosen ? '#2E7D32' : isChosen ? '#C62828' : '#9E9E9E',
                  transition:'all 0.15s' }}>
                {opt}
                {chosen && isCorrect && ' ✓'}
                {chosen && isChosen && !isCorrect && ' ✗'}
              </button>
            );
          })}
        </div>

        {chosen && (
          <button onClick={next}
            style={{ padding:'13px 32px', borderRadius:14, border:'none',
              background:'#6A1B9A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            {idx >= items.length-1 ? t('查看结果','See Results') : t('下一题','Next')} →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-screen: Sentence Builder ──────────────────────────────────────────────
function SentenceBuilder({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en) => lang === 'zh' ? zh : en;

  const SENTENCES = [
    { words:['我','把','书','放在','桌子上','了'], correct:'我把书放在桌子上了', hint:'把字句' },
    { words:['他','是','坐飞机','来','的'], correct:'他是坐飞机来的', hint:'是…的' },
    { words:['虽然','很难','但是','很有意思'], correct:'虽然很难但是很有意思', hint:'虽然…但是' },
    { words:['蛋糕','被','小狗','吃了'], correct:'蛋糕被小狗吃了', hint:'被字句' },
    { words:['今天','比','昨天','冷'], correct:'今天比昨天冷', hint:'比较句' },
    { words:['要是','下雨','就','不去了'], correct:'要是下雨就不去了', hint:'要是…就' },
  ];

  const [idx,     setIdx]    = useState(0);
  const [order,   setOrder]  = useState(() => [...SENTENCES[0].words].sort(() => Math.random()-0.5));
  const [chosen,  setChosen] = useState([]);
  const [result,  setResult] = useState(null);
  const [score,   setScore]  = useState(0);

  function pick(word, i) {
    if (result) return;
    setChosen(c => [...c, word]);
    setOrder(o => o.filter((_, j) => j !== i));
  }

  function unpick(word, i) {
    if (result) return;
    setOrder(o => [...o, word]);
    setChosen(c => c.filter((_, j) => j !== i));
  }

  function check() {
    const attempt = chosen.join('');
    const ok = attempt === SENTENCES[idx].correct;
    setResult(ok ? 'correct' : 'wrong');
    if (ok) {
      setScore(s => s+1);
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) supabase.from('jgw_points').insert({
        device_token:token, module:'grammar', action:'grammar_build_right', points:8
      }).then(()=>{});
    }
  }

  function nextQ() {
    const next = (idx+1) % SENTENCES.length;
    setIdx(next);
    setOrder([...SENTENCES[next].words].sort(() => Math.random()-0.5));
    setChosen([]);
    setResult(null);
  }

  const s = SENTENCES[idx];

  return (
    <div style={{ minHeight:'100dvh', background:'#F3E5F5', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#6A1B9A', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>🔀 {t('连词成句','Build Sentences')}</div>
        <div style={{ marginLeft:'auto', fontSize:12, color:'#E1BEE7' }}>⭐{score}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', padding:'20px 16px', gap:16 }}>

        <div style={{ fontSize:11, color:'#6A1B9A', background:'#fff', padding:'3px 12px',
          borderRadius:10, fontWeight:600 }}>💡 {s.hint}</div>

        {/* Drop zone */}
        <div style={{ width:'100%', maxWidth:360, minHeight:60,
          background: result==='correct' ? '#E8F5E9' : result==='wrong' ? '#FFEBEE' : '#fff',
          border:`2px dashed ${result==='correct'?'#2E7D32':result==='wrong'?'#C62828':'#CE93D8'}`,
          borderRadius:16, padding:'12px', display:'flex', flexWrap:'wrap',
          gap:8, justifyContent:'center', alignItems:'center',
          transition:'all 0.2s' }}>
          {chosen.length === 0
            ? <span style={{ color:'#CE93D8', fontSize:13 }}>{t('点击下方词语组句','Tap words below to build the sentence')}</span>
            : chosen.map((w, i) => (
              <button key={i} onClick={() => unpick(w, i)}
                style={{ padding:'6px 12px', borderRadius:10,
                  background:'#6A1B9A', color:'#fff', border:'none',
                  fontSize:16, cursor:'pointer', fontFamily:"'STKaiti','KaiTi',serif" }}>
                {w}
              </button>
            ))}
        </div>

        {result === 'wrong' && (
          <div style={{ fontSize:12, color:'#C62828', textAlign:'center' }}>
            {t('正确答案：','Correct: ')}<strong>{s.correct}</strong>
          </div>
        )}
        {result === 'correct' && (
          <div style={{ fontSize:14, color:'#2E7D32', fontWeight:600 }}>🎉 {t('正确！','Correct!')}</div>
        )}

        {/* Word bank */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center',
          width:'100%', maxWidth:360 }}>
          {order.map((w, i) => (
            <button key={i} onClick={() => pick(w, i)}
              style={{ padding:'8px 14px', borderRadius:12,
                background:'#fff', color:'#6A1B9A',
                border:'2px solid #CE93D8', cursor:'pointer',
                fontSize:16, fontFamily:"'STKaiti','KaiTi',serif", fontWeight:600 }}>
              {w}
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          {!result && chosen.length > 0 && (
            <button onClick={check}
              style={{ padding:'11px 28px', borderRadius:12, border:'none',
                background:'#6A1B9A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {t('检查','Check')} ✓
            </button>
          )}
          {result && (
            <button onClick={nextQ}
              style={{ padding:'11px 28px', borderRadius:12, border:'none',
                background:'#6A1B9A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {t('下一题','Next')} →
            </button>
          )}
          {!result && (
            <button onClick={() => { setChosen([]); setOrder([...s.words].sort(()=>Math.random()-0.5)); }}
              style={{ padding:'11px 20px', borderRadius:12,
                border:'1.5px solid #CE93D8', background:'#fff',
                color:'#6A1B9A', fontSize:13, cursor:'pointer' }}>
              ↺ {t('重置','Reset')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-screen: Grammar Cheatsheet ────────────────────────────────────────────
function GrammarSheet({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en) => lang === 'zh' ? zh : en;
  return (
    <div style={{ minHeight:'100dvh', background:'#F3E5F5' }}>
      <div style={{ background:'#6A1B9A', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>📋 {t('语法速查表','Grammar Cheatsheet')}</div>
      </div>
      <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:8 }}>
        {PATTERNS.map(p => (
          <div key={p.id} style={{ background:'#fff', borderRadius:12,
            border:'1px solid #E1BEE7', padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'#6A1B9A',
                fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:1 }}>{p.pattern}</span>
              <span style={{ fontSize:10, color:'#a07850', background:'#F3E5F5',
                padding:'1px 8px', borderRadius:8 }}>HSK{p.hsk}</span>
            </div>
            <div style={{ fontSize:12, color:'#4A148C', marginBottom:6, lineHeight:1.6 }}>
              {lang === 'zh' ? p.rule_zh : p.rule_en}
            </div>
            <div style={{ fontSize:13, color:'#6b4c2a', fontStyle:'italic',
              fontFamily:"'STKaiti','KaiTi',serif" }}>
              📌 {p.examples[0].zh}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main GrammarApp ───────────────────────────────────────────────────────────
export default function GrammarApp({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it||en : en;
  const [screen, setScreen] = useState('home');

  const modules = [
    {
      id:'patterns', icon:'📐',
      title:   t('语法点详解','Grammar Patterns','Schemi grammaticali'),
      desc:    t('把/被/是的/比较/过/着…配例句','Patterns with examples','Schemi con esempi'),
      color:   '#F3E5F5', accent:'#6A1B9A',
      onClick: () => setScreen('patterns'),
    },
    {
      id:'quiz', icon:'✅',
      title:   t('填空练习','Fill in the Blank','Completa'),
      desc:    t('选出正确的语法词','Choose the correct grammar word','Scegli la parola'),
      color:   '#EDE7F6', accent:'#4527A0',
      onClick: () => setScreen('quiz'),
    },
    {
      id:'build', icon:'🔀',
      title:   t('连词成句','Build Sentences','Costruisci frasi'),
      desc:    t('拖动词语排列正确顺序','Arrange words into correct order','Ordina le parole'),
      color:   '#E8EAF6', accent:'#283593',
      onClick: () => setScreen('build'),
    },
    {
      id:'sheet', icon:'📋',
      title:   t('语法速查表','Grammar Cheatsheet','Riepilogo'),
      desc:    t('所有语法点一览','All patterns at a glance','Tutti gli schemi'),
      color:   '#FCE4EC', accent:'#880E4F',
      onClick: () => setScreen('sheet'),
    },
  ];

  if (screen === 'patterns') return <PatternExplorer onBack={() => setScreen('home')}/>;
  if (screen === 'quiz')     return <GrammarQuiz     onBack={() => setScreen('home')}/>;
  if (screen === 'build')    return <SentenceBuilder  onBack={() => setScreen('home')}/>;
  if (screen === 'sheet')    return <GrammarSheet     onBack={() => setScreen('home')}/>;

  return (
    <ModuleTemplate
      color="#6A1B9A"
      icon="📐"
      title={t('语法','Grammar','Grammatica')}
      subtitle={t('语法规则 · 例句 · 练习','Grammar rules · examples · practice','Regole · esempi · pratica')}
      onBack={onBack}
      backLabel={t('‹ 返回主页','‹ Back','‹ Indietro')}
      stats={[
        { value:PATTERNS.length,                          label:t('个语法点','patterns','schemi') },
        { value:PATTERNS.filter(p=>p.level===1).length,   label:t('初级','Basic','Base') },
        { value:PATTERNS.filter(p=>p.level===2).length,   label:t('进阶','Advanced','Avanzato') },
      ]}
      modules={modules}
      lang={lang}
      extra={
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <AdaptiveCard module="grammar" lang={lang}/>
          <div style={{ background:'#F3E5F5', borderRadius:14, padding:'12px 14px',
            border:'1px solid #CE93D8', fontSize:12, color:'#4A148C',
            display:'flex', gap:8, alignItems:'flex-start' }}>
            <span>💡</span>
            <span>{t(
              '建议：先阅读语法点，再做填空，最后挑战连词成句',
              'Tip: Read patterns first, then fill-blank, then try sentence building',
              'Consiglio: leggi prima gli schemi, poi completa, poi costruisci frasi'
            )}</span>
          </div>
        </div>
      }
    />
  );
}
