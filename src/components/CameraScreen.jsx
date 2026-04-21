/**
 * src/components/CameraScreen.jsx
 * 
 * Camera feature — two modes:
 * 1. Take a photo of a handwritten / printed Chinese character
 *    → Claude Vision identifies it → links to practice
 * 2. Scan a Chinese text from a sign/book
 *    → Show each character with meaning + link to practice
 */
import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { SETS } from '../data/characters.js';

const ALL_CHARS = SETS.flatMap(s => s.chars.map(c => ({ ...c, set: s })));

export default function CameraScreen({ onPractice }) {
  const { lang } = useLang();
  const [mode,     setMode]    = useState('idle'); // idle | camera | preview | result
  const [image,    setImage]   = useState(null);   // base64 data URL
  const [loading,  setLoading] = useState(false);
  const [results,  setResults] = useState([]);
  const [error,    setError]   = useState('');
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const fileRef    = useRef(null);

  // Stop camera when unmounting
  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width:{ ideal:1280 }, height:{ ideal:720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode('camera');
    } catch(e) {
      setError(lang==='zh'?'无法访问摄像头':lang==='it'?'Impossibile accedere alla fotocamera':'Camera not accessible');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setImage(dataUrl);
    stopCamera();
    setMode('preview');
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target.result);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  const analyse = async () => {
    if (!image) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const base64 = image.split(',')[1];
      const res = await fetch('/.netlify/functions/analyse-image', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Match found characters to our database
      const found = (data.characters || []).map(ch => {
        const match = ALL_CHARS.find(c => c.c === ch.character);
        return { ...ch, dbChar: match };
      });
      setResults(found);
      setMode('result');
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const reset = () => {
    setMode('idle'); setImage(null); setResults([]); setError('');
  };

  const L = {
    title:    lang==='zh'?'📷 识字相机':lang==='it'?'📷 Fotocamera':'📷 Camera',
    sub:      lang==='zh'?'拍照识别汉字':lang==='it'?'Fotografa caratteri':'Identify characters',
    camera:   lang==='zh'?'📷 打开相机':lang==='it'?'📷 Apri fotocamera':'📷 Open camera',
    upload:   lang==='zh'?'🖼 从图库选择':lang==='it'?'🖼 Dalla galleria':'🖼 From gallery',
    capture:  lang==='zh'?'📸 拍照':lang==='it'?'📸 Scatta':'📸 Capture',
    analyse:  lang==='zh'?'🔍 识别汉字':lang==='it'?'🔍 Analizza':'🔍 Analyse',
    again:    lang==='zh'?'重新拍照':lang==='it'?'Riprova':'Try again',
    found:    lang==='zh'?'识别到的汉字':lang==='it'?'Caratteri trovati':'Characters found',
    none:     lang==='zh'?'未识别到汉字':lang==='it'?'Nessun carattere trovato':'No characters found',
    practice: lang==='zh'?'练习':lang==='it'?'Pratica':'Practice',
    inApp:    lang==='zh'?'在应用中':lang==='it'?'Nell\'app':'In app',
    notInApp: lang==='zh'?'未收录':lang==='it'?'Non incluso':'Not in app',
  };

  return (
    <div style={{ padding:'16px 0', fontFamily:'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ padding:'0 16px 16px' }}>
        <div style={{ fontSize:18, fontWeight:500, color:'var(--text)' }}>{L.title}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{L.sub}</div>
      </div>

      {/* IDLE */}
      {mode==='idle' && (
        <div style={{ padding:'0 16px' }}>
          <div style={{ background:'var(--parchment)', border:'2px dashed var(--border)',
            borderRadius:16, padding:'2rem 1rem', textAlign:'center', marginBottom:16 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📷</div>
            <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:16, lineHeight:1.6 }}>
              {lang==='zh'?'拍摄或上传含有汉字的图片\n系统将识别并帮你练习':
               lang==='it'?'Fotografa o carica un\'immagine con caratteri cinesi':'Take or upload an image with Chinese characters'}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={startCamera}
                style={{ padding:'11px 20px', fontSize:14, cursor:'pointer', borderRadius:10,
                  border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit', fontWeight:500 }}>
                {L.camera}
              </button>
              <button onClick={()=>fileRef.current?.click()}
                style={{ padding:'11px 20px', fontSize:14, cursor:'pointer', borderRadius:10,
                  border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)',
                  fontFamily:'inherit' }}>
                {L.upload}
              </button>
            </div>
          </div>

          {/* Tips */}
          <div style={{ background:'var(--card)', borderRadius:12, padding:'12px 14px',
            border:'0.5px solid var(--border)' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', marginBottom:8 }}>
              {lang==='zh'?'📌 使用技巧':lang==='it'?'📌 Suggerimenti':'📌 Tips'}
            </div>
            {[
              lang==='zh'?'对准单个汉字效果最佳':lang==='it'?'Meglio con un singolo carattere':'Best with a single character',
              lang==='zh'?'可拍书本、路牌、包装':lang==='it'?'Funziona su libri, cartelli, packaging':'Works on books, signs, packaging',
              lang==='zh'?'光线充足时识别更准确':lang==='it'?'Migliore con buona illuminazione':'Better in good lighting',
              lang==='zh'?'应用内字符可直接练习':lang==='it'?'I caratteri dell\'app si possono praticare':'App characters can be practised directly',
            ].map((tip, i) => (
              <div key={i} style={{ fontSize:12, color:'var(--text-3)', marginBottom:4, display:'flex', gap:6 }}>
                <span>·</span><span>{tip}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ marginTop:12, padding:'10px 14px', background:'#FFEBEE',
              borderRadius:10, fontSize:13, color:'#c0392b' }}>{error}</div>
          )}
        </div>
      )}

      {/* CAMERA */}
      {mode==='camera' && (
        <div style={{ padding:'0 16px' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width:'100%', borderRadius:12, background:'#000', maxHeight:360, objectFit:'cover' }}/>
          <canvas ref={canvasRef} style={{ display:'none' }}/>
          <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'center' }}>
            <button onClick={reset}
              style={{ padding:'10px 20px', fontSize:13, cursor:'pointer', borderRadius:10,
                border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
              {lang==='zh'?'取消':lang==='it'?'Annulla':'Cancel'}
            </button>
            <button onClick={capture}
              style={{ padding:'10px 28px', fontSize:16, cursor:'pointer', borderRadius:10,
                border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit', fontWeight:500 }}>
              {L.capture}
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW */}
      {mode==='preview' && image && (
        <div style={{ padding:'0 16px' }}>
          <img src={image} alt="preview"
            style={{ width:'100%', borderRadius:12, maxHeight:300, objectFit:'contain', background:'#f0e8d8' }}/>
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            <button onClick={reset}
              style={{ flex:1, padding:'10px', fontSize:13, cursor:'pointer', borderRadius:10,
                border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
              {L.again}
            </button>
            <button onClick={analyse} disabled={loading}
              style={{ flex:2, padding:'10px', fontSize:14, fontWeight:500, cursor:'pointer', borderRadius:10,
                border:'none', background:loading?'#a0704a':'#8B4513', color:'#fdf6e3', fontFamily:'inherit' }}>
              {loading ? (lang==='zh'?'识别中…':lang==='it'?'Analisi…':'Analysing…') : L.analyse}
            </button>
          </div>
          {error && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'#FFEBEE',
              borderRadius:8, fontSize:13, color:'#c0392b' }}>{error}</div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {mode==='result' && (
        <div style={{ padding:'0 16px' }}>
          {/* Thumbnail */}
          <img src={image} alt="analysed"
            style={{ width:'100%', borderRadius:10, maxHeight:160, objectFit:'contain',
              background:'#f0e8d8', marginBottom:12 }}/>

          <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:10 }}>
            {results.length > 0 ? `${L.found} (${results.length})` : L.none}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background:'var(--card)', borderRadius:12,
                border:'0.5px solid var(--border)', padding:'12px 14px',
                display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:42, fontFamily:"'STKaiti','KaiTi',serif",
                  lineHeight:1, minWidth:48, textAlign:'center' }}>{r.character}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:'var(--text)', marginBottom:2 }}>
                    {r.pinyin || r.dbChar?.p || '—'}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:2 }}>
                    {r.meaning || r.dbChar?.m || '—'}
                  </div>
                  {r.dbChar ? (
                    <div style={{ fontSize:11, padding:'1px 8px', borderRadius:20, display:'inline-block',
                      background: r.dbChar.set?.color || '#fdf6e3',
                      border:`1px solid ${r.dbChar.set?.borderColor || '#8B4513'}44`,
                      color: r.dbChar.set?.borderColor || '#8B4513' }}>
                      {r.dbChar.set?.emoji} {L.inApp}
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>{L.notInApp}</div>
                  )}
                </div>
                {r.dbChar && (
                  <button onClick={() => onPractice(r.dbChar)}
                    style={{ padding:'7px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
                      border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    {L.practice} ›
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={reset} style={{ width:'100%', marginTop:12, padding:'10px', fontSize:13,
            cursor:'pointer', borderRadius:10, border:'1.5px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
            {L.again}
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        style={{ display:'none' }} onChange={handleFile}/>
    </div>
  );
}
