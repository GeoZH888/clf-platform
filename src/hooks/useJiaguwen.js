/**
 * src/hooks/useJiaguwen.js
 * OFFLINE MODE — no Supabase, uses local characters.js data only
 */
import { useState, useEffect, useCallback } from 'react';
import { getLocalChar, getAllLocalChars } from '../data/localCharDB.js';

export function useCharacter(glyph) {
  const local = getLocalChar(glyph);
  return {
    data: local ? { character: local } : null,
    loading: false,
    error: null,
  };
}

export function useCharacters({ type, limit = 100 } = {}) {
  let chars = getAllLocalChars();
  if (type) chars = chars.filter(c => c.pictograph_type === type);
  return { characters: chars.slice(0, limit), loading: false };
}

export function useCharacterSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback((query) => {
    if (!query?.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const found = getAllLocalChars().filter(c =>
      c.glyph_modern?.includes(q) ||
      c.pinyin?.toLowerCase().includes(q) ||
      c.meaning_en?.toLowerCase().includes(q) ||
      c.meaning_zh?.includes(q) ||
      c.meaning_it?.toLowerCase().includes(q)
    );
    setResults(found);
  }, []);

  return { results, loading, search };
}
