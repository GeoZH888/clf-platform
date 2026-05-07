// src/shared/FileUploadButton.jsx
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export default function FileUploadButton({
  accept = '*',
  onPick,
  label = '选择文件',
  accentColor = '#c41e3a',
  maxMB = 50,
}) {
  const ref = useRef();
  const [name, setName] = useState(null);

  const handle = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > maxMB * 1024 * 1024) {
      alert(`文件超过 ${maxMB} MB 上限`);
      return;
    }
    setName(f.name);
    onPick?.(f);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => ref.current?.click()} style={{
        background: accentColor, color: '#fff', border: 'none',
        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      }}>
        <Upload size={12}/> {label}
      </button>
      {name && <span style={{ fontSize: 11, color: 'rgba(253,246,227,0.7)' }}>{name}</span>}
      <input ref={ref} type="file" accept={accept} onChange={handle}
        style={{ display: 'none' }}/>
    </div>
  );
}
