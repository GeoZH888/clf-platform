// src/teacher/classroom/WorkspacePanel.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage b1.1 — placeholder. Stage b1.3 will implement live editing + AI tools.
// For now: shows the lesson plan record so we can confirm DB writes work.
// ════════════════════════════════════════════════════════════════════════════

const C = {
  text: '#1a0a05', muted: '#94714d', border: '#e8d5b0',
  cardBg: '#fff', sectionBg: '#fdfaf3',
  primary: '#c41e3a',
};

export default function WorkspacePanel({ plan, loading }) {
  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>📋 课时计划</div>
        <div style={{ fontSize: 11, color: C.muted }}>Lesson Plan</div>
      </div>

      <div style={S.body}>
        {loading && <div style={S.empty}>加载中…</div>}

        {!loading && !plan && (
          <div style={S.empty}>选择班级以创建课时计划</div>
        )}

        {!loading && plan && (
          <>
            <Section title="📌 基本信息 / Meta">
              <Field label="标题 / Title" value={plan.title} />
              <Field label="主题 / Topic" value={plan.topic} />
              <Field label="HSK 等级" value={plan.hsk_level} />
              <Field label="时长 / Duration" value={plan.duration_min ? `${plan.duration_min} 分钟` : null} />
              <Field label="状态 / Status">
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: '#fef3c7', color: '#92400e', fontWeight: 600,
                }}>
                  {plan.status}
                </span>
              </Field>
            </Section>

            <Section title="🎯 教学目标 / Objectives">
              <Empty count={plan.objectives?.length || 0} />
            </Section>

            <Section title="📝 重点词汇 / Vocabulary">
              <Empty count={plan.vocab?.length || 0} />
            </Section>

            <Section title="💬 关键句型 / Key Sentences">
              <Empty count={plan.key_sentences?.length || 0} />
            </Section>

            <Section title="📋 课程大纲 / Outline">
              <Empty count={plan.outline?.length || 0} />
            </Section>

            <div style={S.note}>
              ⏸ 各小节将在 Stage b1.3 通过 AI 工具调用动态填充。
              当前 Stage b1.1 只验证：每个班级 → 创建一个课时计划记录。
            </div>

            <div style={S.savePlaceholder}>
              <button style={S.saveBtn} disabled>
                💾 保存计划 (Stage b1.4)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </div>
  );
}

function Field({ label, value, children }) {
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      <div style={S.fieldValue}>
        {children !== undefined ? children : (value ?? <span style={{ color: C.muted }}>—</span>)}
      </div>
    </div>
  );
}

function Empty({ count }) {
  if (count > 0) {
    return <div style={{ fontSize: 12, color: C.muted }}>{count} 项 (preview not in Stage b1.1)</div>;
  }
  return <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>(empty)</div>;
}

const S = {
  root: {
    width: 380, minWidth: 380,
    height: '100%',
    background: C.cardBg,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 18px',
    borderBottom: `1px solid ${C.border}`,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 16px',
  },
  empty: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 12,
    padding: '40px 20px',
  },
  section: {
    marginBottom: 14,
    background: C.sectionBg,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  sectionTitle: {
    padding: '8px 12px',
    fontSize: 12, fontWeight: 600,
    color: C.text,
    background: '#f5e9d0',
    borderBottom: `1px solid ${C.border}`,
  },
  sectionBody: {
    padding: '10px 12px',
  },
  field: {
    display: 'flex', alignItems: 'baseline',
    gap: 12,
    padding: '4px 0',
    borderBottom: `1px dashed ${C.border}`,
  },
  fieldLabel: {
    fontSize: 11, color: C.muted,
    minWidth: 90,
  },
  fieldValue: {
    flex: 1,
    fontSize: 12, color: C.text,
  },
  note: {
    marginTop: 16,
    padding: '10px 12px',
    fontSize: 11, color: C.muted,
    background: '#f5e9d0',
    borderRadius: 8,
    lineHeight: 1.6,
  },
  savePlaceholder: {
    marginTop: 12,
    textAlign: 'center',
  },
  saveBtn: {
    padding: '10px 22px',
    background: '#d4c4a0',
    color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600,
    cursor: 'not-allowed',
  },
};
