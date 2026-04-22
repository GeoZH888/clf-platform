// src/pinyin/ArticulationAnim.jsx
// Animated cross-section articulation diagram with synchronized audio
import { useEffect, useRef } from 'react';

// Tone-marked teaching syllables for isolated pronunciation.
// Follows standard pinyin pedagogy: each initial is taught with its
// canonical demonstration vowel. Sent to Azure TTS as SSML.
const TEACHING_SYLLABLE = {
  // Labials (+ -o)
  b:'bō',  p:'pō',  m:'mō',  f:'fó',
  // Alveolars (+ -e) — teaching convention, not -a
  d:'dē',  t:'tē',  n:'nē',  l:'lē',
  // Velars (+ -e)
  g:'gē',  k:'kē',  h:'hē',
  // Palatals (+ -i)
  j:'jī',  q:'qī',  x:'xī',
  // Retroflex (+ -i)
  zh:'zhī', ch:'chī', sh:'shī', r:'rī',
  // Dental sibilants (+ -i)
  z:'zī',  c:'cī',  s:'sī',
  // Finals — read in full
  a:'ā',   o:'ō',   e:'ē',   i:'yī',  u:'wū',  ü:'yū',
  ai:'āi', ei:'ēi', ao:'āo', ou:'ōu',
  an:'ān', en:'ēn', in:'yīn', un:'wēn', ün:'yūn',
  ang:'āng', eng:'ēng', ing:'yīng', ong:'wēng',
  ie:'yē', üe:'yuē', er:'ér', ui:'wēi', iu:'yōu',
};

// Fallback Chinese chars for Web Speech (used when Azure unavailable)
const FALLBACK = {
  b:'波',p:'坡',m:'摸',f:'佛',d:'的',t:'特',n:'呢',l:'了',
  g:'哥',k:'可',h:'喝',j:'鸡',q:'七',x:'西',
  zh:'知',ch:'吃',sh:'师',r:'日',z:'资',c:'雌',s:'思',
  a:'啊',o:'哦',e:'呃',i:'衣',u:'屋',ü:'鱼',
  ai:'爱',ei:'诶',ao:'凹',ou:'欧',
  an:'安',en:'恩',in:'因',un:'温',ün:'晕',
  ang:'昂',eng:'鹰',ing:'英',ong:'翁',
  ie:'耶',üe:'约',er:'儿',ui:'威',iu:'优',
};

// In-memory cache for Azure TTS blob URLs — avoids refetching within a session.
// Keyed by sound symbol ("b", "zh", "an", …).
const audioCache = new Map();

