// src/components/LearningNav.jsx
// Universal prev / refresh / next navigation bar for all learning screens.
// Drop in at the bottom of any learning card: PracticeScreen, TonePractice,
// ListenIdentify, TypePinyin, etc.
//
// Props:
//   onPrev     () => void   — go to previous item (null → button disabled)
//   onRefresh  () => void   — reset / replay current item
//   onNext     () => void   — go to next item (null → button disabled)
//   label      string       — optional centre label e.g. "3 / 12"
//   color      string       — accent hex color (default brown)
//   style      object       — extra wrapper styles

export default function LearningNav({
  onPrev,
  onRefresh,
  onNext,
  label,
  color = '#8B4513',
  style: wrapStyle,
}) {
  const btn = (content, onClick, disabled, variant = 'ghost') => {
    const isAction = variant === 'action';
    return (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{
          width: isAction ? 44 : 44,
          height: isAction ? 44 : 44,
          borderRadius: '50%',
          border: isAction ? 'none' : `1.5px solid ${disabled ? '#E0E0E0' : color + '55'}`,
          background: isAction
            ? disabled ? '#E0E0E0' : color
            : disabled ? '#F5F5F5' : color + '12',
          color: disabled ? '#BDBDBD' : isAction ? '#fff' : color,
          fontSize: 22,
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '10px 16px',
      ...wrapStyle,
    }}>
      {/* ‹ Prev */}
      {btn('‹', onPrev, !onPrev)}

      {/* Centre: label or refresh */}
      {label ? (
        <>
          <div style={{
            flex: 1, textAlign: 'center',
            fontSize: 13, color: '#90A4AE', letterSpacing: 0.3,
          }}>
            {label}
          </div>
          {btn('↺', onRefresh, !onRefresh, 'ghost')}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {btn('↺', onRefresh, !onRefresh, 'action')}
        </div>
      )}

      {/* › Next */}
      {btn('›', onNext, !onNext)}
    </div>
  );
}
