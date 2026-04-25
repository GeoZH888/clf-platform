// CLF Heritage Chinese Learning Platform
// src/admin/GrammarPointBatchPanel.jsx
//
// AI-only batch generation for clf_grammar_topics.
// Schema-aligned with GrammarAdminTab.jsx EMPTY_TOPIC:
//   id (PK, slug-style) · title_zh · title_en · title_it ·
//   level · order_idx · explanation · examples (jsonb[])

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

// ─── theme (mirrors GrammarAdminTab V) ──────────────────────────────────────
const V = {
  bg: "#fdf6e3",
  card: "#fff",
  border: "#e8d5b0",
  text: "#1a0a05",
  text2: "#6b4c2a",
  text3: "#a07850",
  accent: "#7B3F3F",
  accentLight: "#F5E8E8",
  green: "#2E7D32",
  red: "#c62828",
};

// ─── config ─────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: "anthropic",       label: "Claude Sonnet 4.5",  model: "claude-sonnet-4-5",     keyId: "anthropic" },
  { id: "anthropic-opus",  label: "Claude Opus 4.5",    model: "claude-opus-4-5",       keyId: "anthropic" },
  { id: "openai",          label: "GPT-4o",             model: "gpt-4o",                keyId: "openai"    },
  { id: "deepseek",        label: "DeepSeek",           model: "deepseek-chat",         keyId: "deepseek"  },
];

const LEVEL_GUIDE = `LEVELING (5 tiers, calibrated against HSK + heritage learner reality):
L1 — HSK1. 是/有 sentences, basic SVO, pronouns, numbers, dates, 吗 questions.
L2 — HSK2-3. Comparison (A 比 B), aspect particles (了/过/着), 是…的, basic complements.
L3 — HSK3-4. 把字句, reduplication, directional/result complements, 要是…就…, 因为…所以….
L4 — HSK4-5. 被字句, 虽然…但是…, 越…越…, 不但…而且…, purpose/concession structures.
L5 — HSK5-6+. Formal/written register, 之所以…是因为, advanced subordination, idiomatic 4-char patterns.`;

const SYSTEM_RULES = `You generate grammar-topic entries for a Chinese learning
platform aimed at heritage learners (Chinese diaspora children in Italy) and
Italian L2 learners.

${LEVEL_GUIDE}

For each grammar topic output ONE JSON object with EXACTLY these fields:
- id          : lowercase pinyin slug, words joined by underscores (e.g. "ba_zi_ju").
                This is also the database primary key. Must be unique.
- title_zh    : Chinese title, short (e.g. "把字句")
- title_en    : English title (e.g. "Disposal: 把")
- title_it    : Italian title (e.g. "Frase con 把")
- level       : integer 1–5 (use the LEVELING guide above)
- order_idx   : integer, default 0
- explanation : 2–4 lines of Markdown. Start with **结构**: <pattern>, then a
                one-line usage note. Tight — students read on phones.
- examples    : array of 4 sentences. Each: { zh, pinyin, en, it }.

QUALITY RULES (non-negotiable):
- Pinyin uses tone marks (ā á ǎ à), never numbers.
- Examples must be natural, not textbook-awkward. Realistic settings:
  family, school, food, travel, friends.
- Italian translations: idiomatic Italian, not word-for-word.
- English translations: idiomatic, not literal.
- Order examples simple → varied use.
- Each example must clearly illustrate the target structure.

Output ONLY a JSON array. No markdown fences. No preamble. No trailing prose.`;

// ─── prompt builders ────────────────────────────────────────────────────────
function buildPrompt({ userInput, count, level, existingIds }) {
  const avoid = existingIds.length
    ? `\nAVOID these ids (already in database): ${existingIds.join(", ")}`
    : "";
  const levelHint = level ? `\nTarget level: L${level}.` : "";
  const countHint = count ? `\nGenerate exactly ${count} grammar topics.` : "";

  return `${SYSTEM_RULES}
${avoid}${levelHint}${countHint}

User request:
"""
${userInput.trim()}
"""

If the request is a list of ids/slugs, generate one entry per id.
If the request is a theme or empty (auto-fill mode), invent appropriate
grammar topics for the target level that AREN'T in the avoid list.

Return ONLY the JSON array.`;
}

