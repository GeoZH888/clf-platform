// scripts/seed-pinyin-phonemes.mjs
// Seed clf_pinyin_phonemes from the existing INITIAL_GROUPS / FINAL_GROUPS
// in src/pinyin/PinyinTable.jsx. Idempotent — upserts on (kind, py).
//
// Run AFTER applying supabase/migrations/008_pinyin_phonemes.sql once via
// the Supabase SQL editor.
//
//   node scripts/seed-pinyin-phonemes.mjs
//
// Re-run any time to refresh — existing rows update, missing rows insert.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadDotenv(path = '.env') {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch { /* no .env, fall back */ }
}
loadDotenv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Mirrors src/pinyin/PinyinTable.jsx INITIAL_GROUPS / FINAL_GROUPS exactly.
// If you change the JSX file, mirror the change here.
const INITIAL_GROUPS = [
  { label: '双唇音', color: '#E53935', items: [
    { py: 'b', eg: '爸', meaning: 'father' },
    { py: 'p', eg: '爬', meaning: 'climb' },
    { py: 'm', eg: '妈', meaning: 'mother' },
  ]},
  { label: '唇齿音', color: '#FB8C00', items: [
    { py: 'f', eg: '飞', meaning: 'fly' },
  ]},
  { label: '舌尖音', color: '#43A047', items: [
    { py: 'd', eg: '大', meaning: 'big' },
    { py: 't', eg: '他', meaning: 'he' },
    { py: 'n', eg: '你', meaning: 'you' },
    { py: 'l', eg: '来', meaning: 'come' },
  ]},
  { label: '舌根音', color: '#1E88E5', items: [
    { py: 'g', eg: '个', meaning: 'CLF' },
    { py: 'k', eg: '看', meaning: 'look' },
    { py: 'h', eg: '好', meaning: 'good' },
  ]},
  { label: '舌面音', color: '#00897B', items: [
    { py: 'j', eg: '家', meaning: 'home' },
    { py: 'q', eg: '去', meaning: 'go' },
    { py: 'x', eg: '小', meaning: 'small' },
  ]},
  { label: '翘舌音', color: '#E65100', items: [
    { py: 'zh', eg: '这', meaning: 'this' },
    { py: 'ch', eg: '吃', meaning: 'eat' },
    { py: 'sh', eg: '是', meaning: 'is' },
    { py: 'r',  eg: '热', meaning: 'hot' },
  ]},
  { label: '平舌音', color: '#00ACC1', items: [
    { py: 'z', eg: '在', meaning: 'at' },
    { py: 'c', eg: '草', meaning: 'grass' },
    { py: 's', eg: '三', meaning: 'three' },
  ]},
  { label: '半元音', color: '#8E24AA', items: [
    { py: 'y', eg: '一', meaning: 'one' },
    { py: 'w', eg: '我', meaning: 'I' },
  ]},
];

const FINAL_GROUPS = [
  { label: '单韵母', color: '#E53935', items: [
    { py: 'a', eg: '啊', meaning: 'ah' },
    { py: 'o', eg: '喔', meaning: 'oh' },
    { py: 'e', eg: '鹅', meaning: 'goose' },
    { py: 'i', eg: '衣', meaning: 'clothes' },
    { py: 'u', eg: '乌', meaning: 'crow' },
    { py: 'ü', eg: '鱼', meaning: 'fish' },
  ]},
  { label: '复韵母', color: '#1E88E5', items: [
    { py: 'ai', eg: '爱', meaning: 'love' },
    { py: 'ei', eg: '诶', meaning: 'hey' },
    { py: 'ui', eg: '位', meaning: 'position' },
    { py: 'ao', eg: '奥', meaning: 'brilliant' },
    { py: 'ou', eg: '欧', meaning: 'Europe' },
    { py: 'iu', eg: '牛', meaning: 'cow' },
    { py: 'ie', eg: '叶', meaning: 'leaf' },
    { py: 'üe', eg: '月', meaning: 'moon' },
    { py: 'er', eg: '耳', meaning: 'ear' },
  ]},
  { label: '鼻韵母', color: '#43A047', items: [
    { py: 'an',  eg: '安', meaning: 'peace' },
    { py: 'en',  eg: '恩', meaning: 'grace' },
    { py: 'in',  eg: '音', meaning: 'sound' },
    { py: 'un',  eg: '云', meaning: 'cloud' },
    { py: 'ün',  eg: '晕', meaning: 'dizzy' },
    { py: 'ang', eg: '昂', meaning: 'upright' },
    { py: 'eng', eg: '灯', meaning: 'lamp' },
    { py: 'ing', eg: '鹰', meaning: 'eagle' },
    { py: 'ong', eg: '红', meaning: 'red' },
  ]},
];

function flatten(groups, kind) {
  const rows = [];
  let order = 0;
  for (const g of groups) {
    for (const it of g.items) {
      rows.push({
        kind,
        py: it.py,
        category_label: g.label,
        category_color: g.color,
        example_char: it.eg,
        example_meaning: it.meaning,
        display_order: order++,
      });
    }
  }
  return rows;
}

async function main() {
  const rows = [
    ...flatten(INITIAL_GROUPS, 'initial'),
    ...flatten(FINAL_GROUPS,   'final'),
  ];
  console.log(`Upserting ${rows.length} phonemes (${rows.filter(r => r.kind === 'initial').length} initials + ${rows.filter(r => r.kind === 'final').length} finals)…`);

  const { error, count } = await supabase
    .from('clf_pinyin_phonemes')
    .upsert(rows, { onConflict: 'kind,py', count: 'exact' });

  if (error) { console.error('upsert failed:', error.message); process.exit(1); }
  console.log(`✓ done${typeof count === 'number' ? ` (${count} rows touched)` : ''}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
