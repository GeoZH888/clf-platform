// src/hooks/useCharacters.js
// Loads character sets from Supabase (jgw_characters table).
// Falls back to static SETS from characters.js if DB is unavailable.
// Maps DB rows → the SETS shape the app expects.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { SETS as STATIC_SETS } from '../data/characters.js';

// Static set metadata (names, colors, emoji) keyed by set_id
// Add new set_ids here as you create them via Auto-Populate
const SET_META = {
  numbers: {
    level: 1, name:'数字', nameEn:'Numbers', nameIt:'Numeri',
    emoji:'🔢', color:'#E3F2FD', borderColor:'#1976D2',
    description:'最简单的符号 · Simplest strokes', descriptionIt:'I simboli più semplici',
  },
  simple_pictograms: {
    level: 2, name:'基础象形', nameEn:'Basic Pictograms', nameIt:'Pittogrammi Base',
    emoji:'🖼', color:'#E8F5E9', borderColor:'#2E7D32',
    description:'看图识字 · See the shape, know the meaning', descriptionIt:'Vedi la forma, conosci il significato',
  },
  nature: {
    level: 3, name:'自然', nameEn:'Nature', nameIt:'Natura',
    emoji:'🌿', color:'#FFF8E1', borderColor:'#F57F17',
    description:'天地万物 · The elements of the world', descriptionIt:'Gli elementi del mondo',
  },
  compounds: {
    level: 4, name:'会意字', nameEn:'Compound Meanings', nameIt:'Ideogrammi Composti',
    emoji:'🔀', color:'#FCE4EC', borderColor:'#C62828',
    description:'两字合一义 · Two parts, one meaning', descriptionIt:'Due parti, un significato',
  },
  animals: {
    level: 5, name:'动物', nameEn:'Animals', nameIt:'Animali',
    emoji:'🐾', color:'#EDE7F6', borderColor:'#4527A0',
    description:'甲骨动物图谱 · The oracle bone bestiary', descriptionIt:'Il bestiario delle ossa oracolari',
  },
  ritual: {
    level: 6, name:'甲骨神道', nameEn:'Oracle & Ritual', nameIt:'Oracoli e Rituali',
    emoji:'🐢', color:'#FBE9E7', borderColor:'#8B4513',
    description:'商朝占卜文化 · The divination world of the Shang', descriptionIt:'Il mondo della divinazione Shang',
  },
  // Auto-generated sets from Auto-Populate
  body: {
    level: 7, name:'身体', nameEn:'Body', nameIt:'Corpo',
    emoji:'🫀', color:'#F3E5F5', borderColor:'#7B1FA2',
    description:'人体部位 · Parts of the body', descriptionIt:'Parti del corpo',
  },
  people: {
    level: 8, name:'人物', nameEn:'People', nameIt:'Persone',
    emoji:'👥', color:'#E8EAF6', borderColor:'#283593',
    description:'人与社会 · People and society', descriptionIt:'Persone e società',
  },
  actions: {
    level: 9, name:'动作', nameEn:'Actions', nameIt:'Azioni',
    emoji:'⚡', color:'#E0F7FA', borderColor:'#00838F',
    description:'动作与行为 · Actions and behaviors', descriptionIt:'Azioni e comportamenti',
  },
  objects: {
    level: 10, name:'器物', nameEn:'Objects', nameIt:'Oggetti',
    emoji:'🏺', color:'#FFF3E0', borderColor:'#E65100',
    description:'日常器物 · Everyday objects', descriptionIt:'Oggetti quotidiani',
  },
  time: {
    level: 11, name:'时间', nameEn:'Time', nameIt:'Tempo',
    emoji:'⏰', color:'#E8F5E9', borderColor:'#1B5E20',
    description:'时间与季节 · Time and seasons', descriptionIt:'Tempo e stagioni',
  },
  places: {
    level: 12, name:'地点', nameEn:'Places', nameIt:'Luoghi',
    emoji:'🗺', color:'#FBE9E7', borderColor:'#BF360C',
    description:'地理与空间 · Geography and space', descriptionIt:'Geografia e spazio',
  },

  // ───────────────────────────────────────────────────────
  // HSK 考试路径 (2021 新标准)
  // ───────────────────────────────────────────────────────
  hsk_1: {
    level: 100, name:'HSK 一级', nameEn:'HSK 1', nameIt:'HSK 1',
    emoji:'🎯', color:'#FFF8E1', borderColor:'#F57F17',
    description:'入门 300 字 · Beginner 300', descriptionIt:'Base 300 caratteri',
  },
  hsk_2: {
    level: 101, name:'HSK 二级', nameEn:'HSK 2', nameIt:'HSK 2',
    emoji:'🎯', color:'#FFECB3', borderColor:'#F57F17',
    description:'累计 600 字 · Elementary 600', descriptionIt:'Base 600',
  },
  hsk_3: {
    level: 102, name:'HSK 三级', nameEn:'HSK 3', nameIt:'HSK 3',
    emoji:'🎯', color:'#FFD54F', borderColor:'#F57F17',
    description:'累计 900 字 · Intermediate 900', descriptionIt:'Intermedio 900',
  },
  hsk_4: {
    level: 103, name:'HSK 四级', nameEn:'HSK 4', nameIt:'HSK 4',
    emoji:'🎯', color:'#FFCA28', borderColor:'#F57F17',
    description:'累计 1200 字 · Intermediate+ 1200', descriptionIt:'Intermedio+ 1200',
  },
  hsk_5: {
    level: 104, name:'HSK 五级', nameEn:'HSK 5', nameIt:'HSK 5',
    emoji:'🎯', color:'#FFB300', borderColor:'#F57F17',
    description:'累计 1500 字 · Advanced 1500', descriptionIt:'Avanzato 1500',
  },
  hsk_6: {
    level: 105, name:'HSK 六级', nameEn:'HSK 6', nameIt:'HSK 6',
    emoji:'🎯', color:'#FF8F00', borderColor:'#E65100',
    description:'累计 1800 字 · Proficient 1800', descriptionIt:'Esperto 1800',
  },

  // ───────────────────────────────────────────────────────
  // 暨南中文 修订版 (12 册)
  // ───────────────────────────────────────────────────────
  jinan_1: {
    level: 200, name:'暨南一册', nameEn:'Jinan 1', nameIt:'Jinan 1',
    emoji:'📕', color:'#FFEBEE', borderColor:'#C62828',
    description:'暨南中文修订版 · 第一册',
    descriptionIt:'Jinan Cinese Rivisto · Volume 1',
  },
  jinan_2: {
    level: 201, name:'暨南二册', nameEn:'Jinan 2', nameIt:'Jinan 2',
    emoji:'📗', color:'#E8F5E9', borderColor:'#2E7D32',
    description:'暨南中文修订版 · 第二册',
    descriptionIt:'Jinan Cinese Rivisto · Volume 2',
  },
  jinan_3: {
    level: 202, name:'暨南三册', nameEn:'Jinan 3', nameIt:'Jinan 3',
    emoji:'📘', color:'#E3F2FD', borderColor:'#1565C0',
    description:'暨南中文修订版 · 第三册',
    descriptionIt:'Jinan Cinese Rivisto · Volume 3',
  },
  jinan_4: {
    level: 203, name:'暨南四册', nameEn:'Jinan 4', nameIt:'Jinan 4',
    emoji:'📙', color:'#FFF3E0', borderColor:'#E65100',
    description:'暨南中文修订版 · 第四册',
    descriptionIt:'Jinan Cinese Rivisto · Volume 4',
  },
  // 第 5-12 册在需要时再加
};

