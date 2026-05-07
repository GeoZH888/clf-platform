// src/shared/PDFViewer.jsx
import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

export default function PDFViewer({ src, name = 'document.pdf', accentColor = '#c41e3a', height = 480 }) {
  if (!src) return null;
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,245,230,0.15)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid rgba(255,245,230,0.1)',
      }}>
        <FileText size={14} color={accentColor}/>
        <span style={{ fontSize: 12, color: '#fff5e6', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <a href={src} target="_blank" rel="noopener noreferrer" style={{
          color: accentColor, fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none',
        }}>
          打开 <ExternalLink size={11}/>
        </a>
      </div>
      <iframe src={src} style={{
        width: '100%', height, border: 'none', background: '#fff',
      }} title={name}/>
    </div>
  );
}