// Per-sound articulation parameters
const ANIM_PARAMS = {
  // Initials
  b:  {jaw:0,   lipsClose:true,  lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:155,aspirated:false,nasal:false,friction:false},
  p:  {jaw:0,   lipsClose:true,  lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:155,aspirated:true, nasal:false,friction:false},
  m:  {jaw:0,   lipsClose:true,  lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:155,aspirated:false,nasal:true, friction:false},
  f:  {jaw:0.15,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:155,aspirated:false,nasal:false,friction:true, teethLip:true},
  d:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:148,aspirated:false,nasal:false,friction:false},
  t:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:148,aspirated:true, nasal:false,friction:false},
  n:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:148,aspirated:false,nasal:true, friction:false},
  l:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:148,aspirated:false,nasal:false,friction:false,lateral:true},
  g:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:130,aspirated:false,nasal:false,friction:false},
  k:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:130,aspirated:true, nasal:false,friction:false},
  h:  {jaw:0.35,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:133,aspirated:false,nasal:false,friction:true},
  j:  {jaw:0.25,lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:120,aspirated:false,nasal:false,friction:false},
  q:  {jaw:0.25,lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:120,aspirated:true, nasal:false,friction:false},
  x:  {jaw:0.3, lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:122,aspirated:false,nasal:false,friction:true},
  zh: {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:true, velar:false,palatal:false,alveolar:false,dental:false,bodyH:150,aspirated:false,nasal:false,friction:false},
  ch: {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:true, velar:false,palatal:false,alveolar:false,dental:false,bodyH:150,aspirated:true, nasal:false,friction:false},
  sh: {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:true, velar:false,palatal:false,alveolar:false,dental:false,bodyH:150,aspirated:false,nasal:false,friction:true},
  r:  {jaw:0.3, lipsClose:false, lipsOpen:'neutral',retrof:true, velar:false,palatal:false,alveolar:false,dental:false,bodyH:150,aspirated:false,nasal:false,friction:true},
  z:  {jaw:0.25,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:true, bodyH:150,aspirated:false,nasal:false,friction:true},
  c:  {jaw:0.25,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:true, bodyH:150,aspirated:true, nasal:false,friction:false},
  s:  {jaw:0.25,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:false,dental:true, bodyH:150,aspirated:false,nasal:false,friction:true},
  // Finals
  a:  {jaw:0.9, lipsClose:false, lipsOpen:'wide',   retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:170},
  o:  {jaw:0.5, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:140},
  e:  {jaw:0.45,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:138},
  i:  {jaw:0.2, lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:115},
  u:  {jaw:0.2, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:130},
  ü:  {jaw:0.2, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:115},
  an: {jaw:0.75,lipsClose:false, lipsOpen:'wide',   retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:160,nasal:true},
  en: {jaw:0.35,lipsClose:false, lipsOpen:'neutral',retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:148,nasal:true},
  in: {jaw:0.2, lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:115,nasal:true},
  un: {jaw:0.3, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:true, dental:false,bodyH:130,nasal:true},
  ün: {jaw:0.2, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:true, alveolar:true, dental:false,bodyH:115,nasal:true},
  ang:{jaw:0.85,lipsClose:false, lipsOpen:'wide',   retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:165,nasalVelar:true},
  eng:{jaw:0.4, lipsClose:false, lipsOpen:'neutral',retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:140,nasalVelar:true},
  ing:{jaw:0.25,lipsClose:false, lipsOpen:'spread', retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:115,nasalVelar:true},
  ong:{jaw:0.45,lipsClose:false, lipsOpen:'round',  retrof:false,velar:true, palatal:false,alveolar:false,dental:false,bodyH:133,nasalVelar:true},
  ie: {jaw:0.5, lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:125},
  üe: {jaw:0.45,lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:true, alveolar:false,dental:false,bodyH:120},
  er: {jaw:0.4, lipsClose:false, lipsOpen:'neutral',retrof:true, velar:false,palatal:false,alveolar:false,dental:false,bodyH:148},
  ai: {jaw:0.85,lipsClose:false, lipsOpen:'wide',   retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:165},
  ei: {jaw:0.5, lipsClose:false, lipsOpen:'spread', retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:138},
  ao: {jaw:0.8, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:160},
  ou: {jaw:0.5, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:138},
  ui: {jaw:0.3, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:130},
  iu: {jaw:0.3, lipsClose:false, lipsOpen:'round',  retrof:false,velar:false,palatal:false,alveolar:false,dental:false,bodyH:135},
};

function lerp(a,b,t){ return a+(b-a)*t; }

