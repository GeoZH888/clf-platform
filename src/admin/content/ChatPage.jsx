// Stub for chat — use 模块内容 tab to discover schema first.
import React from 'react';

export default function ChatPage() {
  return (
    <div style={{
      padding: 30, background: '#fef3e2', border: '1px solid #f59e0b40',
      borderRadius: 12, color: '#92400e', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        问答聊天 · 待配置
      </div>
      <div style={{ fontSize: 12 }}>
        请先到「模块内容」标签运行架构发现，
        然后下一会话会基于发现结果构建本模块的 CRUD 界面。
      </div>
    </div>
  );
}
