// src/teacher/pages/CommunicationPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, Send, MessageSquare } from 'lucide-react';

export default function CommunicationPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newThread, setNewThread] = useState({ parent_name: '', subject: '' });

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('clf_pt_threads')
      .select('*').eq('teacher_id', user.id).order('last_msg_at', { ascending: false });
    setThreads(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const open = async (t) => {
    setActive(t);
    const { data } = await supabase.from('clf_pt_messages')
      .select('*').eq('thread_id', t.id).order('created_at');
    setMessages(data || []);
  };

  const createThread = async () => {
    if (!newThread.parent_name.trim() || !newThread.subject.trim()) return;
    const { data } = await supabase.from('clf_pt_threads').insert({
      ...newThread, teacher_id: user.id,
    }).select().single();
    setNewThread({ parent_name: '', subject: '' });
    setShowNew(false);
    load();
    if (data) open(data);
  };

  const sendMsg = async () => {
    if (!draft.trim() || !active) return;
    await supabase.from('clf_pt_messages').insert({
      thread_id: active.id, sender_id: user.id, body: draft.trim(),
    });
    await supabase.from('clf_pt_threads').update({ last_msg_at: new Date().toISOString() })
      .eq('id', active.id);
    setDraft('');
    open(active);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>家校沟通</h1>
        <button onClick={() => setShowNew(!showNew)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> 新建对话</button>
      </div>

      {showNew && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <input placeholder="家长姓名" value={newThread.parent_name}
            onChange={e => setNewThread({ ...newThread, parent_name: e.target.value })}
            style={inputStyle}/>
          <input placeholder="主题" value={newThread.subject}
            onChange={e => setNewThread({ ...newThread, subject: e.target.value })}
            style={inputStyle}/>
          <button onClick={createThread} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>创建</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: active ? 'minmax(0, 1fr) minmax(0, 1.5fr)' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.length === 0 ? (
            <div style={{ background: '#fff', padding: 24, borderRadius: 12,
              border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
              还没有对话
            </div>
          ) : threads.map(t => (
            <button key={t.id} onClick={() => open(t)} style={{
              background: active?.id === t.id ? '#fef3e2' : '#fff',
              padding: 12, borderRadius: 10, textAlign: 'left',
              border: `1px solid ${active?.id === t.id ? '#c41e3a' : '#e8d5b0'}`,
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={14} color="#8b5cf6"/>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.parent_name}</div>
              </div>
              <div style={{ fontSize: 12, color: '#5d4630', marginTop: 2 }}>{t.subject}</div>
              <div style={{ fontSize: 10, color: '#a07850', marginTop: 4 }}>
                {new Date(t.last_msg_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {active && (
          <div style={{ background: '#fff', borderRadius: 12,
            border: '1px solid #e8d5b0', display: 'flex', flexDirection: 'column',
            minHeight: 400 }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e8d5b0' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{active.parent_name}</div>
              <div style={{ fontSize: 11, color: '#a07850' }}>{active.subject}</div>
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400 }}>
              {messages.length === 0 ? (
                <div style={{ color: '#a07850', textAlign: 'center', fontSize: 12, padding: 20 }}>
                  还没有消息
                </div>
              ) : messages.map(m => {
                const me = m.sender_id === user?.id;
                return (
                  <div key={m.id} style={{
                    alignSelf: me ? 'flex-end' : 'flex-start',
                    background: me ? '#c41e3a' : '#fdf6e3',
                    color: me ? '#fff' : '#1a0a05',
                    padding: '8px 12px', borderRadius: 12,
                    maxWidth: '75%', fontSize: 13,
                  }}>
                    {m.body}
                    <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e8d5b0',
              display: 'flex', gap: 8 }}>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="输入消息"
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}/>
              <button onClick={sendMsg} style={{
                padding: '8px 14px', background: '#c41e3a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}><Send size={14}/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