// Map a DB row → char object the app expects
function rowToChar(row) {
  return {
    c:        row.glyph_modern,
    p:        row.pinyin       || '',
    m:        row.meaning_en   || '',
    mz:       row.meaning_zh   || '',
    mi:       row.meaning_it   || '',
    mn:       row.mnemonic_en  || '',
    strokes:  row.stroke_count || 0,
    difficulty: row.difficulty || 1,
    etymology:  row.etymology  || '',
    radical:    row.radical    || '',
    exampleZh:  row.example_word_zh || '',
    exampleEn:  row.example_word_en || '',
    set_id:     row.set_id     || 'unknown',
    id:         row.id,
  };
}

// Group flat rows → SETS array
function buildSets(rows) {
  const grouped = {};
  for (const row of rows) {
    const sid = row.set_id || 'unknown';
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push(rowToChar(row));
  }

  return Object.entries(grouped)
    .map(([sid, chars]) => {
      const meta = SET_META[sid] || {
        level: 99,
        name: sid, nameEn: sid, nameIt: sid,
        emoji: '📖', color: '#F5F5F5', borderColor: '#9E9E9E',
        description: sid, descriptionIt: sid,
      };
      return {
        id: sid,
        ...meta,
        // Self-adaptive Level 1: simple chars first (stroke count ASC, then difficulty)
        chars: chars.sort((a, b) => {
          const sa = a.strokes || a.stroke_count || 99;
          const sb = b.strokes || b.stroke_count || 99;
          if (sa !== sb) return sa - sb;
          return (a.difficulty || 1) - (b.difficulty || 1);
        }),
      };
    })
    .sort((a, b) => a.level - b.level);
}

export function useCharacters() {
  const [sets,    setSets]    = useState(STATIC_SETS);  // start with static data
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [source,  setSource]  = useState('static');     // 'static' | 'supabase'

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('jgw_characters')
          .select('*')
          .order('set_id')
          .order('difficulty')
          .limit(1000);

        if (cancelled) return;

        if (err) throw err;
        if (!data || data.length === 0) throw new Error('No characters in DB');

        const built = buildSets(data);
        setSets(built);
        setSource('supabase');
      } catch (e) {
        if (!cancelled) {
          console.warn('useCharacters: falling back to static data.', e.message);
          setError(e.message);
          setSource('static');
          // Keep STATIC_SETS already set above
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { sets, loading, error, source };
}
