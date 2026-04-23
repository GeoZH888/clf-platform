// src/admin/AdminPinyinAudio.jsx
// Admin interface for:
//   1. Recording a custom voice audio for each initial/final
//   2. Overriding IPA + descriptions per sound
//
// Uses MediaRecorder (WebM/Opus) — Chrome, Edge, Firefox, modern Safari (iOS 14.3+).
// Recordings upload to Supabase Storage bucket `pinyin-audio`, metadata to
// `pinyin_audio` table. IPA overrides go to `pinyin_sound_overrides`.
//
// Layout: side-by-side panels
//   Left:  sound list with status dots + record/play/delete controls
//   Right: selected sound detail — IPA/desc editing + recording modal

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { INITIAL_IPA, FINAL_IPA } from '../data/pinyinIPA.js';
import {
  getPinyinAudioUrl,
  invalidatePinyinAudioCache,
  getIPAOverride,
  invalidateIPAOverrideCache,
} from '../lib/pinyinAudio.js';

const ALL_SOUNDS = [
  ...Object.keys(INITIAL_IPA).map(s => ({ sound: s, kind: 'initial', ...INITIAL_IPA[s] })),
  ...Object.keys(FINAL_IPA).map(s   => ({ sound: s, kind: 'final',   ...FINAL_IPA[s]   })),
];

