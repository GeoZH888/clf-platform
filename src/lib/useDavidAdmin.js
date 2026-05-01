/**
 * useDavidAdmin.js
 * ─────────────────────────────────────────────────────────────
 * Drop this file into your CLF project:
 *   clf-platform/src/lib/useDavidAdmin.js
 *
 * The CLF B2C app reads data that the B2B Admin manages.
 * Both share:  https://yqcojudvvjntaajnrilr.supabase.co
 *
 * Usage examples in CLF components:
 *
 *   // Get AI config set by Admin
 *   const { aiConfig, apiKey } = useAIConfig()
 *
 *   // Get student's classes assigned by teacher
 *   const { classes } = useMyClasses(userId)
 *
 *   // Get panda emotion for UI
 *   const { url } = usePandaEmotion('excited')
 *
 *   // Submit homework
 *   await submitHomework(homeworkId, studentId, content)
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ── Same Supabase as Admin ────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yqcojudvvjntaajnrilr.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const adminDb = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// ─────────────────────────────────────────────────────────────
// useAIConfig — read the AI provider/model/key set by Admin
// Use this instead of hardcoding API keys in CLF
// ─────────────────────────────────────────────────────────────
export function useAIConfig() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!adminDb) { setLoading(false); return }
    adminDb.from('system_settings')
      .select('setting_key, setting_value')
      .eq('category', 'ai')
      .then(({ data }) => {
        const cfg = {}
        ;(data || []).forEach(r => { cfg[r.setting_key] = r.setting_value })
        setConfig(cfg)
        setLoading(false)
      })
  }, [])

  return {
    loading,
    provider:    config.ai_provider || 'anthropic',
    model:       config.ai_model || 'claude-sonnet-4-5',
    temperature: parseFloat(config.ai_temperature || '0.7'),
    maxTokens:   parseInt(config.ai_max_tokens || '2048'),
    // API keys stored by Admin (never hardcode in CLF frontend)
    apiKey:      config[`${config.ai_provider || 'anthropic'}_api_key`] || '',
    // Feature flags set by Admin
    features: {
      ppt:        config.ai_ppt_enabled !== 'false',
      quiz:       config.ai_quiz_enabled !== 'false',
      summary:    config.ai_summary_enabled !== 'false',
      lessonPlan: config.ai_lesson_plan_enabled !== 'false',
      flashcard:  config.ai_flashcard_enabled !== 'false',
    },
    // Daily limits per role
    teacherLimit: parseInt(config.ai_daily_limit_teacher || '100'),
    studentLimit: parseInt(config.ai_daily_limit_student || '20'),
    raw: config,
  }
}

// ─────────────────────────────────────────────────────────────
// useMyClasses — get classes a student is enrolled in
// ─────────────────────────────────────────────────────────────
export function useMyClasses(studentId) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!adminDb || !studentId) { setLoading(false); return }
    adminDb.from('class_students')
      .select(`
        status, joined_at,
        classes (
          id, name, level, schedule, room, color,
          schools ( name_zh, city )
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .then(({ data }) => {
        setClasses((data || []).map(r => ({ ...r.classes, enrolled_at: r.joined_at })))
        setLoading(false)
      })
  }, [studentId])

  return { classes, loading }
}

// ─────────────────────────────────────────────────────────────
// useMyHomework — get homework for student's classes
// ─────────────────────────────────────────────────────────────
export function useMyHomework(studentId) {
  const [homework, setHomework] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!adminDb || !studentId) { setLoading(false); return }
    // Get class IDs first
    adminDb.from('class_students')
      .select('class_id')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .then(async ({ data: enrollment }) => {
        const classIds = (enrollment || []).map(e => e.class_id)
        if (!classIds.length) { setLoading(false); return }

        const { data: hw } = await adminDb.from('homework')
          .select(`*, classes(name, level)`)
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('due_date', { ascending: true })

        // Get submission status
        const { data: subs } = await adminDb.from('homework_submissions')
          .select('homework_id, score, submitted_at')
          .eq('student_id', studentId)

        const subMap = {}
        ;(subs || []).forEach(s => { subMap[s.homework_id] = s })

        setHomework((hw || []).map(h => ({
          ...h,
          submission: subMap[h.id] || null,
          isOverdue: h.due_date && new Date(h.due_date) < new Date() && !subMap[h.id],
        })))
        setLoading(false)
      })
  }, [studentId])

  return { homework, loading }
}

// ─────────────────────────────────────────────────────────────
// submitHomework — student submits work
// ─────────────────────────────────────────────────────────────
export async function submitHomework(homeworkId, studentId, content) {
  if (!adminDb) throw new Error('Database not connected')
  const { error } = await adminDb.from('homework_submissions')
    .upsert({ homework_id: homeworkId, student_id: studentId, content, submitted_at: new Date().toISOString() },
      { onConflict: 'homework_id,student_id' })
  if (error) throw error
  return true
}

// ─────────────────────────────────────────────────────────────
// usePandaEmotion — get panda image URL set by Admin Panda Studio
// Falls back to local PIL-drawn file if no AI image saved
// ─────────────────────────────────────────────────────────────
export function usePandaEmotion(emotion = 'normal') {
  const [url, setUrl]     = useState(null)
  const [color, setColor] = useState('#4CAF50')

  useEffect(() => {
    if (!adminDb) return
    adminDb.from('panda_assets')
      .select('image_url, color')
      .eq('emotion', emotion)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.image_url) setUrl(data.image_url)
        if (data?.color) setColor(data.color)
      })
  }, [emotion])

  // Local PIL fallback (copy public/panda/ folder from davidchinese to clf-platform/public/)
  const localFallback = `/panda/panda_${emotion}.png`

  return { url: url || localFallback, color, hasAI: !!url }
}

// ─────────────────────────────────────────────────────────────
// PandaMascot component — drop-in for CLF
// Usage: <PandaMascot emotion="excited" size={80} message="做得好！" />
// ─────────────────────────────────────────────────────────────
export function PandaMascot({ emotion = 'normal', size = 80, message = '', animate = true }) {
  const { url, color } = usePandaEmotion(emotion)

  const bounce = animate && ['excited', 'cheering'].includes(emotion)
    ? { animation: 'panda-bounce 0.6s ease infinite alternate' } : {}

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <style>{`
        @keyframes panda-bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }
        @keyframes panda-shake  { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
      `}</style>
      <img
        src={url}
        alt={`panda-${emotion}`}
        style={{ width: size, height: size, objectFit: 'contain', ...bounce }}
        onError={e => { e.target.src = '/panda/panda_normal.png' }}
      />
      {message && (
        <div style={{
          background: color + '18',
          border: `1.5px solid ${color}40`,
          borderRadius: 12,
          padding: '6px 14px',
          fontSize: 13,
          color: '#2c1008',
          maxWidth: 200,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {message}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// useStudentPoints — XP and streak
// ─────────────────────────────────────────────────────────────
export function useStudentPoints(studentId) {
  const [points, setPoints] = useState({ total_xp: 0, streak_days: 0 })

  useEffect(() => {
    if (!adminDb || !studentId) return
    adminDb.from('student_points')
      .select('total_xp, streak_days, last_active')
      .eq('student_id', studentId)
      .maybeSingle()
      .then(({ data }) => { if (data) setPoints(data) })
  }, [studentId])

  async function addXP(amount, reason = '', source = 'bonus') {
    if (!adminDb) return
    await adminDb.from('point_transactions')
      .insert({ student_id: studentId, amount, reason, source })
    await adminDb.from('student_points')
      .upsert({
        student_id: studentId,
        total_xp: points.total_xp + amount,
        last_active: new Date().toISOString().split('T')[0],
      }, { onConflict: 'student_id' })
    setPoints(p => ({ ...p, total_xp: p.total_xp + amount }))
  }

  return { ...points, addXP }
}

// ─────────────────────────────────────────────────────────────
// useKnowledgeBase — query RAG files indexed by Admin
// ─────────────────────────────────────────────────────────────
export function useKnowledgeBase() {
  const [files,   setFiles]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!adminDb) { setLoading(false); return }
    adminDb.from('rag_files')
      .select('id, name, file_type, chunks, tags')
      .eq('status', 'indexed')
      .then(({ data }) => { setFiles(data || []); setLoading(false) })
  }, [])

  async function queryKB(question, apiKey, model = 'claude-sonnet-4-5') {
    if (!apiKey) throw new Error('No API key')
    const fileList = files.slice(0, 8).map(f => f.name).join('、')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: `你是大卫学中文AI助手。知识库包含以下已索引文件（共${files.length}个）：${fileList}。请基于这些资料简洁专业地回答。`,
        messages: [{ role: 'user', content: question }]
      })
    })
    const data = await res.json()
    return data.content?.[0]?.text || '暂无相关内容'
  }

  return { files, loading, totalChunks: files.reduce((s, f) => s + (f.chunks || 0), 0), queryKB }
}

// ─────────────────────────────────────────────────────────────
// useAttendance — record and read attendance
// ─────────────────────────────────────────────────────────────
export async function recordAttendance(classId, studentId, status = 'present', recordedBy = null) {
  if (!adminDb) return
  const date = new Date().toISOString().split('T')[0]
  const { error } = await adminDb.from('attendance')
    .upsert({ class_id: classId, student_id: studentId, date, status, recorded_by: recordedBy },
      { onConflict: 'class_id,student_id,date' })
  if (error) throw error
  return true
}

export function useAttendanceRate(studentId, classId) {
  const [rate, setRate] = useState(null)

  useEffect(() => {
    if (!adminDb || !studentId) return
    let q = adminDb.from('attendance').select('status').eq('student_id', studentId)
    if (classId) q = q.eq('class_id', classId)
    q.then(({ data }) => {
      if (!data?.length) return
      const present = data.filter(r => r.status === 'present').length
      setRate(Math.round((present / data.length) * 100))
    })
  }, [studentId, classId])

  return rate
}
