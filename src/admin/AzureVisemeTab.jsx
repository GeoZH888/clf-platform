// src/admin/AzureVisemeTab.jsx
// Add this as a new tab inside PinyinAdminTab.jsx
// Shows Azure TTS connection status + live viseme mouth test panel

import { useState, useRef, useEffect } from 'react';

// ── Viseme shape data (same as useAzureViseme.js) ─────────────────────────────
const SHAPES = {
   0:{lg:0, ty:10,tx:50,tc:5,  label:'静止 rest'},
   1:{lg:3, ty:5, tx:50,tc:0,  label:'开口 æ ə'},
   2:{lg:0, ty:10,tx:50,tc:0,  label:'双唇 b p m'},
   3:{lg:2, ty:62,tx:82,tc:40, label:'舌尖 t d n l'},
   4:{lg:2, ty:70,tx:60,tc:65, label:'卷舌 zh ch sh'},
   5:{lg:1, ty:70,tx:68,tc:50, label:'舌面 j q x'},
   6:{lg:1, ty:10,tx:50,tc:0,  label:'唇齿 f'},
   7:{lg:2, ty:60,tx:84,tc:36, label:'齿擦 s z'},
   9:{lg:2, ty:68,tx:18,tc:60, label:'舌根 g k h'},
  10:{lg:1, ty:72,tx:78,tc:52, label:'腭近 y'},
  11:{lg:1, ty:68,tx:15,tc:58, label:'圆唇 u w'},
  12:{lg:1, ty:35,tx:40,tc:15, label:'轻声 ə'},
  13:{lg:2, ty:35,tx:22,tc:28, label:'o 韵母'},
  15:{lg:1, ty:72,tx:78,tc:50, label:'前元音 i e'},
  16:{lg:3, ty:8, tx:55,tc:0,  label:'大开口 a'},
};
for(let i=0;i<22;i++) if(!SHAPES[i]) SHAPES[i]=SHAPES[0];

// ── Pure-phoneme TTS map ──────────────────────────────────────────────────────
const PHONEME_CHAR = {
  b:'波',p:'坡',m:'摸',f:'佛',d:'得',t:'特',n:'讷',l:'勒',
  g:'哥',k:'科',h:'喝',j:'鸡',q:'期',x:'希',
  zh:'知',ch:'吃',sh:'师',r:'日',z:'资',c:'次',s:'思',
  y:'一',w:'五',
  a:'啊',o:'哦',e:'鹅',i:'一',u:'乌',ü:'鱼',
};

// ── Token cache ───────────────────────────────────────────────────────────────
let _tok=null, _tokTime=0;
async function getToken() {
  if(_tok && Date.now()-_tokTime < 9*60*1000) return _tok;
  const r = await fetch('/.netlify/functions/azure-speech-token');
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  _tok = await r.json();
  _tokTime = Date.now();
  return _tok;
}

