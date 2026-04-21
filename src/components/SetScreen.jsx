/**
 * src/components/SetScreen.jsx
 * Shows all characters in a set. Tap one to start practice.
 */
export default function SetScreen({ set, progress, onSelectChar, onBack }) {
  if (!set) return null;

  const characters = progress?.characters ?? {};

  return (
    <div style={{ padding: '0 0 2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <button
          onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}
        >
          ‹
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {set.name} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>{set.nameEn}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {set.description}
          </div>
        </div>
      </div>

      {/* Character grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px' }}>
        {set.chars.map((ch, idx) => {
          const charProgress = characters[ch.c] || {};
          const practiced    = charProgress.practiced ?? 0;
          const quizTotal    = charProgress.quizTotal ?? 0;
          const quizPerfect  = charProgress.quizPerfect ?? 0;
          const isPerfect    = quizTotal > 0 && quizPerfect === quizTotal;
          const isDone       = practiced > 0;

          return (
            <div
              key={ch.c}
              onClick={() => onSelectChar(idx)}   // ← passes the INDEX
              style={{
                background: 'var(--color-background-primary)',
                border: `1.5px solid ${isPerfect ? '#2E7D32' : isDone ? set.borderColor || '#8B4513' : 'var(--color-border-tertiary)'}`,
                borderRadius: 14,
                padding: '18px 8px 12px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.12s, box-shadow 0.12s',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            >
              {/* Done badge */}
              {isDone && (
                <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: isPerfect ? '#2E7D32' : set.borderColor || '#8B4513', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white' }}>
                  {isPerfect ? '★' : '✓'}
                </div>
              )}

              {/* Character */}
              <div style={{ fontSize: 44, fontFamily: "'STKaiti','KaiTi',serif", lineHeight: 1, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                {ch.c}
              </div>

              {/* Compound hint */}
              {ch.compound && (
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  {ch.compound}
                </div>
              )}

              {/* Pinyin */}
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
                {ch.p}
              </div>

              {/* Meaning */}
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', lineHeight: 1.3 }}>
                {ch.m}
              </div>

              {/* Practice count */}
              {practiced > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: set.borderColor || '#8B4513' }}>
                  {practiced}× practiced
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Set info */}
      <div style={{ margin: '0 16px', padding: '12px 14px', background: 'var(--color-background-secondary)', borderRadius: 12, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Level {set.level} — </strong>
        {set.description} · {set.descriptionIt}
      </div>
    </div>
  );
}
