export default function ProgressScreen({ sets, progress, stats, onReset }) {
  return (
    <div className="progress-wrap">
      <div className="progress-header">
        <div className="progress-title">学习进度</div>
        <div className="progress-sub">Your learning progress</div>
      </div>

      {/* Streak card */}
      <div className="streak-card">
        <div>
          <div className="streak-num">{stats.streak}</div>
        </div>
        <div>
          <div className="streak-text">天连续练习</div>
          <div className="streak-sub">Day streak · Keep it up! 🔥</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="prog-stats">
        <div className="prog-stat">
          <div className="prog-stat-val">{stats.totalPracticed}</div>
          <div className="prog-stat-lbl">练习次数 Sessions</div>
        </div>
        <div className="prog-stat">
          <div className="prog-stat-val">{stats.uniqueChars}</div>
          <div className="prog-stat-lbl">学过的字 Chars</div>
        </div>
        <div className="prog-stat">
          <div className="prog-stat-val">{stats.accuracy !== null ? stats.accuracy + '%' : '—'}</div>
          <div className="prog-stat-lbl">笔顺准确率</div>
        </div>
        <div className="prog-stat">
          <div className="prog-stat-val">
            {sets.reduce((s, set) => s + set.chars.filter(c => progress[c.c]?.practiced > 0).length, 0)}
            <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-3)' }}>
              /{sets.reduce((s, set) => s + set.chars.length, 0)}
            </span>
          </div>
          <div className="prog-stat-lbl">完成字数</div>
        </div>
      </div>

      {/* Per-set character grids */}
      {sets.map(set => {
        const done = set.chars.filter(c => progress[c.c]?.practiced > 0).length;
        return (
          <div key={set.id} className="prog-sets">
            <div className="prog-set-title" style={{ color: set.color }}>
              {set.name} · {set.nameEn}
              <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 13 }}> ({done}/{set.chars.length})</span>
            </div>
            <div className="prog-chars">
              {set.chars.map(c => {
                const p = progress[c.c];
                const practiced = p?.practiced || 0;
                return (
                  <div key={c.c} className={`prog-char ${practiced > 0 ? 'practiced' : ''}`} title={`${c.p} · ${c.m}`}>
                    {c.c}
                    {practiced > 0 && <div className="prog-char-count">{practiced}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="reset-row">
        <button className="reset-btn" onClick={() => { if (window.confirm('重置所有进度？Reset all progress?')) onReset(); }}>
          重置进度 Reset progress
        </button>
      </div>
    </div>
  );
}
