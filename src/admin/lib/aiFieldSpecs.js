// src/admin/lib/aiFieldSpecs.js
//
// Field specs handed to AiFieldAssistant's "✨ AI 生成" button.
// `hint` is what the model is told the column must contain — write it as an
// instruction, not a label.
//
// Only specs shared by more than one tab live here. A spec used by exactly one
// tab stays next to that tab.

// clf_words and jgw_words carry the same columns.
export const AI_WORD_FIELDS = [
  { key:'pinyin',     label:'拼音',    hint:'Hanyu Pinyin with tone marks, syllables space-separated, e.g. nǐ hǎo' },
  { key:'meaning_en', label:'EN',      hint:'meaning in English, a few words — this is a dictionary gloss, not a sentence' },
  { key:'meaning_it', label:'IT',      hint:'meaning in Italian, a few words' },
  { key:'meaning_zh', label:'中文',    hint:'释义, in Simplified Chinese, one short line' },
  { key:'example_zh', label:'例句',    hint:'one natural example sentence in Simplified Chinese using this word, suitable for a beginner' },
  { key:'example_en', label:'Example', hint:'English translation of the example sentence' },
  { key:'example_it', label:'Esempio', hint:'Italian translation of the example sentence' },
];
