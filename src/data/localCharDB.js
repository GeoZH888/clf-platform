/**
 * src/data/localCharDB.js
 * 
 * Local character database — instant, no network needed.
 * Generated from SETS in characters.js + extended data.
 * 
 * The app uses this first, then Supabase enriches it in background.
 */
import { SETS } from './characters.js';

// Build a flat map of all characters from local SETS
const LOCAL_DB = {};
SETS.forEach(set => {
  set.chars.forEach(char => {
    LOCAL_DB[char.c] = {
      id: char.c,
      glyph_modern: char.c,
      pinyin: char.p,
      meaning_en: char.m,
      meaning_zh: char.mz || '',
      meaning_it: char.mi || '',
      strokes: char.strokes || 0,
      difficulty: char.difficulty || 1,
      compound: char.compound || null,
      set_id: set.id,
      set_name: set.name,
      set_name_en: set.nameEn,
      set_emoji: set.emoji,
      // These come from Supabase when available
      svg_jiaguwen: null,
      mnemonic_svg: null,
      mnemonic_image_url: null,
      mnemonic_story_en: null,
      mnemonic_story_zh: null,
      mnemonic_story_it: null,
    };
  });
});

export function getLocalChar(glyph) {
  return LOCAL_DB[glyph] || null;
}

export function getAllLocalChars() {
  return Object.values(LOCAL_DB);
}

export { LOCAL_DB };
