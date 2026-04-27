// src/admin/RiddleAdminTab.jsx
//
// 灯谜管理 — review pending AI riddles, manage ONE illustration per
// riddle, manually trigger generation, edit/approve/reject.
//
// Simplified from earlier version: only one image per riddle (the
// illustration). The answer is shown as bold text on the reveal screen,
// so a separate answer image was redundant.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import RiddleImageEditorModal from './RiddleImageEditorModal.jsx';

const TABS = [
  { id: 'pending',  label: '待审核',   color: '#FF9800' },
  { id: 'approved', label: '已批准',   color: '#4CAF50' },
  { id: 'rejected', label: '已拒绝',   color: '#9E9E9E' },
  { id: 'low',      label: '低评价',   color: '#F44336' },
];

const LEVEL_LABELS = ['', '1·入门', '2·基础', '3·进阶', '4·中级', '5·高级', '6·专家'];

export default function RiddleAdminTab() {
  const [tab, setTab]               = useState('pending');
  const [riddles, setRiddles]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [editing, setEditing]       = useState(null);
  const [imageEditing, setImageEditing] = useState(null);  // riddle | null
  const [genLevel, setGenLevel]     = useState(1);
  const [genCount, setGenCount]     = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog]         = useState([]);
  const [stats, setStats]           = useState({ pending: 0, approved: 0, rejected: 0, low: 0 });
  const [msg, setMsg]               = useState(null);

  useEffect(() => { loadRiddles(); loadStats(); }, [tab]);

  // Auto-refresh while images are being auto-generated
  useEffect(() => {
    if (tab !== 'approved') return;
    const hasPending = riddles.some(r =>
      !r.illustration_url && r.source === 'ai_generated'
    );
    if (!hasPending) return;
    const t = setTimeout(() => loadRiddles(), 8000);
    return () => clearTimeout(t);
  }, [riddles, tab]);

  async function loadRiddles() {
    setLoading(true);
    let q = supabase
      .from('clf_riddles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (tab === 'pending')       q = q.eq('status', 'pending');
    else if (tab === 'approved') q = q.eq('status', 'approved').eq('source', 'ai_generated');
    else if (tab === 'rejected') q = q.eq('status', 'rejected');
    else if (tab === 'low')      q = q.gte('downvotes', 2);

    const { data, error } = await q;
    if (error) setMsg({ kind: 'error', text: error.message });
    setRiddles(data || []);
    setLoading(false);
  }

  async function loadStats() {
    const counts = await Promise.all([
      supabase.from('clf_riddles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('clf_riddles').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('source', 'ai_generated'),
      supabase.from('clf_riddles').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('clf_riddles').select('id', { count: 'exact', head: true }).gte('downvotes', 2),
    ]);
    setStats({
      pending:  counts[0].count || 0,
      approved: counts[1].count || 0,
      rejected: counts[2].count || 0,
      low:      counts[3].count || 0,
    });
  }

  async function setStatus(id, status) {
    const { error } = await supabase
      .from('clf_riddles')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) setMsg({ kind: 'error', text: error.message });
    else {
      setMsg({ kind: 'success', text: `已${status === 'approved' ? '批准' : status === 'rejected' ? '拒绝' : '更新'}` });
      loadRiddles();
      loadStats();
    }
  }

  async function deleteRiddle(id) {
    if (!confirm('确定永久删除这条灯谜？')) return;
    const { error } = await supabase.from('clf_riddles').delete().eq('id', id);
    if (error) setMsg({ kind: 'error', text: error.message });
    else { loadRiddles(); loadStats(); }
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from('clf_riddles')
      .update({
        riddle_text:   editing.riddle_text,
        answer:        editing.answer,
        category_hint: editing.category_hint,
        explanation:   editing.explanation,
        level:         editing.level,
      })
      .eq('id', editing.id);
    if (error) setMsg({ kind: 'error', text: error.message });
    else {
      setMsg({ kind: 'success', text: '已保存' });
      setEditing(null);
      loadRiddles();
    }
  }

  async function generateBatch() {
    setGenerating(true);
    setGenLog([]);
    let okCount = 0, pendingCount = 0, errCount = 0;

    for (let i = 0; i < genCount; i++) {
      try {
        const res = await fetch('/.netlify/functions/generate-riddle', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ level: genLevel, action: 'generate', force_new: true }),
        });
        const data = await res.json();

        if (data.riddle && data.source === 'ai_generated') {
          okCount++;
          setGenLog(log => [...log, `✓ #${i+1} 已批准: ${data.riddle.riddle_text} → ${data.riddle.answer} (插图生成中...)`]);
        } else if (data.rejected) {
          pendingCount++;
          setGenLog(log => [...log, `⚠ #${i+1} 待审核: ${data.rejected.riddle_text} → ${data.rejected.answer}`]);
        } else {
          errCount++;
          setGenLog(log => [...log, `✗ #${i+1} 失败 (HTTP ${res.status}): ${data.error || data.note || '未知错误'}`]);
        }
      } catch (err) {
        errCount++;
        setGenLog(log => [...log, `✗ #${i+1} 异常: ${err.message}`]);
      }
    }

    setMsg({
      kind: errCount === 0 ? 'success' : 'info',
      text: `生成完成: ${okCount} 已批准 / ${pendingCount} 待审核 / ${errCount} 失败. 插图正在后台生成 (约15秒)`,
    });
    setGenerating(false);
    loadRiddles();
    loadStats();
  }

  return (
    <div style={S.root}>
      <div style={S.titleBar}>
        <h2 style={S.title}>🏮 灯谜管理</h2>
        <div style={S.statsBar}>
          <span style={{...S.statPill, background: '#FFF3E0', color: '#E65100'}}>待审核 {stats.pending}</span>
          <span style={{...S.statPill, background: '#E8F5E9', color: '#2E7D32'}}>已批准(AI) {stats.approved}</span>
          <span style={{...S.statPill, background: '#FAFAFA', color: '#666'}}>已拒绝 {stats.rejected}</span>
          <span style={{...S.statPill, background: '#FFEBEE', color: '#C62828'}}>低评价 {stats.low}</span>
        </div>
      </div>

      <div style={S.genPanel}>
        <div style={S.genControls}>
          <label style={S.label}>难度</label>
          <select value={genLevel} onChange={(e) => setGenLevel(parseInt(e.target.value))} style={S.select}>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{LEVEL_LABELS[n]}</option>)}
          </select>

          <label style={S.label}>数量</label>
          <input
            type="number" min={1} max={20} value={genCount}
            onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
            style={{...S.select, width: 70}}
          />

          <button onClick={generateBatch} disabled={generating} style={generating ? S.btnDisabled : S.btnPrimary}>
            {generating ? `⏳ 生成中 (${genLog.length}/${genCount})` : `✨ 批量生成 ${genCount} 条`}
          </button>
        </div>
        {genLog.length > 0 && (
          <div style={S.genLog}>
            {genLog.map((line, i) => <div key={i} style={S.genLogLine}>{line}</div>)}
          </div>
        )}
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={tab === t.id ? {...S.tabBtn, ...S.tabBtnActive, borderBottomColor: t.color, color: t.color} : S.tabBtn}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={msg.kind === 'error' ? S.statusError : msg.kind === 'info' ? S.statusInfo : S.statusSuccess}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={S.empty}>加载中...</div>
      ) : riddles.length === 0 ? (
        <div style={S.empty}>暂无灯谜</div>
      ) : (
        <div style={S.list}>
          {riddles.map(r => (
            <RiddleRow
              key={r.id}
              riddle={r}
              onApprove={() => setStatus(r.id, 'approved')}
              onReject={()  => setStatus(r.id, 'rejected')}
              onEdit={()    => setEditing({...r})}
              onDelete={()  => deleteRiddle(r.id)}
              onEditImage={() => setImageEditing(r)}
            />
          ))}
        </div>
      )}

      {editing && (
        <div style={S.modalBackdrop} onClick={() => setEditing(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{margin: 0, marginBottom: 16}}>编辑灯谜</h3>

            <label style={S.label}>谜面</label>
            <textarea
              value={editing.riddle_text}
              onChange={(e) => setEditing({...editing, riddle_text: e.target.value})}
              rows={2}
              style={S.textarea}
            />

            <div style={{display: 'flex', gap: 12}}>
              <div style={{flex: 1}}>
                <label style={S.label}>谜底</label>
                <input
                  value={editing.answer}
                  onChange={(e) => setEditing({...editing, answer: e.target.value})}
                  style={S.select}
                />
              </div>
              <div style={{flex: 1}}>
                <label style={S.label}>谜目</label>
                <input
                  value={editing.category_hint || ''}
                  onChange={(e) => setEditing({...editing, category_hint: e.target.value})}
                  style={S.select}
                />
              </div>
              <div style={{width: 100}}>
                <label style={S.label}>难度</label>
                <select
                  value={editing.level}
                  onChange={(e) => setEditing({...editing, level: parseInt(e.target.value)})}
                  style={S.select}
                >
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <label style={S.label}>解释</label>
            <textarea
              value={editing.explanation || ''}
              onChange={(e) => setEditing({...editing, explanation: e.target.value})}
              rows={3}
              style={S.textarea}
            />

            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16}}>
              <button onClick={() => setEditing(null)} style={S.btnSecondary}>取消</button>
              <button onClick={saveEdit} style={S.btnPrimary}>保存</button>
            </div>
          </div>
        </div>
      )}

      {imageEditing && (
        <RiddleImageEditorModal
          riddle={imageEditing}
          onClose={() => setImageEditing(null)}
          onUpdated={() => loadRiddles()}
        />
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function RiddleRow({ riddle, onApprove, onReject, onEdit, onDelete, onEditImage }) {
  const hasImage = !!riddle.illustration_url;

  return (
    <div style={S.row}>
      <div style={S.rowMain}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap'}}>
          <span style={S.levelBadge}>{LEVEL_LABELS[riddle.level]}</span>
          {riddle.source === 'ai_generated' && (
            <span style={{...S.tag, background: '#E8F5E9', color: '#2E7D32'}}>AI</span>
          )}
          {riddle.source === 'seed' && (
            <span style={{...S.tag, background: '#E3F2FD', color: '#1565C0'}}>种子</span>
          )}
          <span style={{...S.tag, background: '#FAFAFA', color: '#666'}}>{riddle.category_hint}</span>
          {(riddle.upvotes > 0 || riddle.downvotes > 0) && (
            <span style={S.votes}>👍{riddle.upvotes} 👎{riddle.downvotes}</span>
          )}
        </div>
        <div style={S.rowText}>{riddle.riddle_text}</div>
        <div style={S.rowAnswer}>
          → <strong>{riddle.answer}</strong>
          {riddle.explanation && <span style={S.rowExpl}> · {riddle.explanation}</span>}
        </div>
      </div>

      {/* Single illustration thumbnail — clicking opens prompt editor */}
      <button
        onClick={onEditImage}
        style={hasImage ? S.thumbBtn : S.thumbEmpty}
        title={hasImage ? '点击编辑提示词重生' : '点击生成插图'}
      >
        {hasImage ? (
          <img src={riddle.illustration_url} alt="插图" style={S.thumbImg} />
        ) : (
          <span style={{ fontSize: 18, color: '#999' }}>🎨</span>
        )}
      </button>

      <div style={S.rowActions}>
        <button
          onClick={onEditImage}
          style={hasImage ? S.btnImageSubtle : S.btnImage}
          title={hasImage ? '编辑提示词重新生成' : '编辑提示词并生成'}
        >
          🎨 {hasImage ? '重生' : '生成'}
        </button>
        {riddle.status === 'pending' && (
          <>
            <button onClick={onApprove} style={S.btnApprove}>✓ 批准</button>
            <button onClick={onReject}  style={S.btnReject}>✗ 拒绝</button>
          </>
        )}
        {riddle.status === 'approved' && (
          <button onClick={onReject} style={S.btnReject}>✗ 撤销</button>
        )}
        {riddle.status === 'rejected' && (
          <button onClick={onApprove} style={S.btnApprove}>↩ 恢复</button>
        )}
        <button onClick={onEdit}   style={S.btnEdit}>✎ 编辑</button>
        <button onClick={onDelete} style={S.btnDelete}>🗑</button>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { padding: 20, maxWidth: 1200, margin: '0 auto' },
  titleBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title: { margin: 0, fontSize: 22, color: '#C62828' },
  statsBar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statPill: { padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  genPanel: { background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8, padding: 14, marginBottom: 16 },
  genControls: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  genLog: { marginTop: 12, padding: 10, background: '#fff', border: '1px solid #eee', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, maxHeight: 200, overflowY: 'auto' },
  genLogLine: { padding: '2px 0' },
  tabs: { display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 12, gap: 4 },
  tabBtn: { padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: 14, color: '#666', fontWeight: 500 },
  tabBtnActive: { fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 12, alignItems: 'center', padding: 14, background: '#fff', border: '1px solid #eee', borderRadius: 8 },
  rowMain: { minWidth: 0 },
  rowText: { fontSize: 15, color: '#333', marginBottom: 4, fontFamily: '"Noto Serif SC", serif' },
  rowAnswer: { fontSize: 13, color: '#666' },
  rowExpl: { color: '#999', fontSize: 12 },
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 },
  levelBadge: { padding: '2px 8px', background: '#FFEBEE', color: '#C62828', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  tag:        { padding: '2px 8px', borderRadius: 10, fontSize: 11 },
  votes:      { fontSize: 12, color: '#888' },
  empty: { padding: 40, textAlign: 'center', color: '#999' },

  thumbBtn: {
    width: 80, height: 80, padding: 0, border: '1px solid #ddd', borderRadius: 6,
    background: '#fff', cursor: 'pointer', overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbEmpty: {
    width: 80, height: 80, padding: 0, border: '1px dashed #ccc', borderRadius: 6,
    background: '#FAFAFA', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  btnPrimary:  { padding: '8px 14px', background: '#C62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary:{ padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnDisabled: { padding: '8px 14px', background: '#bbb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed', fontSize: 13 },
  btnApprove:  { padding: '6px 10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  btnReject:   { padding: '6px 10px', background: '#fff', color: '#F44336', border: '1px solid #F44336', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  btnEdit:     { padding: '6px 10px', background: '#fff', color: '#1976D2', border: '1px solid #1976D2', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  btnDelete:   { padding: '6px 10px', background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  btnImage:    { padding: '6px 10px', background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  btnImageSubtle: { padding: '6px 10px', background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12 },

  label: { fontSize: 12, fontWeight: 600, color: '#A0522D', marginRight: 6 },
  select: { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' },
  textarea: { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 12 },

  statusSuccess: { padding: 10, background: '#D4EDDA', color: '#155724', borderRadius: 6, fontSize: 13, marginBottom: 12 },
  statusError:   { padding: 10, background: '#F8D7DA', color: '#721C24', borderRadius: 6, fontSize: 13, marginBottom: 12 },
  statusInfo:    { padding: 10, background: '#D1ECF1', color: '#0C5460', borderRadius: 6, fontSize: 13, marginBottom: 12 },

  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' },
};
