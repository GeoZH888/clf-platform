/**
 * src/components/LangSwitcher.jsx
 * Compact 3-language toggle: 中文 · Italiano · English
 */
import { useLang } from '../context/LanguageContext.jsx';

const LABELS = { zh: '中文', it: 'IT', en: 'EN' };

export default function LangSwitcher({ style = {} }) {
  const { lang, setLang } = useLang();

  return (
    <div style={{ display:'flex', gap:4, ...style }}>
      {Object.entries(LABELS).map(([l, label]) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding:'4px 10px', fontSize:12, cursor:'pointer',
            borderRadius:20, fontFamily:'var(--font-sans)',
            border: `1.5px solid ${lang === l ? '#8B4513' : 'var(--color-border-tertiary)'}`,
            background: lang === l ? '#8B4513' : 'var(--color-background-secondary)',
            color: lang === l ? '#fdf6e3' : 'var(--color-text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