export default function AdminPinyinAudio() {
  const [loading,    setLoading]    = useState(true);
  const [audioMap,   setAudioMap]   = useState({});     // sound → url
  const [overrideMap,setOverrideMap]= useState({});     // sound → {ipa, desc_*}
  const [selected,   setSelected]   = useState(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  // ── Load all data ───────────────────────────────────────────────
  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const [audioRes, overrideRes] = await Promise.all([
        supabase.from('pinyin_audio').select('sound, audio_url, duration_ms, uploaded_at'),
        supabase.from('pinyin_sound_overrides').select('*'),
      ]);
      const am = {}, om = {};
      for (const r of audioRes.data    || []) am[r.sound] = r;
      for (const r of overrideRes.data || []) om[r.sound] = r;
      setAudioMap(am);
      setOverrideMap(om);
      invalidatePinyinAudioCache();
      invalidateIPAOverrideCache();
    } catch (err) {
      console.error(err);
      alert('加载失败: ' + err.message);
    }
    setLoading(false);
  }

  // ── Counts for header ───────────────────────────────────────────
  const totalSounds  = ALL_SOUNDS.length;
  const recordedCount = Object.keys(audioMap).length;
  const overrideCount = Object.keys(overrideMap).length;

  return (
    <div style={{ paddingBottom:20 }}>

      {/* Stats strip — fits within the existing tab layout */}
      <div style={{ display:'flex', gap:12, marginBottom:14, fontSize:12, color:'#6b4c2a' }}>
        <span>录音 <b style={{ color:'#8B4513' }}>{recordedCount}/{totalSounds}</b></span>
        <span>·</span>
        <span>IPA 覆写 <b style={{ color:'#8B4513' }}>{overrideCount}</b></span>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#888' }}>加载中…</div>
      ) : (
        <div style={{ display:'grid',
          gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1.3fr)',
          gap:14 }}>

          {/* Left: sound list */}
          <div>
            <SoundList kind="initial" audioMap={audioMap}
              overrideMap={overrideMap} selected={selected}
              onSelect={setSelected}/>
            <SoundList kind="final" audioMap={audioMap}
              overrideMap={overrideMap} selected={selected}
              onSelect={setSelected}/>
          </div>

          {/* Right: detail for selected sound */}
          <div>
            {selected ? (
              <SoundDetail
                sound={selected}
                audio={audioMap[selected]}
                override={overrideMap[selected]}
                onRecord={() => setRecordModalOpen(true)}
                onDeleteAudio={() => handleDeleteAudio(selected)}
                onSaveOverride={(fields) => handleSaveOverride(selected, fields)}
                onClearOverride={() => handleClearOverride(selected)}/>
            ) : (
              <EmptyDetail/>
            )}
          </div>
        </div>
      )}

      {/* Recording modal */}
      {recordModalOpen && selected && (
        <RecordModal
          sound={selected}
          onClose={() => setRecordModalOpen(false)}
          onSaved={() => { setRecordModalOpen(false); reload(); }}/>
      )}
    </div>
  );

  // ═════════════════════════════════════════════════════════════════
  //  Mutations
  // ═════════════════════════════════════════════════════════════════

  async function handleDeleteAudio(sound) {
    if (!confirm(`删除 "${sound}" 的录音吗？`)) return;
    try {
      // Guess filename — we upload as `${sound}.webm`
      await supabase.storage.from('pinyin-audio').remove([`${sound}.webm`]);
      await supabase.from('pinyin_audio').delete().eq('sound', sound);
      reload();
    } catch (err) { alert('删除失败: ' + err.message); }
  }

  async function handleSaveOverride(sound, fields) {
    try {
      const payload = { sound, ...fields };
      const { error } = await supabase
        .from('pinyin_sound_overrides')
        .upsert(payload, { onConflict: 'sound' });
      if (error) throw error;
      reload();
    } catch (err) { alert('保存失败: ' + err.message); }
  }

  async function handleClearOverride(sound) {
    if (!confirm(`清除 "${sound}" 的覆写，恢复默认值？`)) return;
    try {
      const { error } = await supabase
        .from('pinyin_sound_overrides')
        .delete().eq('sound', sound);
      if (error) throw error;
      reload();
    } catch (err) { alert('清除失败: ' + err.message); }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Left column — sound list grouped by kind
// ═══════════════════════════════════════════════════════════════════
function SoundList({ kind, audioMap, overrideMap, selected, onSelect }) {
  const source = kind === 'initial' ? INITIAL_IPA : FINAL_IPA;
  const title  = kind === 'initial' ? '声母 (23)' : '韵母 (24)';

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:12, marginBottom:14,
      border:'1px solid #e0e0e0' }}>
      <div style={{ fontSize:12, color:'#546E7A', fontWeight:600,
        marginBottom:8, letterSpacing:1 }}>
        {title}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(70px, 1fr))',
        gap:6 }}>
        {Object.keys(source).map(sound => {
          const hasAudio    = !!audioMap[sound];
          const hasOverride = !!overrideMap[sound];
          const isSelected  = selected === sound;
          return (
            <button key={sound} onClick={() => onSelect(sound)} style={{
              padding:'8px 6px', borderRadius:10,
              border: isSelected ? '2px solid #3F51B5' : '1px solid #E0E0E0',
              background: isSelected ? '#E8EAF6' : '#fff',
              cursor:'pointer', position:'relative',
              display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#263238' }}>{sound}</div>
              <div style={{ fontSize:9, color:'#90A4AE', fontFamily:'serif' }}>
                /{source[sound].ipa}/
              </div>
              <div style={{ position:'absolute', top:4, right:4,
                display:'flex', gap:2 }}>
                {hasAudio    && <span title="已录音"   style={{ width:6, height:6, borderRadius:3, background:'#43A047' }}/>}
                {hasOverride && <span title="有覆写"   style={{ width:6, height:6, borderRadius:3, background:'#FB8C00' }}/>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Right column — detail for selected sound
// ═══════════════════════════════════════════════════════════════════
function EmptyDetail() {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:40,
      border:'1px solid #e0e0e0', textAlign:'center', color:'#90A4AE' }}>
      <div style={{ fontSize:32, marginBottom:8 }}>👈</div>
      <div style={{ fontSize:13 }}>选择一个声母或韵母</div>
    </div>
  );
}

function SoundDetail({ sound, audio, override, onRecord, onDeleteAudio, onSaveOverride, onClearOverride }) {
  const defaults = INITIAL_IPA[sound] || FINAL_IPA[sound];
  // Editable fields — seed from override if present, else from defaults
  const [ipa,   setIpa]   = useState(override?.ipa   ?? defaults.ipa);
  const [descZh,setDescZh]= useState(override?.desc_zh ?? defaults.desc);
  const [descEn,setDescEn]= useState(override?.desc_en ?? defaults.en);
  const [descIt,setDescIt]= useState(override?.desc_it ?? '');
  const [exChar,setExChar]= useState(override?.example_char ?? '');
  const [exMean,setExMean]= useState(override?.example_meaning ?? '');
  const [dirty, setDirty] = useState(false);

  // Reset when user switches to a different sound
  useEffect(() => {
    setIpa(override?.ipa   ?? defaults.ipa);
    setDescZh(override?.desc_zh ?? defaults.desc);
    setDescEn(override?.desc_en ?? defaults.en);
    setDescIt(override?.desc_it ?? '');
    setExChar(override?.example_char ?? '');
    setExMean(override?.example_meaning ?? '');
    setDirty(false);
  }, [sound, override]);

  const touch = fn => v => { fn(v); setDirty(true); };

  function save() {
    onSaveOverride({
      ipa:             ipa             || null,
      desc_zh:         descZh          || null,
      desc_en:         descEn          || null,
      desc_it:         descIt          || null,
      example_char:    exChar          || null,
      example_meaning: exMean          || null,
    });
    setDirty(false);
  }

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:18,
      border:'1px solid #e0e0e0' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:18 }}>
        <div style={{ fontSize:56, fontWeight:800, color:'#3F51B5', lineHeight:1 }}>
          {sound}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'#90A4AE', letterSpacing:1 }}>默认 IPA</div>
          <div style={{ fontSize:22, fontFamily:'serif', color:'#263238' }}>
            /{defaults.ipa}/
          </div>
          <div style={{ fontSize:11, color:'#546E7A', marginTop:4 }}>
            {defaults.desc} · {defaults.en}
          </div>
        </div>
      </div>

      {/* Audio section */}
      <div style={{ background:'#F5F5F5', borderRadius:10, padding:14, marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#546E7A', marginBottom:8 }}>
          🎤 录音
        </div>
        {audio ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <audio src={audio.audio_url} controls style={{ flex:1, height:36 }}/>
            <button onClick={onRecord} style={btnSecondary}>重录</button>
            <button onClick={onDeleteAudio} style={btnDanger}>删除</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:11, color:'#90A4AE', marginBottom:8 }}>
              暂无录音 — 录制后将用您的声音替代 Azure TTS
            </div>
            <button onClick={onRecord} style={{ ...btnPrimary, width:'100%' }}>
              🎤 开始录制
            </button>
          </div>
        )}
      </div>

      {/* IPA override */}
      <div style={{ fontSize:12, fontWeight:600, color:'#546E7A', marginBottom:8 }}>
        ✏️ IPA / 描述 覆写
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <LabeledInput label="IPA"   value={ipa}    onChange={touch(setIpa)}    placeholder={defaults.ipa} mono/>
        <LabeledInput label="中文"  value={descZh} onChange={touch(setDescZh)} placeholder={defaults.desc}/>
        <LabeledInput label="English" value={descEn} onChange={touch(setDescEn)} placeholder={defaults.en}/>
        <LabeledInput label="Italiano" value={descIt} onChange={touch(setDescIt)} placeholder="..."/>
        <div style={{ display:'flex', gap:8 }}>
          <LabeledInput style={{ flex:1 }} label="例字" value={exChar} onChange={touch(setExChar)} placeholder="..."/>
          <LabeledInput style={{ flex:2 }} label="含义" value={exMean} onChange={touch(setExMean)} placeholder="..."/>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <button onClick={save} disabled={!dirty}
          style={{ ...btnPrimary, flex:1, opacity: dirty ? 1 : 0.4 }}>
          保存覆写
        </button>
        {override && (
          <button onClick={onClearOverride} style={btnSecondary}>清除覆写</button>
        )}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, mono, style }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2, ...style }}>
      <label style={{ fontSize:10, color:'#90A4AE' }}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding:'6px 8px', borderRadius:6, border:'1px solid #CFD8DC',
          fontSize:13, fontFamily: mono ? 'serif' : 'inherit' }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Record modal — MediaRecorder → Supabase Storage
