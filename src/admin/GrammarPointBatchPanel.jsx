// CLF Heritage Chinese Learning Platform
// src/components/admin/GrammarPointBatchPanel.jsx
//
// AI-only batch generation for clf_grammar_points.
// Features:
//   • Gap analysis on mount — count per level, one-click "fill L3 +5"
//   • Existing-slug awareness — prompt tells AI what to avoid
//   • Per-card regenerate — fix just one bad draft without redoing the rest
//   • Robust JSON recovery — handles fences, preamble, stray prose
//   • Bulk upsert by slug

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

// ─── config ─────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { id: "claude", label: "Claude (Sonnet 4.6)", model: "claude-sonnet-4-6" },
  { id: "claude-opus", label: "Claude Opus 4.7", model: "claude-opus-4-7" },
  { id: "gpt-4o", label: "GPT-4o", model: "gpt-4o" },
  { id: "deepseek", label: "DeepSeek", model: "deepseek-chat" },
];

const LEVEL_GUIDE = `LEVELING (5 tiers, calibrated against HSK + heritage learner reality):
L1 — HSK1. 是/有 sentences, basic SVO, pronouns, numbers, dates, 吗 questions.
L2 — HSK2-3. Comparison (A 比 B), aspect particles (了/过/着), 是…的, basic complements.
L3 — HSK3-4. 把字句, reduplication, directional/result complements, 要是…就…, 因为…所以….
L4 — HSK4-5. 被字句, 虽然…但是…, 越…越…, 不但…而且…, purpose/concession structures.
L5 — HSK5-6+. Formal/written register, 之所以…是因为, advanced subordination, idiomatic 4-char patterns.`;

const SYSTEM_RULES = `You generate grammar-point entries for a Chinese learning
platform aimed at heritage learners (Chinese diaspora children in Italy) and
Italian L2 learners.

${LEVEL_GUIDE}

For each grammar point output ONE JSON object with EXACTLY these fields:
- slug          : lowercase pinyin, words joined by underscores (e.g. "ba_zi_ju")
- title_zh      : Chinese title, short (e.g. "把字句")
- title_en      : English title (e.g. "Disposal: 把")
- title_it      : Italian title (e.g. "Frase con 把")
- level         : integer 1–5 (use the LEVELING guide above)
- order_in_level: integer, default 0
- explanation_md: 2–4 lines of Markdown. Start with **结构**: <pattern>, then a
                  one-line usage note. Tight — students read on phones.
- examples      : array of 4 sentences. Each: { zh, pinyin, en, it }.

QUALITY RULES (non-negotiable):
- Pinyin uses tone marks (ā á ǎ à), never numbers.
- Examples must be natural, not textbook-awkward. Realistic settings:
  family, school, food, travel, friends.
- Italian translations: idiomatic Italian, not word-for-word from Chinese.
- English translations: idiomatic, not literal.
- Order examples simple → varied use.
- Each example must clearly illustrate the target structure.

Output ONLY a JSON array. No markdown fences. No preamble. No trailing prose.`;

// ─── prompt builders ────────────────────────────────────────────────────────
function buildPrompt({ userInput, count, level, existingSlugs }) {
  const avoid = existingSlugs.length
    ? `\nAVOID these slugs (already in database): ${existingSlugs.join(", ")}`
    : "";
  const levelHint = level ? `\nTarget level: L${level}.` : "";
  const countHint = count ? `\nGenerate exactly ${count} grammar points.` : "";

  return `${SYSTEM_RULES}
${avoid}${levelHint}${countHint}

User request:
"""
${userInput.trim()}
"""

If the request is a list of slugs, generate one entry per slug.
If the request is a theme or empty (auto-fill mode), invent appropriate
grammar points for the target level that AREN'T in the avoid list.

Return ONLY the JSON array.`;
}

function buildSinglePrompt({ slug, level, existingSlugs }) {
  const avoid = existingSlugs.filter((s) => s !== slug);
  return `${SYSTEM_RULES}

AVOID these slugs: ${avoid.join(", ")}

Regenerate the grammar point with slug "${slug}" at level L${level || "auto"}.
Return a JSON array with exactly ONE object.`;
}

// ─── helpers ────────────────────────────────────────────────────────────────
const EMPTY_DRAFT = {
  slug: "",
  title_zh: "",
  title_en: "",
  title_it: "",
  level: 1,
  order_in_level: 0,
  explanation_md: "",
  examples: [],
};

