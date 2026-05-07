// src/shared/AudioPlayer.jsx
import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

export default function AudioPlayer({ src, accentColor = '#c41e3a', label }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  if (!src) return null;
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 10, background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,245,230,0.15)', borderRadius: 8,
    }}>
      <button onClick={toggle} style={{
        background: accentColor, color: '#fff', border: 'none',
        width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {playing ? <Pause size={14}/> : <Play size={14}/>}
      </button>
      <Volume2 size={14} color={accentColor}/>
      <span style={{ fontSize: 12, color: '#fff5e6' }}>{label || '音频'}</span>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} style={{ display: 'none' }}/>
    </div>
  );
}