// ── Tiny side-profile SVG (inline, no external dep) ──────────────────────────
function MouthMini({ shape, speaking, color='#1E88E5', size=180 }) {
  const W=size, H=size*0.88;
  const cx=W*0.52, cy=H*0.5, hr=W*0.38, vr=H*0.44;
  const gapPx = shape.lg*(W/55);
  const lipMidX=cx+hr*0.52, lipY=cy+H*0.04;
  const ulY=lipY-gapPx, llY=lipY+gapPx;
  const tbX=cx-hr*0.5, tbY=cy+H*0.22;
  const ttX=tbX+(shape.tx/100)*hr*1.1;
  const ttY=tbY-(shape.ty/100)*H*0.32;
  const tcY=ttY+(shape.tc/100)*H*0.1;
  const hpY=cy-H*0.08;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{display:'block'}}>
      <defs>
        <radialGradient id="as-sk"><stop offset="0%" stopColor="#FDECD6"/><stop offset="100%" stopColor="#F5C89B"/></radialGradient>
        <radialGradient id="as-mi"><stop offset="0%" stopColor="#E8939A"/><stop offset="100%" stopColor="#C0454E"/></radialGradient>
        <linearGradient id="as-tg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#F06292"/><stop offset="100%" stopColor="#E91E63"/></linearGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={hr} ry={vr} fill="url(#as-sk)" stroke="#EAAA70" strokeWidth="1.5"/>
      {shape.lg>0.2&&<path d={`M${cx-hr*.3} ${cy-H*.04} Q${cx+hr*.1} ${cy+H*.05} ${lipMidX} ${lipY} Q${cx+hr*.1} ${cy+H*.12} ${cx-hr*.32} ${cy+H*.14}Z`} fill="url(#as-mi)" opacity={Math.min(.8,shape.lg*.2)}/>}
      <path d={`M${cx-hr*.28} ${hpY} Q${cx+hr*.1} ${hpY-H*.04} ${cx+hr*.42} ${cy-H*.05}`} fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={`M${tbX-W*.06} ${tbY+H*.04} Q${tbX} ${tbY} ${(tbX+ttX)/2} ${tcY} Q${ttX-W*.02} ${ttY-H*.01} ${ttX} ${ttY} Q${ttX-W*.01} ${ttY+H*.05} ${ttX} ${ttY+H*.1} Q${(tbX+ttX)/2} ${tbY+H*.08} ${tbX-W*.06} ${tbY+H*.09}Z`} fill="url(#as-tg)" stroke="#C2185B" strokeWidth=".8" opacity=".92"/>
      <path d={`M${cx+hr*.2} ${ulY-H*.04} Q${lipMidX-W*.05} ${ulY-H*.01} ${lipMidX} ${ulY}`} fill="none" stroke="#E57373" strokeWidth={W*.022} strokeLinecap="round"/>
      <path d={`M${cx+hr*.22} ${llY+H*.04} Q${lipMidX-W*.05} ${llY+H*.01} ${lipMidX} ${llY}`} fill="none" stroke="#C62828" strokeWidth={W*.022} strokeLinecap="round"/>
      <path d={`M${cx+hr*.3} ${cy-vr*.15} Q${cx+hr*.48} ${cy-vr*.2} ${cx+hr*.5} ${cy-vr*.08} Q${cx+hr*.44} ${cy-vr*.04} ${cx+hr*.38} ${cy-vr*.05}`} fill="#F5C89B" stroke="#EAAA70" strokeWidth="1"/>
      <circle cx={W*.88} cy={H*.1} r={W*.03} fill={color} opacity={speaking?1:.4}/>
      {speaking&&<circle cx={W*.88} cy={H*.1} r={W*.03} fill="none" stroke={color} strokeWidth="2" opacity=".5"><animate attributeName="r" values={`${W*.03};${W*.05};${W*.03}`} dur="1s" repeatCount="indefinite"/></circle>}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AzureVisemeTab() {
  const [status, setStatus]     = useState('idle'); // idle|testing|ok|error
  const [errMsg, setErrMsg]     = useState('');
  const [region, setRegion]     = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [visemeId, setVisemeId] = useState(0);
  const [visLog, setVisLog]     = useState([]);
  const [activeSound, setActiveSound] = useState(null);
  const [shape, setShape]       = useState({...SHAPES[0]});
  const synthRef  = useRef(null);
  const rafRef    = useRef(null);
  const curRef    = useRef({...SHAPES[0]});
  const targetRef = useRef({...SHAPES[0]});

  // Smooth interpolation loop
  useEffect(() => {
    function tick() {
      const c=curRef.current, t=targetRef.current, s=speaking?0.3:0.12;
      const n={
        lg: c.lg+(t.lg-c.lg)*s,
        ty: c.ty+(t.ty-c.ty)*s,
        tx: c.tx+(t.tx-c.tx)*s,
        tc: c.tc+(t.tc-c.tc)*s,
      };
      curRef.current=n;
      setShape({...n});
      rafRef.current=requestAnimationFrame(tick);
    }
    rafRef.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[speaking]);

  function setTarget(id) {
    const s=SHAPES[id]??SHAPES[0];
    targetRef.current={lg:s.lg,ty:s.ty,tx:s.tx,tc:s.tc};
    setVisemeId(id);
  }

  // ── Test Azure connection ──────────────────────────────────────────────────
  async function testConnection() {
    setStatus('testing'); setErrMsg('');
    try {
      const d = await getToken();
      setRegion(d.region||'');
      setStatus('ok');
    } catch(e) {
      setStatus('error');
      setErrMsg(e.message.includes('404')
        ? 'netlify/functions/azure-speech-token 未找到 — 请先部署该函数'
        : e.message.includes('500')
        ? 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION 环境变量未设置'
        : e.message);
    }
  }

  // ── Speak with Azure TTS ──────────────────────────────────────────────────
  async function speakAzure(py) {
    if(synthRef.current) { synthRef.current.close(); synthRef.current=null; }
    setSpeaking(false); setTarget(0); setVisLog([]);
    setActiveSound(py);

    let SDK;
    try { SDK = await import('microsoft-cognitiveservices-speech-sdk'); }
    catch { setErrMsg('请先安装: npm install microsoft-cognitiveservices-speech-sdk'); return; }

    let tok;
    try { tok = await getToken(); }
    catch(e) { setErrMsg(e.message); return; }

    const cfg = SDK.SpeechConfig.fromAuthorizationToken(tok.token, tok.region);
    cfg.speechSynthesisVoiceName = 'zh-CN-XiaoxiaoNeural';

    const synth = new SDK.SpeechSynthesizer(cfg, null);
    synthRef.current = synth;

    const log=[];
    synth.visemeReceived=(_,e)=>{
      const id=e.visemeId;
      setTarget(id);
      log.push(id);
      setVisLog([...log].slice(-12)); // show last 12
    };
    synth.synthesisStarted=()=>setSpeaking(true);
    synth.synthesisCompleted=()=>{ setSpeaking(false); setTarget(0); };
    synth.synthesisCanceled=()=>{ setSpeaking(false); setTarget(0); };

    const char = PHONEME_CHAR[py]||py;
    const ssml=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="zh-CN-XiaoxiaoNeural"><prosody rate="0.8">${char}</prosody></voice></speak>`;
    synth.speakSsmlAsync(ssml,()=>{},e=>{ setErrMsg(String(e)); setSpeaking(false); });
  }

  const V={
    bg:'#FFF8EE', border:'#E8D5B0', verm:'#8B4513',
    text:'#3d2b1f', text2:'#7a5c44', text3:'#a08060',
    green:'#2E7D32', red:'#C62828', blue:'#1565C0',
  };

  const allSounds=[
    {group:'声母',color:'#8B4513',items:['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s']},
    {group:'韵母',color:'#1565C0',items:['a','o','e','i','u','ü']},
  ];

  return (
    <div style={{padding:'0 2px'}}>

      {/* ── Section 1: Connection status ── */}
      <div style={{background:'#F3E5F5',border:'2px solid #CE93D8',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <span style={{fontSize:16}}>🔷</span>
          <span style={{fontWeight:600,color:'#4A148C',fontSize:14}}>Azure Neural TTS 连接状态</span>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <button onClick={testConnection} disabled={status==='testing'}
            style={{padding:'8px 18px',borderRadius:8,border:'none',
              background:status==='testing'?'#E0E0E0':'#7B1FA2',
              color:status==='testing'?'#aaa':'#fff',
              fontWeight:600,fontSize:13,cursor:status==='testing'?'default':'pointer'}}>
            {status==='testing'?'测试中…':'🔌 测试连接'}
          </button>

          {status==='ok'&&(
            <div style={{display:'flex',alignItems:'center',gap:6,
              background:'#E8F5E9',border:'1px solid #A5D6A7',
              borderRadius:8,padding:'6px 12px',fontSize:13}}>
              <span style={{color:V.green,fontWeight:700}}>✓</span>
              <span style={{color:'#1B5E20'}}>连接成功 · region: <b>{region}</b></span>
            </div>
          )}
          {status==='error'&&(
            <div style={{background:'#FFEBEE',border:'1px solid #FFCDD2',
              borderRadius:8,padding:'6px 12px',fontSize:12,color:'#B71C1C',flex:1}}>
              ✗ {errMsg}
            </div>
          )}
        </div>

        {status!=='ok'&&(
          <div style={{marginTop:10,fontSize:12,color:'#7B1FA2',lineHeight:1.7}}>
            需要先设置 Netlify 环境变量：
            <code style={{display:'block',marginTop:4,padding:'4px 8px',
              background:'#EDE7F6',borderRadius:6,fontSize:11}}>
              AZURE_SPEECH_KEY = (your key)<br/>
              AZURE_SPEECH_REGION = eastasia
            </code>
          </div>
        )}
      </div>

      {/* ── Section 2: Live viseme preview ── */}
      <div style={{background:V.bg,border:`1px solid ${V.border}`,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
        <div style={{fontWeight:600,color:V.verm,fontSize:14,marginBottom:12}}>
          👄 实时口型预览 — 点击任意声母/韵母
        </div>

        <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-start'}}>
          {/* Mouth SVG */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,
            background:'#fff',borderRadius:12,padding:'12px',
            border:`1.5px solid ${speaking?'#1E88E5':V.border}`,
            boxShadow:speaking?'0 0 0 3px #1E88E522':'none',
            transition:'all 0.2s',minWidth:200}}>
            <MouthMini shape={shape} speaking={speaking} color='#1E88E5' size={180}/>
            <div style={{fontSize:12,color:V.text2,textAlign:'center',minHeight:18}}>
              {speaking
                ? <span style={{color:'#1565C0',fontWeight:600}}>▶ {SHAPES[visemeId]?.label}</span>
                : activeSound
                  ? <span style={{color:V.text3}}>点击重播 · 或选其他</span>
                  : <span style={{color:V.text3}}>选择声母或韵母</span>}
            </div>
            {/* Viseme ID stream */}
            {visLog.length>0&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:3,justifyContent:'center',maxWidth:180}}>
                {visLog.map((id,i)=>(
                  <span key={i} style={{
                    padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:600,
                    background:i===visLog.length-1?'#1E88E5':'#E3F2FD',
                    color:i===visLog.length-1?'#fff':'#1565C0',
                  }}>{id}</span>
                ))}
              </div>
            )}
          </div>

          {/* Sound buttons */}
          <div style={{flex:1,minWidth:200}}>
            {allSounds.map(g=>(
              <div key={g.group} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:g.color,fontWeight:600,marginBottom:6,letterSpacing:0.5}}>
                  {g.group}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {g.items.map(py=>(
                    <button key={py} onClick={()=>speakAzure(py)}
                      disabled={speaking}
                      style={{
                        padding:'6px 10px',borderRadius:8,
                        border:`1.5px solid ${activeSound===py?g.color:'#E0D0B8'}`,
                        background:activeSound===py?g.color+'18':'#fff',
                        color:activeSound===py?g.color:V.text2,
                        fontWeight:activeSound===py?700:400,
                        fontSize:15,cursor:speaking?'default':'pointer',
                        opacity:speaking&&activeSound!==py?0.5:1,
                        transition:'all 0.15s',minWidth:38,textAlign:'center',
                      }}>
                      {py}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {errMsg&&(
          <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,
            background:'#FFF3E0',border:'1px solid #FFCC80',
            fontSize:12,color:'#E65100'}}>
            ⚠️ {errMsg}
          </div>
        )}
      </div>

      {/* ── Section 3: How it works ── */}
      <div style={{background:'#E8F5E9',border:'1px solid #A5D6A7',borderRadius:12,padding:'14px 16px'}}>
        <div style={{fontWeight:600,color:V.green,fontSize:13,marginBottom:8}}>
          ✅ Azure Viseme 工作原理
        </div>
        <div style={{fontSize:12,color:'#1B5E20',lineHeight:1.8}}>
          1. 点击声母/韵母 → 发送教学字符到 Azure TTS（b→波、f→佛、zh→知…）<br/>
          2. Azure 分析音素序列 → 每隔 ~30ms 发送 viseme ID（0–21）<br/>
          3. ID 映射到舌位/唇形参数 → 口腔SVG实时变形，与音频同步<br/>
          4. 学生端自动嵌入 PinyinTable → 点击声母卡片即触发动画
        </div>
        <div style={{marginTop:10,padding:'8px 10px',background:'#C8E6C9',
          borderRadius:8,fontSize:11,color:'#2E7D32'}}>
          📦 前提：已安装 SDK →
          <code style={{marginLeft:6,fontFamily:'monospace'}}>
            npm install microsoft-cognitiveservices-speech-sdk
          </code>
        </div>
      </div>
    </div>
  );
}