function buildSinglePrompt({ id, level, existingIds }) {
  const avoid = existingIds.filter((s) => s !== id);
  return `${SYSTEM_RULES}

AVOID these ids: ${avoid.join(", ")}

Regenerate the grammar topic with id "${id}" at level L${level || "auto"}.
Return a JSON array with exactly ONE object.`;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const EMPTY_DRAFT = {
  id: "",
  title_zh: "",
  title_en: "",
  title_it: "",
  level: 1,
  order_idx: 0,
  explanation: "",
  examples: [],
};

function extractJsonArray(s) {
  const cleaned = s.replace(/```(?:json)?/gi, "").trim();
  const first = cleaned.indexOf("[");
  const last = cleaned.lastIndexOf("]");
  if (first === -1 || last === -1 || last < first)
    throw new Error("响应中未找到 JSON 数组");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function validateDraft(d) {
  const errs = [];
  if (!d.id || !/^[a-z0-9_]+$/.test(d.id))
    errs.push("id 必须小写+下划线");
  if (!d.title_zh) errs.push("缺少中文标题");
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > 5)
    errs.push("level 必须 1–5");
  if (!Array.isArray(d.examples) || d.examples.length === 0)
    errs.push("缺少例句");
  return errs;
}

// Browser-direct API call.
// Bypasses Netlify Functions entirely (no 26s/100s timeout limit on long generations).
// Uses admin's locally-stored API key from ApiKeyManager (`admin_key_<keyId>`).
async function callAi(provider, prompt) {
  const cfg = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const apiKey =
    (typeof window !== "undefined" && window._getAdminKey?.(cfg.keyId)) ||
    localStorage.getItem(`admin_key_${cfg.keyId}`) ||
    "";
  if (!apiKey) {
    throw new Error(
      `请先在 "🔑 API Keys" 标签页填入 ${cfg.label} 对应的 ${cfg.keyId} key`
    );
  }

  // Anthropic (Claude) — direct browser call, supports CORS
  if (cfg.keyId === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Anthropic ${r.status}: ${err}`);
    }
    const data = await r.json();
    return data?.content?.[0]?.text || "";
  }

  // OpenAI
  if (cfg.keyId === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`OpenAI ${r.status}: ${err}`);
    }
    const data = await r.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  // DeepSeek
  if (cfg.keyId === "deepseek") {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`DeepSeek ${r.status}: ${err}`);
    }
    const data = await r.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  throw new Error(`未知 provider: ${cfg.keyId}`);
}

// ─── styles ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "5px 8px",
  fontSize: 12,
  border: `1px solid ${V.border}`,
  borderRadius: 5,
  boxSizing: "border-box",
  background: V.card,
  color: V.text,
};

const btnPrimary = (disabled = false) => ({
  padding: "6px 12px",
  fontSize: 12,
  background: V.accent,
  color: "#fff",
  border: "none",
  borderRadius: 5,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontFamily: "'STKaiti','KaiTi',serif",
  letterSpacing: 1,
});

