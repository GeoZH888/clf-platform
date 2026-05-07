// src/teacher/classroom/useCoTeacher.js
// ════════════════════════════════════════════════════════════════════════════
// Stage b1.1 — conversation lifecycle
// Loads/creates conversations, messages, and the lesson plan for a class.
// Stage b1.2 will add `send()` (chat with AI). Stage b1.3 will wire tool calls.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../school/services/supabase';
import { useAuth } from '../../school/contexts/AuthContext';

const PLAYGROUND_KEY = '__playground__';

export function useCoTeacher(classId) {
  const { user } = useAuth();
  const teacherId = user?.id;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [plan, setPlan]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // ── Load or create conversation when classId changes ─────────────────────
  useEffect(() => {
    if (!teacherId || classId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const conv = await loadOrCreateConversation(teacherId, classId);
        if (cancelled) return;
        setConversation(conv);

        const [msgs, lp] = await Promise.all([
          loadMessages(conv.id),
          loadOrCreatePlan(conv.id, teacherId, classId),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setPlan(lp);
      } catch (e) {
        if (!cancelled) setError(e.message);
        console.error('[useCoTeacher] load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teacherId, classId]);

  // ── Stage b1.2 will implement this ───────────────────────────────────────
  const send = useCallback(async (_text) => {
    throw new Error('send() not implemented yet — coming in Stage b1.2');
  }, []);

  return { conversation, messages, plan, loading, error, send };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loadOrCreateConversation(teacherId, classId) {
  // classId can be a UUID, the playground sentinel, or null/undefined
  const isPlayground = !classId || classId === PLAYGROUND_KEY;
  const realClassId = isPlayground ? null : classId;

  // Try to find the most recent active conversation for this teacher + class
  let q = supabase
    .from('dwxz_teacher_conversations')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);

  q = realClassId ? q.eq('class_id', realClassId) : q.is('class_id', null);

  const { data: existing, error: selErr } = await q;
  if (selErr) throw selErr;
  if (existing && existing.length > 0) return existing[0];

  // None found → create one
  const { data: created, error: insErr } = await supabase
    .from('dwxz_teacher_conversations')
    .insert({
      teacher_id: teacherId,
      class_id: realClassId,
      title: isPlayground ? '试用对话 / Practice' : null,
      language: 'zh',
      status: 'active',
    })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return created;
}

async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('dwxz_teacher_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadOrCreatePlan(conversationId, teacherId, classId) {
  const realClassId = !classId || classId === PLAYGROUND_KEY ? null : classId;

  const { data: existing, error: selErr } = await supabase
    .from('dwxz_lesson_plans')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing;

  const { data: created, error: insErr } = await supabase
    .from('dwxz_lesson_plans')
    .insert({
      conversation_id: conversationId,
      teacher_id: teacherId,
      class_id: realClassId,
      status: 'draft',
    })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return created;
}

export { PLAYGROUND_KEY };
