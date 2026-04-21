// netlify/functions/batch-translate-mnemonics.js
// One-shot batch-filler for jgw_characters with missing mnemonic_zh / mnemonic_it.
//
// Usage: POST to /.netlify/functions/batch-translate-mnemonics
// Body: { "dry_run": false }  // set true to preview without writing
//
// Reads all characters where mnemonic_en is present but mnemonic_zh or mnemonic_it
// is null/empty, asks Claude to translate in batches of 5, writes back to DB.

import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const { dry_run = false } = JSON.parse(event.body || '{}');

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // service key bypasses RLS
  );

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
  }

  // Fetch characters missing either Chinese or Italian mnemonic
  const { data: chars, error: fetchErr } = await supabase
    .from('jgw_characters')
    .select('id, glyph_modern, meaning_en, mnemonic_en, mnemonic_zh, mnemonic_it')
    .not('mnemonic_en', 'is', null)
    .or('mnemonic_zh.is.null,mnemonic_it.is.null');

  if (fetchErr) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: fetchErr.message }) };
  }

  if (!chars || chars.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, updated: 0, message: 'Nothing to fill.' }) };
  }

  const results = { processed: 0, updated: 0, failed: [], preview: [] };

  // Process 5 at a time to keep prompt sizes manageable
  for (let i = 0; i < chars.length; i += 5) {
    const batch = chars.slice(i, i + 5);

    const prompt = `Translate these English memory mnemonics for Chinese characters into Simplified Chinese and Italian. Each mnemonic is a 1-sentence memory hook connecting the character's SHAPE to its MEANING. Keep translations concise and preserve the shape-meaning link.

Return ONLY a valid JSON array. No markdown, no explanation.

Input:
${JSON.stringify(batch.map(c => ({ id: c.id, glyph: c.glyph_modern, meaning: c.meaning_en, mnemonic_en: c.mnemonic_en })), null, 2)}

Output format:
[
  { "id": "...", "mnemonic_zh": "Simplified Chinese translation", "mnemonic_it": "Italian translation" },
  ...
]`;

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error.message);

      const text = aiData.content?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      const parsed = JSON.parse(match[0]);

      for (const row of parsed) {
        const original = batch.find(b => b.id === row.id);
        if (!original) continue;

        // Only write fields that were previously empty
        const update = {};
        if (!original.mnemonic_zh && row.mnemonic_zh) update.mnemonic_zh = row.mnemonic_zh;
        if (!original.mnemonic_it && row.mnemonic_it) update.mnemonic_it = row.mnemonic_it;

        if (Object.keys(update).length > 0) {
          if (dry_run) {
            results.preview.push({ id: row.id, glyph: original.glyph_modern, ...update });
          } else {
            const { error: updErr } = await supabase
              .from('jgw_characters')
              .update(update)
              .eq('id', row.id);
            if (updErr) {
              results.failed.push({ id: row.id, error: updErr.message });
            } else {
              results.updated++;
            }
          }
        }
        results.processed++;
      }
    } catch (e) {
      results.failed.push({ batch: i, error: e.message });
    }

    // Gentle rate-limiting between batches
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      dry_run,
      total_chars_needing_fill: chars.length,
      ...results,
    }, null, 2),
  };
};