// ─── main component ─────────────────────────────────────────────────────────
export default function GrammarPointBatchPanel({ onSaved }) {
  const [provider, setProvider] = useState("claude");
  const [userInput, setUserInput] = useState("");
  const [count, setCount] = useState(5);
  const [targetLevel, setTargetLevel] = useState(0);

  const [existing, setExisting] = useState([]); // [{id, level}]
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [regenIndex, setRegenIndex] = useState(null);
  const [msg, setMsg] = useState(null);

  // ── load existing on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("clf_grammar_topics")
        .select("id, level");
      if (error) {
        setMsg({ kind: "err", text: `加载现有数据失败: ${error.message}` });
        return;
      }
      setExisting(data || []);
    })();
  }, []);

  const existingIds = useMemo(() => existing.map((e) => e.id), [existing]);
  const countsByLevel = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    existing.forEach((e) => {
      if (c[e.level] !== undefined) c[e.level]++;
    });
    return c;
  }, [existing]);

  const validation = useMemo(
    () => drafts.map((d) => validateDraft(d)),
    [drafts]
  );
  const allValid = drafts.length > 0 && validation.every((e) => e.length === 0);

  // ── generation ────────────────────────────────────────────────────────────
  async function generate({ input, n, level }) {
    setBusy(true);
    setMsg(null);
    try {
      const prompt = buildPrompt({
        userInput: input,
        count: n,
        level,
        existingIds,
      });
      const raw = await callAi(provider, prompt);
      const parsed = extractJsonArray(raw);
      if (!Array.isArray(parsed)) throw new Error("AI 未返回数组");
      const fresh = parsed.filter((p) => !existingIds.includes(p.id));
      const merged = fresh.map((p) => ({ ...EMPTY_DRAFT, ...p }));
      setDrafts((prev) => [...prev, ...merged]);
      const dropped = parsed.length - fresh.length;
      setMsg({
        kind: "ok",
        text: `生成了 ${merged.length} 条草稿${
          dropped ? `（${dropped} 条与现有重复，已过滤）` : ""
        }`,
      });
    } catch (e) {
      setMsg({ kind: "err", text: `生成失败：${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  function handleGenerateCustom() {
    if (!userInput.trim() && targetLevel === 0) {
      setMsg({ kind: "err", text: "请输入主题或选择目标级别" });
      return;
    }
    generate({
      input: userInput || `auto-fill level ${targetLevel}`,
      n: count,
      level: targetLevel || null,
    });
  }

  function handleQuickFill(level, n = 5) {
    generate({
      input: `Auto-fill grammar topics for L${level} that aren't already present.`,
      n,
      level,
    });
  }

  // ── per-card regenerate ───────────────────────────────────────────────────
  async function regenerateCard(index) {
    const draft = drafts[index];
    if (!draft.id) {
      setMsg({ kind: "err", text: "请先填写 id" });
      return;
    }
    setRegenIndex(index);
    setMsg(null);
    try {
      const prompt = buildSinglePrompt({
        id: draft.id,
        level: draft.level,
        existingIds,
      });
      const raw = await callAi(provider, prompt);
      const parsed = extractJsonArray(raw);
      if (!parsed[0]) throw new Error("AI 未返回有效结果");
      setDrafts((arr) =>
        arr.map((d, i) => (i === index ? { ...EMPTY_DRAFT, ...parsed[0] } : d))
      );
      setMsg({ kind: "ok", text: `已重新生成 ${draft.id}` });
    } catch (e) {
      setMsg({ kind: "err", text: `重新生成失败：${e.message}` });
    } finally {
      setRegenIndex(null);
    }
  }

  // ── draft edits ───────────────────────────────────────────────────────────
  function patchDraft(i, patch) {
    setDrafts((arr) => arr.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }
  function removeDraft(i) {
    setDrafts((arr) => arr.filter((_, j) => j !== i));
  }
  function clearAll() {
    setDrafts([]);
    setMsg(null);
  }

  // ── bulk save ─────────────────────────────────────────────────────────────
  async function handleSaveAll() {
    if (!allValid) {
      setMsg({ kind: "err", text: "请先修正校验错误" });
      return;
    }
    setBusy(true);
    try {
      const payload = drafts.map((d) => ({
        id: d.id.trim(),
        title_zh: d.title_zh.trim(),
        title_en: d.title_en?.trim() || null,
        title_it: d.title_it?.trim() || null,
        level: Number(d.level) || 1,
        order_idx: Number(d.order_idx) || 0,
        explanation: d.explanation || null,
        examples: d.examples || [],
      }));
      const { data, error } = await supabase
        .from("clf_grammar_topics")
        .upsert(payload, { onConflict: "id" })
        .select();
      if (error) throw error;
      setMsg({ kind: "ok", text: `已保存 ${data.length} 条语法点` });
      setExisting((prev) => [
        ...prev.filter((e) => !drafts.some((d) => d.id === e.id)),
        ...data.map((d) => ({ id: d.id, level: d.level })),
      ]);
      setDrafts([]);
      onSaved?.(data);
    } catch (e) {
      setMsg({ kind: "err", text: `保存失败：${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: V.bg,
        border: `1px solid ${V.border}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: V.accent,
            fontFamily: "'STKaiti','KaiTi',serif",
            letterSpacing: 2,
            fontWeight: 500,
          }}
        >
          🪄 AI 批量生成语法点
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{ ...inputStyle, width: "auto" }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* gap analysis */}
      <div
        style={{
          background: V.card,
          border: `1px solid ${V.border}`,
          borderRadius: 6,
          padding: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, color: V.text3, marginBottom: 6 }}>
          数据库现状（{existing.length} 条）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((lv) => (
            <div
              key={lv}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                background: V.accentLight,
                borderRadius: 5,
                fontSize: 11,
              }}
            >
              <span style={{ color: V.accent, fontWeight: 500 }}>L{lv}</span>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                {countsByLevel[lv]}
              </span>
              <button
                onClick={() => handleQuickFill(lv, 5)}
                disabled={busy}
                style={{
                  ...btnPrimary(busy),
                  padding: "2px 6px",
                  fontSize: 10,
                  letterSpacing: 0,
                }}
              >
                +5
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* custom prompt */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>
          自定义生成（每行一个 id，或一句主题描述）
        </div>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={3}
          placeholder={"ba_zi_ju\nbei_zi_ju\n或：二级里关于比较和对比的语法"}
          style={{
            ...inputStyle,
            fontFamily: "ui-monospace, monospace",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 11, color: V.text3 }}>数量</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 5)}
            style={{ ...inputStyle, width: 60 }}
          />
          <span style={{ fontSize: 11, color: V.text3 }}>级别</span>
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(parseInt(e.target.value, 10))}
            style={{ ...inputStyle, width: "auto" }}
          >
            <option value={0}>Auto</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                L{n}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateCustom}
            disabled={busy}
            style={{ ...btnPrimary(busy), marginLeft: "auto" }}
          >
            {busy ? "生成中…" : "🪄 生成"}
          </button>
        </div>
      </div>

      {/* status */}
      {msg && (
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            fontSize: 11,
            marginBottom: 10,
            background: msg.kind === "ok" ? "#e8f5e9" : "#ffebee",
            color: msg.kind === "ok" ? V.green : V.red,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* drafts */}
      {drafts.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: V.accent, fontWeight: 500 }}>
              草稿审阅（{drafts.length}）
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={clearAll}
                disabled={busy}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  background: V.card,
                  color: V.text2,
                  border: `1px solid ${V.border}`,
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                清空
              </button>
              <button
                onClick={handleSaveAll}
                disabled={busy || !allValid}
                style={btnPrimary(busy || !allValid)}
              >
                {busy ? "保存中…" : `💾 保存全部 (${drafts.length})`}
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {drafts.map((d, i) => (
              <DraftCard
                key={i}
                draft={d}
                errors={validation[i]}
                regenerating={regenIndex === i}
                onChange={(patch) => patchDraft(i, patch)}
                onRegenerate={() => regenerateCard(i)}
                onRemove={() => removeDraft(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── single-draft editor ────────────────────────────────────────────────────
function DraftCard({
  draft,
  errors,
  regenerating,
  onChange,
  onRegenerate,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const bad = errors.length > 0;

  return (
    <div
      style={{
        background: V.card,
        border: `1px solid ${bad ? V.red : V.border}`,
        borderRadius: 5,
        padding: 8,
        opacity: regenerating ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            padding: "2px 6px",
            background: V.accentLight,
            color: V.accent,
            borderRadius: 3,
            fontWeight: 500,
          }}
        >
          L{draft.level}
        </span>
        <input
          value={draft.id}
          onChange={(e) => onChange({ id: e.target.value })}
          placeholder="id"
          style={{
            ...inputStyle,
            width: 160,
            fontFamily: "ui-monospace, monospace",
          }}
        />
        <input
          value={draft.title_zh}
          onChange={(e) => onChange({ title_zh: e.target.value })}
          placeholder="中文标题"
          style={{
            ...inputStyle,
            flex: 1,
            fontFamily: "'STKaiti','KaiTi',serif",
          }}
        />
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          title="用 AI 重新生成这一条"
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: V.text2,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: regenerating ? "not-allowed" : "pointer",
          }}
        >
          {regenerating ? "…" : "🔁"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "transparent",
            color: V.text2,
            border: `1px solid ${V.border}`,
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {open ? "收起" : "展开"}
        </button>
        <button
          onClick={onRemove}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "transparent",
            color: V.red,
            border: `1px solid ${V.border}`,
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          删除
        </button>
      </div>

      {bad && (
        <div style={{ marginTop: 4, fontSize: 10, color: V.red }}>
          ⚠️ {errors.join(" · ")}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              value={draft.title_en}
              onChange={(e) => onChange({ title_en: e.target.value })}
              placeholder="English title"
              style={inputStyle}
            />
            <input
              value={draft.title_it}
              onChange={(e) => onChange({ title_it: e.target.value })}
              placeholder="Titolo italiano"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <select
              value={draft.level}
              onChange={(e) =>
                onChange({ level: parseInt(e.target.value, 10) })
              }
              style={inputStyle}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Level {n}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={draft.order_idx}
              onChange={(e) =>
                onChange({ order_idx: parseInt(e.target.value, 10) || 0 })
              }
              placeholder="order_idx"
              style={inputStyle}
            />
          </div>
          <textarea
            value={draft.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            rows={3}
            placeholder="讲解 (Markdown)"
            style={{
              ...inputStyle,
              fontFamily: "ui-monospace, monospace",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 10, color: V.text3 }}>
            例句 ({draft.examples?.length || 0})
          </div>
          <textarea
            value={JSON.stringify(draft.examples, null, 2)}
            onChange={(e) => {
              try {
                onChange({ examples: JSON.parse(e.target.value) });
              } catch {
                /* ignore until valid */
              }
            }}
            rows={6}
            style={{
              ...inputStyle,
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              resize: "vertical",
            }}
          />
        </div>
      )}
    </div>
  );
}
