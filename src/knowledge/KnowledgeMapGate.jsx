// src/knowledge/KnowledgeMapGate.jsx
import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import KnowledgeMap from './KnowledgeMap';

// 知识地图 lives at its own route rather than inside UserApp, so it gets
// neither the module header nor the bottom nav — and KnowledgeMap itself has no
// back control. That was survivable while nothing linked to it; now that it has
// a tile on the community grid, arriving here left the learner with no way out
// except the browser's own back button, which an installed PWA does not show.
//
// The control is added here rather than inside KnowledgeMap so the map itself
// is untouched: it takes no props today, and threading one through it would be
// a larger change than the problem warrants.
function BackToCommunity() {
  return (
    <button
      onClick={() => { window.location.href = '/community'; }}
      aria-label="返回 · Back"
      style={{
        position: 'fixed',
        top: 'calc(12px + var(--safe-top, 0px))',
        left: 12,
        zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px 8px 10px',
        borderRadius: 22,
        border: '1px solid rgba(139,111,71,0.35)',
        // Legible over whatever the map draws underneath.
        background: 'rgba(253,246,227,0.94)',
        backdropFilter: 'blur(6px)',
        color: '#8b6f47',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>‹</span>
      返回
    </button>
  );
}

export default function KnowledgeMapGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BackToCommunity/>
        <KnowledgeMap/>
      </AuthProvider>
    </LanguageProvider>
  );
}
