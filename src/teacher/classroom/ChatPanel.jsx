// src/teacher/classroom/ChatPanel.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage b1.1 — placeholder. Stage b1.2 will implement the chat UI + send.
// For now: shows the conversation header and any existing messages.
// ════════════════════════════════════════════════════════════════════════════

const C = {
  text: '#1a0a05', muted: '#94714d', border: '#e8d5b0',
  bg: '#fdf6e3', cardBg: '#fff',
  userBubble: '#fef3e2', assistantBubble: '#f5e9d0',
};

export default function ChatPanel({ conversation, messages, loading }) {
  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          💬 {conversation?.title || '新对话 / New conversation'}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {messages.length > 0
            ? `${messages.length} 条消息`
            : '还没有消息 — 等待 Stage b1.2 实装'}
        </div>
      </div>

      <div style={S.messages}>
        {loading && (
          <div style={S.empty}>加载中…</div>
        )}

        {!loading && messages.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💭</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              还没有消息
            </div>
            <div style={{ fontSize: 11 }}>
              聊天功能将在 Stage b1.2 实装。<br/>
              当前只验证：选择班级 → 创建对话记录。
            </div>
          </div>
        )}

        {!loading && messages.map(m => (
          <Bubble key={m.id} message={m} />
        ))}
      </div>

      <div style={S.composer}>
        <textarea
          style={S.input}
          placeholder="输入功能将在 Stage b1.2 启用…"
          disabled
        />
        <button style={S.sendBtn} disabled>
          发送
        </button>
      </div>
    </div>
  );
}

function Bubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '78%',
        padding: '8px 12px',
        borderRadius: 10,
        background: isUser ? C.userBubble : C.assistantBubble,
        fontSize: 13, lineHeight: 1.5, color: C.text,
        whiteSpace: 'pre-wrap',
      }}>
        {message.content || <em style={{ color: C.muted }}>(empty)</em>}
      </div>
    </div>
  );
}

const S = {
  root: {
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column',
    background: C.bg,
    borderRight: `1px solid ${C.border}`,
  },
  header: {
    padding: '12px 18px',
    borderBottom: `1px solid ${C.border}`,
    background: C.cardBg,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },
  empty: {
    textAlign: 'center',
    color: C.muted,
    padding: '40px 20px',
  },
  composer: {
    borderTop: `1px solid ${C.border}`,
    padding: '10px 14px',
    display: 'flex', gap: 8,
    background: C.cardBg,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: 36, maxHeight: 100,
    background: '#f5e9d0',
    cursor: 'not-allowed',
  },
  sendBtn: {
    padding: '0 18px',
    background: '#d4c4a0',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13, fontWeight: 600,
    cursor: 'not-allowed',
  },
};