export default function ArticulationAnim({ sound, color='#1565C0', artDiagrams={}, autoPlay=true }) {
  const svgRef  = useRef(null);
  const animRef = useRef(null);
  const progRef = useRef(0);
  const dirRef  = useRef(1);
  const audioRef= useRef(null);

  // If AI diagram exists, show it with a play-audio button
  const artKey = `art_${sound.replace('/','_')}`;
  const artUrl = artDiagrams[artKey];

  useEffect(() => {
    if (autoPlay) triggerAnim();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [sound]);

  function triggerAnim() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    progRef.current = 0;
    dirRef.current  = 1;
    playSound();
    tick();
  }

  async function playSound() {
    const text = TEACHING_SYLLABLE[sound];
    if (!text) { playWebSpeechFallback(); return; }

    // Tier 1 — in-memory cache (session-local)
    const cached = audioCache.get(sound);
    if (cached) { playUrl(cached); return; }

    // Tier 2 — Azure TTS
    try {
      const tokenRes = await fetch('/.netlify/functions/azure-speech-token');
      if (!tokenRes.ok) throw new Error('azure-token-unavailable');
      const { token, region } = await tokenRes.json();

      // Using XiaohanNeural: better prosodic control for isolated syllables
      // than XiaoxiaoNeural. Rate x-slow so learners hear each segment.
      const ssml = `<speak version='1.0' xml:lang='zh-CN'>
        <voice name='zh-CN-XiaohanNeural'>
          <prosody rate='x-slow' pitch='default'>${text}</prosody>
        </voice>
      </speak>`;

      const ttsRes = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          },
          body: ssml,
        },
      );
      if (!ttsRes.ok) throw new Error('azure-tts-failed');

      const blob = await ttsRes.blob();
      const url  = URL.createObjectURL(blob);
      audioCache.set(sound, url);
      playUrl(url);
    } catch (err) {
      // Tier 3 — Web Speech API using FALLBACK Chinese characters
      playWebSpeechFallback();
    }
  }

  function playUrl(url) {
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.playbackRate = 0.85;  // slight slow-down for clarity
    audioRef.current.play().catch(() => playWebSpeechFallback());
  }

  function playWebSpeechFallback() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(FALLBACK[sound] || sound);
    u.lang = 'zh-CN';
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }

  function tick() {
    progRef.current += dirRef.current * 0.04;
    if (progRef.current >= 1) { progRef.current = 1; dirRef.current = 0; }
    applyFrame(progRef.current);
    if (dirRef.current !== 0) {
      animRef.current = requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        dirRef.current = -1;
        const retreat = () => {
          progRef.current += dirRef.current * 0.025;
          if (progRef.current <= 0.05) { progRef.current = 0.05; return; }
          applyFrame(progRef.current);
          animRef.current = requestAnimationFrame(retreat);
        };
        animRef.current = requestAnimationFrame(retreat);
      }, 1400);
    }
  }

  function applyFrame(p) {
    const svg = svgRef.current;
    if (!svg) return;
    const s = ANIM_PARAMS[sound] || {};
    const jaw = s.jaw || 0;
    const jawPx = lerp(0, jaw * 30, p);

    const jawG = svg.querySelector('#jaw-group');
    if (jawG) jawG.setAttribute('transform', `translate(0,${jawPx})`);

    const lips = svg.querySelector('#lip-fill');
    const ul   = svg.querySelector('#upper-lip');
    const ll   = svg.querySelector('#lower-lip');
    const sh   = s.lipsOpen || 'neutral';

    if (s.lipsClose && p > 0.5) {
      if (lips) lips.setAttribute('d','M70,112 Q140,114 210,112 Q210,118 140,118 Q70,118 70,112Z');
      if (ul)   ul.setAttribute('d','M70,113 Q140,111 210,113');
      if (ll)   ll.setAttribute('d','M70,115 Q140,117 210,115');
    } else if (sh === 'round') {
      const rx=lerp(70,28,p), ry=lerp(9,16,p), cx=140, cy=121;
      if (lips) lips.setAttribute('d',`M${cx-rx},${cy} Q${cx},${cy-ry} ${cx+rx},${cy} Q${cx},${cy+ry} ${cx-rx},${cy}Z`);
      if (ul)   ul.setAttribute('d',`M${cx-rx},${cy} Q${cx},${cy-ry-3} ${cx+rx},${cy}`);
      if (ll)   ll.setAttribute('d',`M${cx-rx},${cy} Q${cx},${cy+ry} ${cx+rx},${cy}`);
    } else if (sh === 'spread' || sh === 'wide') {
      const w = sh==='wide' ? lerp(70,80,p) : lerp(70,84,p);
      if (lips) lips.setAttribute('d',`M${140-w},112 Q140,${lerp(106,102,p)} ${140+w},112 Q${140+w},${lerp(130,138,p)} 140,${lerp(134,140,p)} Q${140-w},${lerp(130,138,p)} ${140-w},112Z`);
      if (ul)   ul.setAttribute('d',`M${140-w},112 Q140,${lerp(106,101,p)} ${140+w},112`);
      if (ll)   ll.setAttribute('d',`M${140-w},${lerp(130,134,p)} Q140,${lerp(134,142,p)} ${140+w},${lerp(130,134,p)}`);
    } else {
      if (lips) lips.setAttribute('d','M70,112 Q100,106 120,112 Q140,118 160,112 Q180,106 210,112 Q210,130 175,132 Q140,134 105,132 Q70,130 70,112Z');
      if (ul)   ul.setAttribute('d','M70,112 Q100,106 120,112 Q140,118 160,112 Q180,106 210,112');
      if (ll)   ll.setAttribute('d','M70,130 Q105,136 140,134 Q175,132 210,130');
    }

    const bh = lerp(155, s.bodyH||155, p) + jawPx;
    const tEl  = svg.querySelector('#tongue');
    const tTip = svg.querySelector('#tongue-tip');

    if (s.retrof) {
      if (tEl)  tEl.setAttribute('d',`M${lerp(90,76,p)},${160+jawPx} Q110,${bh} 140,${bh-8} Q170,${bh-12} 195,${bh} Q200,${bh+10} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} ${lerp(90,76,p)},${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M${lerp(90,76,p)},${160+jawPx} Q${lerp(80,62,p)},${lerp(155,102,p)+jawPx*0.3} ${lerp(78,155,p)},${lerp(148,90,p)+jawPx*0.1} Q${lerp(84,165,p)},${lerp(142,82,p)} ${lerp(95,156,p)},${lerp(148,92,p)} Q97,${lerp(154,100,p)} ${lerp(90,76,p)},${160+jawPx}Z`);
    } else if (s.velar) {
      if (tEl)  tEl.setAttribute('d',`M90,${160+jawPx} Q110,${bh} 140,${lerp(140,112,p)+jawPx} Q170,${lerp(135,102,p)+jawPx} 195,${lerp(145,114,p)+jawPx} Q200,${lerp(155,122,p)+jawPx} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} 90,${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M90,${160+jawPx} Q80,${155+jawPx} 78,${148+jawPx} Q84,${142+jawPx} 95,${148+jawPx} Q97,${154+jawPx} 90,${160+jawPx}Z`);
    } else if (s.palatal) {
      if (tEl)  tEl.setAttribute('d',`M90,${160+jawPx} Q110,${bh} 140,${lerp(140,108,p)+jawPx} Q170,${lerp(135,106,p)+jawPx} 195,${lerp(145,122,p)+jawPx} Q200,${bh+5} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} 90,${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M90,${160+jawPx} Q80,${155+jawPx} 78,${148+jawPx} Q84,${142+jawPx} 95,${148+jawPx} Q97,${154+jawPx} 90,${160+jawPx}Z`);
    } else if (s.alveolar) {
      if (tEl)  tEl.setAttribute('d',`M90,${160+jawPx} Q110,${bh} 140,${bh-8} Q170,${bh-12} 195,${bh} Q200,${bh+10} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} 90,${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M90,${160+jawPx} Q80,${155+jawPx} ${lerp(78,100,p)},${lerp(148,107,p)+jawPx*0.2} Q${lerp(84,112,p)},${lerp(142,97,p)+jawPx*0.2} ${lerp(95,108,p)},${lerp(148,107,p)+jawPx*0.2} Q97,${lerp(154,156,p)+jawPx*0.3} 90,${160+jawPx}Z`);
    } else if (s.dental) {
      if (tEl)  tEl.setAttribute('d',`M90,${160+jawPx} Q110,${bh} 140,${bh-8} Q170,${bh-12} 195,${bh} Q200,${bh+10} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} 90,${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M90,${160+jawPx} Q80,${155+jawPx} ${lerp(78,96,p)},${lerp(148,147,p)+jawPx*0.2} Q${lerp(84,108,p)},${lerp(142,138,p)+jawPx*0.2} ${lerp(95,106,p)},${lerp(148,147,p)+jawPx*0.2} Q97,${lerp(154,155,p)+jawPx*0.3} 90,${160+jawPx}Z`);
    } else {
      if (tEl)  tEl.setAttribute('d',`M90,${160+jawPx} Q110,${bh} 140,${bh-8} Q170,${bh-12} 195,${bh} Q200,${bh+10} 190,${bh+18} Q170,${bh+24} 140,${bh+22} Q110,${bh+20} 90,${160+jawPx}Z`);
      if (tTip) tTip.setAttribute('d',`M90,${160+jawPx} Q80,${155+jawPx} 78,${148+jawPx} Q84,${142+jawPx} 95,${148+jawPx} Q97,${154+jawPx} 90,${160+jawPx}Z`);
    }

    const show = (id, v) => { const el=svg.querySelector('#'+id); if(el) el.setAttribute('opacity', v?'1':'0'); };
    show('g-airflow',  !s.aspirated&&!s.friction&&!s.nasal&&!s.nasalVelar&&p>0.65);
    show('g-aspirated', s.aspirated && p>0.65);
    show('g-friction',  s.friction  && p>0.65);
    show('g-nasal',    (s.nasal||s.nasalVelar) && p>0.65);
  }

  return (
    <div style={{ textAlign:'center' }}>
      {artUrl ? (
        <div>
          <img src={artUrl} alt={sound}
            style={{ width:'100%', maxWidth:200, objectFit:'contain', borderRadius:10 }}/>
          <div onTouchStart={triggerAnim} onClick={triggerAnim}
            style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6,
              padding:'6px 14px', borderRadius:20, cursor:'pointer',
              background:color+'18', border:`1px solid ${color}44`,
              color, fontSize:12, WebkitTapHighlightColor:'transparent' }}>
            🔊 {sound}
          </div>
        </div>
      ) : (
        <div>
          <svg ref={svgRef} viewBox="0 0 280 220"
            style={{ width:'100%', maxWidth:220, height:'auto', display:'block', margin:'0 auto' }}
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id={`arr-${sound}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#378ADD"/>
              </marker>
              <marker id={`arr-r-${sound}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#D85A30"/>
              </marker>
              <marker id={`arr-p-${sound}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7B4EA0"/>
              </marker>
            </defs>
            <ellipse cx="140" cy="110" rx="120" ry="100" fill="#FFF8F5" stroke="#e0d0c0" strokeWidth="0.5"/>
            <path d="M85,18 Q140,8 195,18 Q195,52 140,58 Q85,52 85,18Z" fill="#E8EEF8" opacity="0.5"/>
            <text x="140" y="38" textAnchor="middle" fontSize="8" fill="#5588CC" opacity="0.7">鼻腔</text>
            <path d="M72,68 Q140,56 208,68" fill="none" stroke="#D4B8A8" strokeWidth="3" strokeLinecap="round"/>
            <path d="M208,68 Q228,84 223,106 Q218,120 208,122" fill="none" stroke="#D4B8A8" strokeWidth="2.5"/>
            <path id="upper-teeth-fill" d="M88,99 L100,86 L112,99 L124,86 L136,99 L148,86 L160,99 L172,86 L184,99 L186,108 L86,108Z" fill="#F5F0E8"/>
            <g id="jaw-group">
              <path id="lower-jaw" d="M76,150 Q140,164 204,150 L204,180 Q140,194 76,180Z" fill="#FDEEE8"/>
              <path id="lower-teeth-fill" d="M88,147 L100,137 L112,147 L124,137 L136,147 L148,137 L160,147 L172,137 L184,147 L186,155 L86,155Z" fill="#F5F0E8"/>
              <path id="tongue" d="M90,160 Q110,145 140,140 Q170,135 195,145 Q200,155 190,165 Q170,172 140,170 Q110,168 90,160Z" fill="#E8888A"/>
              <path id="tongue-tip" d="M90,160 Q80,155 78,148 Q84,142 95,148 Q97,154 90,160Z" fill="#E8888A"/>
            </g>
            <path id="upper-lip" d="M70,112 Q100,106 120,112 Q140,118 160,112 Q180,106 210,112" fill="none" stroke="#D4887A" strokeWidth="2.5" strokeLinecap="round"/>
            <path id="lower-lip" d="M70,130 Q105,136 140,134 Q175,132 210,130" fill="none" stroke="#D4887A" strokeWidth="2.5" strokeLinecap="round"/>
            <path id="lip-fill" d="M70,112 Q100,106 120,112 Q140,118 160,112 Q180,106 210,112 Q210,130 175,132 Q140,134 105,132 Q70,130 70,112Z" fill="#E8A898" opacity="0.6"/>
            <g id="g-airflow" opacity="0">
              <line x1="48" y1="121" x2="76" y2="121" stroke="#378ADD" strokeWidth="1.5" markerEnd={`url(#arr-${sound})`}/>
            </g>
            <g id="g-aspirated" opacity="0">
              <line x1="30" y1="113" x2="73" y2="113" stroke="#378ADD" strokeWidth="2" markerEnd={`url(#arr-${sound})`}/>
              <line x1="30" y1="121" x2="73" y2="121" stroke="#378ADD" strokeWidth="2" markerEnd={`url(#arr-${sound})`}/>
              <line x1="30" y1="129" x2="73" y2="129" stroke="#378ADD" strokeWidth="2" markerEnd={`url(#arr-${sound})`}/>
              <text x="24" y="109" fontSize="8" fill="#378ADD" textAnchor="middle">送气</text>
            </g>
            <g id="g-friction" opacity="0">
              <line x1="50" y1="115" x2="73" y2="115" stroke="#D85A30" strokeWidth="1.2" markerEnd={`url(#arr-r-${sound})`}/>
              <line x1="50" y1="121" x2="73" y2="121" stroke="#D85A30" strokeWidth="1.2" markerEnd={`url(#arr-r-${sound})`}/>
              <line x1="50" y1="127" x2="73" y2="127" stroke="#D85A30" strokeWidth="1.2" markerEnd={`url(#arr-r-${sound})`}/>
            </g>
            <g id="g-nasal" opacity="0">
              {/* Nasal cavity highlight — purple tint + dashed outline */}
              <path d="M85,18 Q140,8 195,18 Q195,52 140,58 Q85,52 85,18Z"
                fill="#7B4EA0" fillOpacity="0.18"
                stroke="#7B4EA0" strokeWidth="1.2"
                strokeDasharray="3,2"/>

              {/* Three upward airflow arrows through nasal cavity with staggered pulse */}
              <line x1="115" y1="60" x2="115" y2="24"
                stroke="#7B4EA0" strokeWidth="1.8"
                markerEnd={`url(#arr-p-${sound})`}>
                <animate attributeName="opacity" values="0.35;1;0.35"
                  dur="1.2s" repeatCount="indefinite"/>
              </line>
              <line x1="140" y1="60" x2="140" y2="20"
                stroke="#7B4EA0" strokeWidth="2"
                markerEnd={`url(#arr-p-${sound})`}>
                <animate attributeName="opacity" values="0.35;1;0.35"
                  dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
              </line>
              <line x1="165" y1="60" x2="165" y2="24"
                stroke="#7B4EA0" strokeWidth="1.8"
                markerEnd={`url(#arr-p-${sound})`}>
                <animate attributeName="opacity" values="0.35;1;0.35"
                  dur="1.2s" begin="0.8s" repeatCount="indefinite"/>
              </line>

              {/* Exit flows out of nostrils */}
              <path d="M123,15 Q119,7 113,3" fill="none"
                stroke="#7B4EA0" strokeWidth="1.3" opacity="0.8"
                markerEnd={`url(#arr-p-${sound})`}/>
              <path d="M157,15 Q161,7 167,3" fill="none"
                stroke="#7B4EA0" strokeWidth="1.3" opacity="0.8"
                markerEnd={`url(#arr-p-${sound})`}/>

              {/* Mouth-blocked indicator (only shown for nasal stops m/n/ng:
                   oral airflow is blocked) */}
              <g id="g-oral-block" opacity="0.85">
                <circle cx="240" cy="121" r="10" fill="#D32F2F" opacity="0.12"/>
                <line x1="233" y1="114" x2="247" y2="128"
                  stroke="#D32F2F" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="247" y1="114" x2="233" y2="128"
                  stroke="#D32F2F" strokeWidth="2.5" strokeLinecap="round"/>
              </g>

              {/* Label — made more prominent */}
              <text x="140" y="14" fontSize="8" fill="#7B4EA0"
                textAnchor="middle" fontWeight="700" letterSpacing="0.5">
                鼻腔气流
              </text>
            </g>
          </svg>
          <div onTouchStart={triggerAnim} onClick={triggerAnim}
            style={{ marginTop:4, display:'inline-flex', alignItems:'center', gap:6,
              padding:'6px 14px', borderRadius:20, cursor:'pointer',
              background:color+'18', border:`1px solid ${color}44`,
              color, fontSize:12, WebkitTapHighlightColor:'transparent' }}>
            🔁 {sound}
          </div>
        </div>
      )}
    </div>
  );
}
