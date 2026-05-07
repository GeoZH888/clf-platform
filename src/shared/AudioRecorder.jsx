// src/shared/AudioRecorder.jsx
// Hold-to-record audio component using MediaRecorder API.
// onComplete(blob) is called when recording stops.
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

export default function AudioRecorder({ onComplete, accentColor = '#c41e3a' }) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && navigator.mediaDevices?.getUserMedia
      && window.MediaRecorder;
    setSupported(!!ok);
  }, []);

  const start = async () => {
    if (!supported) {
      alert('您的浏览器不支持录音功能。请使用最新版 Chrome / Safari / Edge。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      alert('无法访问麦克风：' + e.message);
    }
  };

  const stop = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setDuration(0);
    setPlaying(false);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const accept = () => {
    if (blob) onComplete?.(blob);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!supported) {
    return (
      <div style={{
        padding: 12, background: 'rgba(253,164,175,0.1)',
        border: '1px solid rgba(253,164,175,0.3)', borderRadius: 8,
        fontSize: 12, color: '#fda4af',
      }}>
        当前浏览器不支持录音。请使用最新版 Chrome / Safari / Edge。
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10,
      border: '1px solid rgba(255,245,230,0.15)',
    }}>
      {!blob && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!recording ? (
            <button onClick={start} style={{
              background: accentColor, color: '#fff', border: 'none',
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            }}>
              <Mic size={14}/> 开始录音
            </button>
          ) : (
            <button onClick={stop} style={{
              background: '#dc2626', color: '#fff', border: 'none',
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              animation: 'pulse 1s infinite',
            }}>
              <Square size={12}/> 停止
            </button>
          )}
          <span style={{ fontSize: 12, color: '#fff5e6' }}>
            {recording ? `录音中 ${fmt(duration)}` : '点击开始'}
          </span>
        </div>
      )}
      {blob && url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={togglePlay} style={iconBtn(accentColor)}>
            {playing ? <Pause size={14}/> : <Play size={14}/>}
          </button>
          <span style={{ fontSize: 12, color: '#fff5e6' }}>{fmt(duration)}</span>
          <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} style={{ display: 'none' }}/>
          <button onClick={reset} style={iconBtn('#dc2626')}>
            <Trash2 size={14}/>
          </button>
          <button onClick={accept} style={{
            background: '#10b981', color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            marginLeft: 'auto', fontSize: 12, fontWeight: 600,
          }}>
            使用此录音
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtn = (color) => ({
  background: color, color: '#fff', border: 'none',
  width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
