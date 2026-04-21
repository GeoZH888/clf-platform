// src/admin/AutoPopulate.jsx
// Batch-generate oracle bone characters ordered by difficulty and save to Supabase

import { useState } from "react";
import { supabase } from "../lib/supabase";   // adjust path if needed

const PROVIDERS = [
  { id: "claude",    label: "Claude" },
  { id: "deepseek",  label: "DeepSeek" },
  { id: "openai",    label: "GPT-4o" },
  { id: "gemini",    label: "Gemini" },
];

const CATEGORIES = [
  "all", "nature", "body", "animals", "numbers",
  "actions", "objects", "people", "time", "places",
];

export default function AutoPopulate({ onDone }) {
  const [provider,  setProvider]  = useState("claude");
  const [count,     setCount]     = useState(20);
  const [diffFrom,  setDiffFrom]  = useState(1);
  const [diffTo,    setDiffTo]    = useState(3);
  const [category,  setCategory]  = useState("all");
  const [loading,   setLoading]   = useState(false);
  const [preview,   setPreview]   = useState(null);   // generated list before saving
  const [status,    setStatus]    = useState(null);
  const [progress,  setProgress]  = useState("");

  const setMsg = (type, message) => setStatus({ type, message });

  const BATCH_SIZE = 5;

  async function fetchBatch(batchCount, batchFrom, batchTo, seen) {
    const res = await fetch("/.netlify/functions/ai-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "auto_populate",
        provider,
        count: batchCount,
        difficulty_from: batchFrom,
        difficulty_to: batchTo,
        category,
        exclude: seen,
      }),
    });
    const raw = await res.text();
    if (!raw) throw new Error("Empty response from server.");
    if (raw.trimStart().startsWith("<")) throw new Error(`Server error (${res.status}) — check Netlify function logs.`);
    const data = JSON.parse(raw);
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data.characters || [];
  }

  // ── Step 1: Generate preview (batched) ──────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    setPreview(null);
    setStatus(null);

    // Load all existing characters to avoid duplicates
    const { data: existingRows } = await supabase
      .from('jgw_characters')
      .select('glyph_modern');
    const existingChars = (existingRows || []).map(r => r.glyph_modern).filter(Boolean);

    const total = count;
    const batches = Math.ceil(total / BATCH_SIZE);
    const allChars = [];
    const seen = [...existingChars]; // start with existing to avoid duplicates

    try {
      for (let i = 0; i < batches; i++) {
        const batchCount = Math.min(BATCH_SIZE, total - allChars.length);
        setProgress(`⏳ Batch ${i + 1}/${batches} — generating ${batchCount} characters…`);

        const chars = await fetchBatch(batchCount, diffFrom, diffTo, seen);
        chars.forEach(c => {
          if (c.character) seen.push(c.character);
          allChars.push(c);
        });

        // Show partial results immediately
        setPreview([...allChars]);
      }

      setProgress("");
      setMsg("success", `✅ Generated ${allChars.length} new characters (skipped ${existingChars.length} already in DB). Review below, then click Save.`);
    } catch (err) {
      if (allChars.length > 0) {
        setProgress("");
        setMsg("info", `⚠️ Stopped after ${allChars.length} characters: ${err.message}. You can still save what was generated.`);
      } else {
        setMsg("error", `Generation failed: ${err.message}`);
        setProgress("");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Save to Supabase ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!preview?.length) return;
    setLoading(true);
    setProgress("⏳ Saving to Supabase…");

    try {
      let saved = 0;
      let skipped = 0;

      for (let i = 0; i < preview.length; i++) {
        const ch = preview[i];
        setProgress(`⏳ Saving ${i + 1}/${preview.length}: ${ch.character}`);

        // Skip if character already exists
        const { data: existing } = await supabase
          .from("jgw_characters")
          .select("id")
          .eq("glyph_modern", ch.character)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        const { error } = await supabase.from("jgw_characters").upsert({
          glyph_modern:    ch.character,
          pinyin:          ch.pinyin,
          meaning_en:      ch.meaning_en,
          meaning_zh:      ch.meaning_zh,
          meaning_it:      ch.meaning_it,
          stroke_count:    ch.stroke_count || null,
          radical:         ch.radical,
          mnemonic_en:     ch.mnemonic_en,
          mnemonic_zh:     ch.mnemonic_zh,
          mnemonic_it:     ch.mnemonic_it,
          etymology:       ch.etymology,
          example_word_zh: ch.example_word_zh,
          example_word_en: ch.example_word_en,
          difficulty:      ch.difficulty,
          set_id:          ch.category,
          inscription_count: 0,
        }, { onConflict: 'glyph_modern' });

        if (error) throw new Error(`Failed to save ${ch.character}: ${error.message}`);
        saved++;
      }

      setProgress("");
      setMsg("success", `✅ Saved ${saved} new characters. Skipped ${skipped} duplicates.`);
      setPreview(null);
      if (onDone) onDone();
    } catch (err) {
      setMsg("error", `Save failed: ${err.message}`);
      setProgress("");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="auto-populate">
      <h2>🤖 Auto-Populate Characters</h2>
      <p className="subtitle">Generate batches of oracle bone characters ordered by difficulty and save directly to Supabase.</p>

      <div className="ap-grid">
        {/* Provider */}
        <div className="ap-field">
          <label>AI Provider</label>
          <div className="pills">
            {PROVIDERS.map((p) => (
              <button key={p.id} type="button"
                onClick={() => setProvider(p.id)}
                style={{
                  padding: '.35rem .9rem', borderRadius: 20, cursor: 'pointer',
                  fontSize: '.85rem', border: '1.5px solid',
                  borderColor: provider === p.id ? '#1a1a2e' : '#ccc',
                  background:  provider === p.id ? '#1a1a2e' : '#fff',
                  color:       provider === p.id ? '#fff'    : '#333',
                  fontWeight:  provider === p.id ? 600 : 400,
                  transition: 'all .15s',
                }}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="ap-field">
          <label>Number of characters: <strong>{count}</strong></label>
          <input type="range" min={5} max={50} step={5} value={count}
            onChange={(e) => setCount(Number(e.target.value))} />
          <div className="range-labels"><span>5</span><span>50</span></div>
        </div>

        {/* Difficulty range */}
        <div className="ap-field">
          <label>Difficulty range</label>
          <div className="diff-row">
            <div>
              <span>From</span>
              <div className="pills">
                {[1,2,3,4,5].map((d) => (
                  <button key={d} type="button"
                    className={`pill pill-sm ${diffFrom === d ? "active" : ""}`}
                    onClick={() => setDiffFrom(d)}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div>
              <span>To</span>
              <div className="pills">
                {[1,2,3,4,5].map((d) => (
                  <button key={d} type="button"
                    className={`pill pill-sm ${diffTo === d ? "active" : ""}`}
                    onClick={() => setDiffTo(d)}
                  >{d}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="ap-field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
        {loading && !preview ? "⏳ Generating…" : "✨ Generate Preview"}
      </button>

      {progress && <p className="progress">{progress}</p>}

      {status && (
        <div className={`status-banner status-${status.type}`}>{status.message}</div>
      )}

      {/* Preview table */}
      {preview && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>Preview ({preview.length} characters)</h3>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? "⏳ Saving…" : `💾 Save All to Supabase`}
            </button>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>字</th>
                  <th>Pinyin</th>
                  <th>Meaning EN</th>
                  <th>难度</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((ch, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="char-cell">{ch.character}</td>
                    <td>{ch.pinyin}</td>
                    <td>{ch.meaning_en}</td>
                    <td>
                      <span className={`diff-badge diff-${ch.difficulty}`}>{ch.difficulty}</span>
                    </td>
                    <td>{ch.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .auto-populate { padding: 1.5rem; max-width: 800px; }
        .subtitle { color: #666; margin-top: -.5rem; margin-bottom: 1.5rem; font-size: .9rem; }
        .ap-grid { display: grid; gap: 1.2rem; margin-bottom: 1.5rem; }
        .ap-field label { display: block; font-weight: 600; margin-bottom: .4rem; font-size: .9rem; }
        .ap-field select {
          width: 100%; padding: .5rem; border: 1px solid #ddd;
          border-radius: 6px; font-size: .9rem;
        }
        .pills { display: flex; flex-wrap: wrap; gap: .4rem; }
        .pill {
          padding: .3rem .75rem; border-radius: 20px; border: 1px solid #ccc;
          background: #f5f5f5; cursor: pointer; font-size: .85rem; transition: all .15s;
        }
        .pill-sm { padding: .25rem .55rem; }
        .pill.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
        input[type=range] { width: 100%; accent-color: #1a1a2e; }
        .range-labels { display: flex; justify-content: space-between; font-size: .75rem; color: #999; }
        .diff-row { display: flex; gap: 2rem; }
        .diff-row span { font-size: .8rem; color: #666; display: block; margin-bottom: .3rem; }
        .btn-primary {
          padding: .65rem 1.4rem; background: #1a1a2e; color: #fff;
          border: none; border-radius: 8px; cursor: pointer; font-size: .95rem;
        }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .progress { color: #555; font-size: .9rem; margin: .5rem 0; }
        .status-banner {
          padding: .7rem 1rem; border-radius: 8px; margin: .8rem 0; font-size: .88rem;
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-error   { background: #f8d7da; color: #721c24; }
        .status-info    { background: #d1ecf1; color: #0c5460; }
        .preview-section { margin-top: 1.5rem; }
        .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .8rem; }
        .preview-header h3 { margin: 0; }
        .preview-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; }
        .preview-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
        .preview-table th {
          background: #1a1a2e; color: #fff; padding: .5rem .75rem;
          text-align: left; font-weight: 600;
        }
        .preview-table td { padding: .45rem .75rem; border-bottom: 1px solid #f0f0f0; }
        .preview-table tr:last-child td { border-bottom: none; }
        .preview-table tr:hover td { background: #fafafa; }
        .char-cell { font-size: 1.4rem; font-weight: bold; }
        .diff-badge {
          display: inline-block; width: 24px; height: 24px; border-radius: 50%;
          text-align: center; line-height: 24px; font-size: .8rem; font-weight: bold; color: #fff;
        }
        .diff-1 { background: #4caf50; }
        .diff-2 { background: #8bc34a; }
        .diff-3 { background: #ff9800; }
        .diff-4 { background: #f44336; }
        .diff-5 { background: #9c27b0; }
      `}</style>
    </div>
  );
}
