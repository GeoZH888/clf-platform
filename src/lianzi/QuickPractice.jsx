// src/lianzi/QuickPractice.jsx
//
// Opens one 练字 practice mode directly, on the adaptive queue.
//
// 汉字听写 and 补全填空 are both ~345 lines of finished work that lived as modes
// *inside* PracticeScreen — reachable only by opening 练字 and knowing to switch
// mode. Nobody discovers that. This gives each its own tile.
//
// It deliberately does NOT reimplement them. DictationMode needs a dozen props
// that PracticeScreen owns — brush, script, ink, size, pen mode, hint mode —
// and duplicating that state would leave two copies to keep in step. Instead
// this reuses PracticeScreen and simply starts it in the requested mode, which
// it already supports via `initialMode`.

import { useMemo, useState } from 'react';
import PracticeScreen from '../components/PracticeScreen.jsx';
import { useProgress } from '../hooks/useProgress.js';
import { useCharacters } from '../hooks/useCharacters.js';
import { buildQueue, DEFAULT_START } from '../lib/adaptiveChars.js';

const QUEUE_LENGTH = 20;
const START_KEY = 'lianzi_start_level';

export default function QuickPractice({ mode = 'dictation', onBack }) {
  const { progress, recordPractice, recordQuiz } = useProgress();
  const { sets, loading } = useCharacters();
  const [idx, setIdx] = useState(0);

  const characters = progress?.characters ?? {};

  // Same pool and same scheduler as 练字's own home, so a character due for
  // review is due here too — these are different ways into one practice
  // history, not separate tracks.
  const queue = useMemo(() => {
    const seen = new Set();
    const flat = [];
    for (const s of sets) {
      for (const c of (s.chars || [])) {
        if (!c?.c || seen.has(c.c)) continue;
        seen.add(c.c);
        flat.push(c);
      }
    }
    let start = DEFAULT_START;
    try { start = localStorage.getItem(START_KEY) || DEFAULT_START; } catch { /* private mode */ }
    return buildQueue(flat, characters, QUEUE_LENGTH, start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, loading]);

  if (loading && !queue.length) {
    return (
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
        justifyContent:'center', background:'var(--bg)', color:'var(--text2)', fontSize:14 }}>
        Loading…
      </div>
    );
  }

  const char = queue[idx] ?? null;
  if (!char) {
    return (
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
        justifyContent:'center', background:'var(--bg)', color:'var(--text2)',
        fontSize:14, padding:24, textAlign:'center' }}>
        还没有字符 · No characters yet
      </div>
    );
  }

  // Presented as a set so PracticeScreen's own next/previous logic works
  // unchanged — it is simply a set the scheduler assembled.
  const set = { id:'adaptive', name:'今日练习', nameEn:'Today', nameIt:'Oggi', chars: queue };

  return (
    <PracticeScreen
      char={char}
      set={set}
      initialMode={mode}
      onBack={onBack}
      onNext={(nextCharObj) => {
        if (nextCharObj?.c) {
          const i = queue.findIndex(c => c.c === nextCharObj.c);
          if (i >= 0) { setIdx(i); return; }
        }
        const n = idx + 1;
        if (n < queue.length) setIdx(n);
        else onBack?.();          // queue finished
      }}
      onPracticed={c => recordPractice(c)}
      onQuizComplete={(c, m) => recordQuiz(c, m)}
    />
  );
}