// Defensive JSON extraction — LLMs sometimes wrap or prepend prose.
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
  if (!d.slug || !/^[a-z0-9_]+$/.test(d.slug))
    errs.push("slug 必须小写+下划线");
  if (!d.title_zh) errs.push("缺少中文标题");
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > 5)
    errs.push("level 必须 1–5");
  if (!Array.isArray(d.examples) || d.examples.length === 0)
    errs.push("缺少例句");
  return errs;
}

async function callAi(provider, prompt) {
  const cfg = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const r = await fetch("/.netlify/functions/generate-grammar-points", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, provider: cfg.id, model: cfg.model }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`AI 调用失败 (${r.status}): ${errText}`);
  }
  const data = await r.json();
  if (data?.error) throw new Error(data.error);
  return data.text;
}

// ─── component ──────────────────────────────────────────────────────────────
export default function GrammarPointBatchPanel({ onSaved }) {
  const [provider, setProvider] = useState("claude");
  const [userInput, setUserInput] = useState("");
  const [count, setCount] = useState(5);
  const [targetLevel, setTargetLevel] = useState(0); // 0 = auto

  const [existing, setExisting] = useState([]); // [{slug, level}]
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [regenIndex, setRegenIndex] = useState(null);
  const [msg, setMsg] = useState(null);

  // ── load existing on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("clf_grammar_points")
        .select("slug, level");
      if (error) {
        setMsg({ kind: "err", text: `加载现有数据失败: ${error.message}` });
        return;
      }
      setExisting(data || []);
    })();
  }, []);

  const existingSlugs = useMemo(() => existing.map((e) => e.slug), [existing]);
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
        existingSlugs,
      });
      const raw = await callAi(provider, prompt);
      const parsed = extractJsonArray(raw);
      if (!Array.isArray(parsed)) throw new Error("AI 未返回数组");
      const fresh = parsed.filter((p) => !existingSlugs.includes(p.slug));
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
      setMsg({ kind: "err", text: "请输入主题/slug 列表，或选择目标级别" });
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
      input: `Auto-fill grammar points for L${level} that aren't already present.`,
      n,
      level,
    });
  }

  // ── per-card regenerate ───────────────────────────────────────────────────
  async function regenerateCard(index) {
    const draft = drafts[index];
    if (!draft.slug) {
      setMsg({ kind: "err", text: "请先填写 slug" });
      return;
    }
    setRegenIndex(index);
    setMsg(null);
    try {
      const prompt = buildSinglePrompt({
        slug: draft.slug,
        level: draft.level,
        existingSlugs,
      });
      const raw = await callAi(provider, prompt);
      const parsed = extractJsonArray(raw);
      if (!parsed[0]) throw new Error("AI 未返回有效结果");
      setDrafts((arr) =>
        arr.map((d, i) => (i === index ? { ...EMPTY_DRAFT, ...parsed[0] } : d))
      );
      setMsg({ kind: "ok", text: `已重新生成 ${draft.slug}` });
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
      const { data, error } = await supabase
        .from("clf_grammar_points")
        .upsert(drafts, { onConflict: "slug" })
        .select();
      if (error) throw error;
      setMsg({ kind: "ok", text: `已保存 ${data.length} 条语法点` });
      setExisting((prev) => [
        ...prev.filter((e) => !drafts.some((d) => d.slug === e.slug)),
        ...data.map((d) => ({ slug: d.slug, level: d.level })),
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
    <div className="rounded-2xl bg-[#fdf6e8] p-6 space-y-5">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#7a1c1c]">
          🪄 AI 批量生成语法点
        </h2>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-md border border-[#d9c9a0] bg-white px-2 py-1 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </header>

      {/* ── gap analysis ──────────────────────────────────────────────── */}
      <section className="rounded-lg bg-white/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#7a1c1c]">
          数据库现状（{existing.length} 条）
        </h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((lv) => (
            <div
              key={lv}
              className="flex items-center gap-2 rounded-md border border-[#d9c9a0] bg-white px-3 py-1.5"
            >
              <span className="text-sm text-[#7a1c1c]">L{lv}</span>
              <span className="text-sm font-mono">{countsByLevel[lv]}</span>
              <button
                onClick={() => handleQuickFill(lv, 5)}
                disabled={busy}
                className="text-xs rounded bg-[#c41e3a] text-white px-2 py-0.5 hover:opacity-90 disabled:opacity-40"
              >
                +5
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── custom prompt ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[#7a1c1c]">自定义生成</h3>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={4}
          placeholder={`每行一个 slug，例如：\nba_zi_ju\nbei_zi_ju\n\n或一句主题，例如：\n二级里关于比较和对比的语法`}
          className="w-full rounded-lg border border-[#d9c9a0] bg-white px-3 py-2 font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[#7a1c1c]">数量</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 5)}
            className="w-16 rounded border border-[#d9c9a0] bg-white px-2 py-1 text-sm"
          />
          <label className="text-sm text-[#7a1c1c]">级别</label>
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(parseInt(e.target.value, 10))}
            className="rounded border border-[#d9c9a0] bg-white px-2 py-1 text-sm"
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
            className="ml-auto rounded-lg bg-[#c41e3a] px-4 py-2 text-white text-sm disabled:opacity-50"
          >
            {busy ? "生成中…" : "🪄 生成"}
          </button>
        </div>
      </section>

      {/* ── status ────────────────────────────────────────────────────── */}
      {msg && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ── drafts ────────────────────────────────────────────────────── */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#7a1c1c]">
              草稿审阅（{drafts.length}）
            </h3>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                disabled={busy}
                className="rounded-md border border-[#d9c9a0] bg-white px-3 py-1 text-sm"
              >
                全部清空
              </button>
              <button
                onClick={handleSaveAll}
                disabled={busy || !allValid}
                className="rounded-md bg-[#c41e3a] px-4 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "保存中…" : `💾 保存全部 (${drafts.length})`}
              </button>
            </div>
          </div>
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
        </section>
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
      className={`rounded-lg border bg-white p-3 ${
        bad ? "border-red-300" : "border-[#d9c9a0]"
      } ${regenerating ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs rounded bg-[#fdf6e8] px-2 py-0.5 text-[#7a1c1c]">
          L{draft.level}
        </span>
        <input
          value={draft.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
          placeholder="slug"
          className="font-mono text-sm border-b border-transparent hover:border-[#d9c9a0] focus:border-[#c41e3a] outline-none w-44"
        />
        <input
          value={draft.title_zh}
          onChange={(e) => onChange({ title_zh: e.target.value })}
          placeholder="中文标题"
          className="text-sm border-b border-transparent hover:border-[#d9c9a0] focus:border-[#c41e3a] outline-none flex-1"
        />
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          title="用 AI 重新生成这一条"
          className="text-xs rounded bg-[#7a1c1c] text-white px-2 py-1 hover:opacity-90 disabled:opacity-40"
        >
          {regenerating ? "…" : "🔁"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-[#7a1c1c] hover:underline"
        >
          {open ? "收起" : "展开"}
        </button>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 hover:underline"
        >
          删除
        </button>
      </div>

      {bad && (
        <div className="mt-2 text-xs text-red-600">⚠️ {errors.join(" · ")}</div>
      )}

      {open && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.title_en}
              onChange={(e) => onChange({ title_en: e.target.value })}
              placeholder="English title"
              className="rounded border border-[#d9c9a0] px-2 py-1"
            />
            <input
              value={draft.title_it}
              onChange={(e) => onChange({ title_it: e.target.value })}
              placeholder="Titolo italiano"
              className="rounded border border-[#d9c9a0] px-2 py-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.level}
              onChange={(e) =>
                onChange({ level: parseInt(e.target.value, 10) })
              }
              className="rounded border border-[#d9c9a0] px-2 py-1"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Level {n}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={draft.order_in_level}
              onChange={(e) =>
                onChange({ order_in_level: parseInt(e.target.value, 10) || 0 })
              }
              placeholder="order"
              className="rounded border border-[#d9c9a0] px-2 py-1"
            />
          </div>
          <textarea
            value={draft.explanation_md}
            onChange={(e) => onChange({ explanation_md: e.target.value })}
            rows={3}
            placeholder="讲解 (Markdown)"
            className="w-full rounded border border-[#d9c9a0] px-2 py-1 font-mono text-xs"
          />
          <div className="text-xs text-[#7a1c1c]/70">
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
            rows={8}
            className="w-full rounded border border-[#d9c9a0] px-2 py-1 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
