// src/components/TtsButton.jsx
// Touch-reliable TTS button — works on Huawei and all Android

import { useState } from 'react';
import { playTTS } from '../utils/ttsHelper';

export default function TtsButton({
  text,
  size = 'md',
  label,
  onAfterPlay,
  style = {},
}) {
  const [active, setActive] = useState(false);

  const sizes = {
    sm: { width:32, height:32, fontSize:14, borderRadius:24 },
    md: { width:48, height:48, fontSize:20, borderRadius:'50%' },
    lg: { width:72, height:72, fontSize:32, borderRadius:'50%' },
  };
  const s = sizes[size] || sizes.md;

  function handleTap(e) {
    e.preventDefault();
    e.stopPropagation();
    setActive(true);
    playTTS(text);
    if (onAfterPlay) onAfterPlay();
    setTimeout(() => setActive(false), 1000);
  }

  return (
    <div
      onTouchStart={handleTap}
      onClick={handleTap}
      role="button"
      aria-label={`Play ${text}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: label ? 'auto' : s.width,
        height: s.height,
        padding: label ? `0 16px` : 0,
        borderRadius: label ? 24 : s.borderRadius,
        background: active ? '#555' : '#E65100',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        border: 'none',
        ...style,
      }}>
      <span style={{ fontSize: s.fontSize, lineHeight: 1, pointerEvents:'none' }}>
        {active ? '🔊' : '🔈'}
      </span>
      {label && (
        <span style={{ fontSize: 14, color: '#fff', fontWeight: 500,
          pointerEvents:'none' }}>
          {label}
        </span>
      )}
    </div>
  );
}