// ═══════════════════════════════════════════════════════════════════
function RecordModal({ sound, onClose, onSaved }) {
  const [phase, setPhase] = useState('idle');          // idle | countdown | recording | review | uploading
  const [countdown, setCountdown] = useState(3);
  const [blob, setBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const streamRef   = useRef(null);
  const startedAtRef = useRef(0);

  async function startCountdown() {
    setError(null);
    // Acquire mic early to prompt permission before countdown
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, sampleRate: 48000,
      }});
    } catch (err) {
      setError('无法访问麦克风: ' + err.message);
      return;
    }
    setPhase('countdown');
    setCountdown(3);
    for (let n = 3; n > 0; n--) {
      setCountdown(n);
      await sleep(900);
    }
    beginRecording();
  }

  function beginRecording() {
    setPhase('recording');
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      setBlob(b);
      setDuration(Date.now() - startedAtRef.current);
      setPhase('review');
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    startedAtRef.current = Date.now();
    rec.start();
    mediaRecRef.current = rec;
  }

  function stopRecording() {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }

  function retake() {
    setBlob(null);
    setDuration(0);
    setPhase('idle');
  }

  async function save() {
    if (!blob) return;
    setPhase('uploading');
    try {
      const filename = `${sound}.webm`;
      // Upload with upsert so re-recording overwrites cleanly
      const { error: upErr } = await supabase.storage
        .from('pinyin-audio')
        .upload(filename, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;

      // Public URL is stable
      const { data: urlData } = supabase.storage
        .from('pinyin-audio').getPublicUrl(filename);
      const audio_url = urlData.publicUrl;

      // Insert / update DB row
      const { error: dbErr } = await supabase
        .from('pinyin_audio')
        .upsert({
          sound,
          audio_url,
          duration_ms: duration,
          file_size:   blob.size,
          format:      blob.type,
        }, { onConflict: 'sound' });
      if (dbErr) throw dbErr;

      onSaved();
    } catch (err) {
      setError('保存失败: ' + err.message);
      setPhase('review');
    }
  }

  function cancel() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecRef.current = null;
    onClose();
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24,
        width:'min(420px, 100%)', textAlign:'center' }}>

        <div style={{ fontSize:56, fontWeight:800, color:'#3F51B5',
          marginBottom:4 }}>{sound}</div>
        <div style={{ fontSize:12, color:'#90A4AE', marginBottom:22 }}>
          {phaseLabel(phase)}
        </div>

        {phase === 'idle' && (
          <div>
            <div style={{ fontSize:13, color:'#546E7A', marginBottom:16, lineHeight:1.5 }}>
              准备好后点击"开始" — 将有 3 秒倒数，然后开始录音。<br/>
              标准普通话 · 清晰 · 只读一次这个音。
            </div>
            <button onClick={startCountdown} style={{ ...btnPrimary, width:'100%',
              padding:'14px' }}>
              🎤 开始
            </button>
          </div>
        )}

        {phase === 'countdown' && (
          <div style={{ fontSize:80, color:'#E65100', fontWeight:800, padding:'30px 0' }}>
            {countdown}
          </div>
        )}

        {phase === 'recording' && (
          <div>
            <div style={{ fontSize:64, padding:'20px 0', animation:'pulse 1s infinite' }}>
              🔴
            </div>
            <div style={{ fontSize:13, color:'#C62828', marginBottom:16 }}>
              录音中… 读完后立即停止
            </div>
            <button onClick={stopRecording} style={{ ...btnDanger, width:'100%',
              padding:'14px' }}>
              ⏹ 停止
            </button>
          </div>
        )}

        {phase === 'review' && blob && (
          <div>
            <audio src={URL.createObjectURL(blob)} controls
              style={{ width:'100%', marginBottom:14 }}/>
            <div style={{ fontSize:11, color:'#90A4AE', marginBottom:14 }}>
              时长 {(duration/1000).toFixed(1)}s · 大小 {(blob.size/1024).toFixed(1)} KB
            </div>
            {error && (
              <div style={{ background:'#FFEBEE', color:'#C62828', padding:'8px',
                borderRadius:6, fontSize:11, marginBottom:10 }}>{error}</div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={retake} style={{ ...btnSecondary, flex:1 }}>
                🔄 重录
              </button>
              <button onClick={save} style={{ ...btnPrimary, flex:2 }}>
                ✓ 保存
              </button>
            </div>
          </div>
        )}

        {phase === 'uploading' && (
          <div>
            <div style={{ fontSize:40, padding:'20px 0' }}>⏳</div>
            <div style={{ fontSize:13, color:'#546E7A' }}>上传中…</div>
          </div>
        )}

        {phase !== 'uploading' && (
          <button onClick={cancel} style={{ ...btnText, marginTop:14 }}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}

function phaseLabel(phase) {
  switch (phase) {
    case 'idle':      return '准备录音';
    case 'countdown': return '倒数中…';
    case 'recording': return '录音中';
    case 'review':    return '预览';
    case 'uploading': return '上传中';
    default: return '';
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Button styles ──────────────────────────────────────────────────
const btnBase = {
  border:'none', borderRadius:8, padding:'8px 14px', fontSize:13,
  cursor:'pointer', fontWeight:500, transition:'opacity 0.15s',
};
const btnPrimary   = { ...btnBase, background:'#3F51B5', color:'#fff' };
const btnSecondary = { ...btnBase, background:'#fff', color:'#3F51B5', border:'1px solid #3F51B5' };
const btnDanger    = { ...btnBase, background:'#C62828', color:'#fff' };
const btnText      = { ...btnBase, background:'none', color:'#90A4AE',
                       padding:'6px 12px', fontSize:12 };
