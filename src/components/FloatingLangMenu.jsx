// src/components/FloatingLangMenu.jsx
// Universal language switcher: fixed top-right globe button + flag dropdown.
// Lives at the App.jsx top level so it appears on every route (community,
// learn, admin, teacher panels, etc.) without each component needing to
// wire it up.
//
// We don't use either of the project's LanguageContexts directly because
// there are TWO of them (src/context/LanguageContext.jsx with key 'jgw_lang';
// src/school/contexts/LanguageContext.jsx with key 'interfaceLanguage'),
// plus the UserApp setUiLang state with key 'david_lang'. To keep all three
// in sync without restructuring contexts, we write to all three keys and
// reload — the user sees a brief flash, but every consumer reads the new
// value on next mount with no chance of one half of the app being out of
// sync with the other.
import React, { useEffect, useRef, useState } from 'react';

const LANGS = [
  { code: 'zh', name: '中文',     flag: '🇨🇳' },
  { code: 'en', name: 'English',  flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

// All localStorage keys that the various LanguageContexts read on mount.
// Keep this list in sync if you add a new context.
const KEYS = ['jgw_lang', 'interfaceLanguage', 'david_lang'];

function readCurrent() {
  for (const k of KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v === 'zh' || v === 'en' || v === 'it') return v;
    } catch { /* ignore */ }
  }
  return 'zh';
}

export default function FloatingLangMenu() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(readCurrent);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  function pick(code) {
    if (code === current) { setOpen(false); return; }
    try {
      for (const k of KEYS) localStorage.setItem(k, code);
      document.documentElement.lang = code;
    } catch { /* ignore */ }
    setCurrent(code);
    setOpen(false);
    // Broadcast the change so every LanguageContext can update its state
    // in place — no page reload, buttons re-render immediately.
    window.dispatchEvent(new CustomEvent('clf-langchange', { detail: { lang: code } }));
  }

  const activeLabel = LANGS.find(l => l.code === current);

  return (
    <div ref={ref} style={{
      position: 'fixed',
      top: 'calc(8px + var(--safe-top, 0px))',
      right: 8,
      zIndex: 9999,
    }}>
      <button onClick={() => setOpen(v => !v)} aria-label="Language" style={{
        background: 'rgba(0,0,0,0.55)', color: '#fff5e6',
        border: '1px solid rgba(255,255,255,0.25)',
        width: 36, height: 36, borderRadius: 18, padding: 0,
        cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}>
        {activeLabel?.flag || '🌐'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#fff', borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: 4, minWidth: 150,
        }}>
          {LANGS.map(L => (
            <button key={L.code} onClick={() => pick(L.code)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: 'none',
              background: current === L.code ? '#fdf2f8' : 'transparent',
              color: current === L.code ? '#c41e3a' : '#1a0a05',
              cursor: 'pointer', fontSize: 13,
              fontWeight: current === L.code ? 700 : 500,
              textAlign: 'left',
            }}>
              <span style={{ fontSize: 18 }}>{L.flag}</span>
              <span>{L.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
