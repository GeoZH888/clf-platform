# install_phase_e1_full.py
# Phase E.1 — Full ambition: media-rich homework workflow + merged nav.
#
# REQUIRES MANUAL SUPABASE STEPS (do these BEFORE running this installer):
#
#   1. Open Supabase Dashboard -> Storage -> Create new bucket
#      Name: homework-files
#      Public: NO (private)
#      File size limit: 50 MB
#      Allowed MIME types: leave blank
#
#   2. Open Supabase Dashboard -> SQL Editor -> New query
#      Paste contents of: db_migration_phase_e1.sql (also written by this installer)
#      Click Run.
#
# After those two steps, run this installer.
#
#   python install_phase_e1_full.py
#
# Then:
#   npm run build
#   netlify deploy --prod --dir dist --no-build

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make sure dirs exist
for sub in ['src/teacher/pages', 'src/student/pages', 'src/shared', 'src/lib']:
    (ROOT / sub).mkdir(parents=True, exist_ok=True)

files = {}

# ============================================================
# SQL MIGRATION (run manually in Supabase SQL editor)
# ============================================================
files["db_migration_phase_e1.sql"] = '''-- Phase E.1 migration
-- Adds homework attachment columns + student response media columns + RLS for homework-files bucket

-- 1. Homework attachments (teacher prompts)
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE clf_homework ADD COLUMN IF NOT EXISTS words_list JSONB;

COMMENT ON COLUMN clf_homework.attachment_type IS 'pdf | audio | null';
COMMENT ON COLUMN clf_homework.attachment_path IS 'storage path: prompts/{homework_id}/{filename}';

-- 2. Student response media
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_audio_url TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_audio_path TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_url TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_path TEXT;
ALTER TABLE clf_homework_submissions ADD COLUMN IF NOT EXISTS response_pdf_name TEXT;

-- 3. Storage RLS policies for homework-files bucket
-- (run AFTER creating the bucket via dashboard)

-- Teachers can upload to prompts/{homework_id}/ if they own the homework
DROP POLICY IF EXISTS "teacher_upload_prompts" ON storage.objects;
CREATE POLICY "teacher_upload_prompts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Teachers can read prompts they own
DROP POLICY IF EXISTS "teacher_read_prompts" ON storage.objects;
CREATE POLICY "teacher_read_prompts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Students can read prompts for their classes
DROP POLICY IF EXISTS "student_read_prompts" ON storage.objects;
CREATE POLICY "student_read_prompts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1
      FROM clf_homework h
      JOIN clf_class_members m ON m.class_id = h.class_id
      WHERE h.id::text = (storage.foldername(name))[2]
      AND m.user_id = auth.uid()
    )
  );

-- Students can upload to responses/{submission_id}/ if it's their own submission
DROP POLICY IF EXISTS "student_upload_responses" ON storage.objects;
CREATE POLICY "student_upload_responses" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );

-- Students can read their own responses
DROP POLICY IF EXISTS "student_read_own_responses" ON storage.objects;
CREATE POLICY "student_read_own_responses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );

-- Teachers can read responses to homework they own
DROP POLICY IF EXISTS "teacher_read_student_responses" ON storage.objects;
CREATE POLICY "teacher_read_student_responses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1
      FROM clf_homework_submissions s
      JOIN clf_homework h ON h.id = s.homework_id
      WHERE s.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

-- Update / delete: same logic as INSERT
DROP POLICY IF EXISTS "teacher_update_prompts" ON storage.objects;
CREATE POLICY "teacher_update_prompts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_delete_prompts" ON storage.objects;
CREATE POLICY "teacher_delete_prompts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'prompts'
    AND EXISTS (
      SELECT 1 FROM clf_homework h
      WHERE h.id::text = (storage.foldername(name))[2]
      AND h.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "student_update_responses" ON storage.objects;
CREATE POLICY "student_update_responses" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'responses'
    AND EXISTS (
      SELECT 1 FROM clf_homework_submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
      AND s.student_id = auth.uid()
    )
  );
'''

# ============================================================
# Storage helper
# ============================================================
files["src/lib/homeworkStorage.js"] = '''// src/lib/homeworkStorage.js
// Helpers for uploading homework prompts (teacher) + responses (student)
// to Supabase Storage bucket 'homework-files'.
import { supabase } from '../school/services/supabase';

const BUCKET = 'homework-files';

// Upload a teacher prompt file. homeworkId must already exist.
export async function uploadHomeworkPrompt(homeworkId, file) {
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ts = Date.now();
  const path = `prompts/${homeworkId}/${ts}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  return { path, url: signed?.signedUrl, name: file.name };
}

// Upload a student response file. submissionId must already exist.
export async function uploadStudentResponse(submissionId, file, kind) {
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const ts = Date.now();
  const path = `responses/${submissionId}/${kind}_${ts}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, url: signed?.signedUrl, name: file.name };
}

// Refresh a signed URL for an existing path
export async function refreshSignedUrl(path) {
  const { data } = await supabase.storage.from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl;
}
'''

# ============================================================
# Audio recorder component (mobile-friendly: hold to record)
# ============================================================
files["src/shared/AudioRecorder.jsx"] = '''// src/shared/AudioRecorder.jsx
// Hold-to-record audio component using MediaRecorder API.
// onComplete(blob) is called when recording stops.
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

export default function AudioRecorder({ onComplete, accentColor = '#c41e3a' }) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && navigator.mediaDevices?.getUserMedia
      && window.MediaRecorder;
    setSupported(!!ok);
  }, []);

  const start = async () => {
    if (!supported) {
      alert('您的浏览器不支持录音功能。请使用最新版 Chrome / Safari / Edge。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      alert('无法访问麦克风：' + e.message);
    }
  };

  const stop = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const reset = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setDuration(0);
    setPlaying(false);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const accept = () => {
    if (blob) onComplete?.(blob);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!supported) {
    return (
      <div style={{
        padding: 12, background: 'rgba(253,164,175,0.1)',
        border: '1px solid rgba(253,164,175,0.3)', borderRadius: 8,
        fontSize: 12, color: '#fda4af',
      }}>
        当前浏览器不支持录音。请使用最新版 Chrome / Safari / Edge。
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10,
      border: '1px solid rgba(255,245,230,0.15)',
    }}>
      {!blob && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!recording ? (
            <button onClick={start} style={{
              background: accentColor, color: '#fff', border: 'none',
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            }}>
              <Mic size={14}/> 开始录音
            </button>
          ) : (
            <button onClick={stop} style={{
              background: '#dc2626', color: '#fff', border: 'none',
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              animation: 'pulse 1s infinite',
            }}>
              <Square size={12}/> 停止
            </button>
          )}
          <span style={{ fontSize: 12, color: '#fff5e6' }}>
            {recording ? `录音中 ${fmt(duration)}` : '点击开始'}
          </span>
        </div>
      )}
      {blob && url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={togglePlay} style={iconBtn(accentColor)}>
            {playing ? <Pause size={14}/> : <Play size={14}/>}
          </button>
          <span style={{ fontSize: 12, color: '#fff5e6' }}>{fmt(duration)}</span>
          <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} style={{ display: 'none' }}/>
          <button onClick={reset} style={iconBtn('#dc2626')}>
            <Trash2 size={14}/>
          </button>
          <button onClick={accept} style={{
            background: '#10b981', color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            marginLeft: 'auto', fontSize: 12, fontWeight: 600,
          }}>
            使用此录音
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtn = (color) => ({
  background: color, color: '#fff', border: 'none',
  width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
'''

# ============================================================
# Audio player + PDF viewer + File upload button
# ============================================================
files["src/shared/AudioPlayer.jsx"] = '''// src/shared/AudioPlayer.jsx
import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

export default function AudioPlayer({ src, accentColor = '#c41e3a', label }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  if (!src) return null;
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 10, background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,245,230,0.15)', borderRadius: 8,
    }}>
      <button onClick={toggle} style={{
        background: accentColor, color: '#fff', border: 'none',
        width: 36, height: 36, borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {playing ? <Pause size={14}/> : <Play size={14}/>}
      </button>
      <Volume2 size={14} color={accentColor}/>
      <span style={{ fontSize: 12, color: '#fff5e6' }}>{label || '音频'}</span>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} style={{ display: 'none' }}/>
    </div>
  );
}
'''

files["src/shared/PDFViewer.jsx"] = '''// src/shared/PDFViewer.jsx
import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

export default function PDFViewer({ src, name = 'document.pdf', accentColor = '#c41e3a', height = 480 }) {
  if (!src) return null;
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,245,230,0.15)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid rgba(255,245,230,0.1)',
      }}>
        <FileText size={14} color={accentColor}/>
        <span style={{ fontSize: 12, color: '#fff5e6', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <a href={src} target="_blank" rel="noopener noreferrer" style={{
          color: accentColor, fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none',
        }}>
          打开 <ExternalLink size={11}/>
        </a>
      </div>
      <iframe src={src} style={{
        width: '100%', height, border: 'none', background: '#fff',
      }} title={name}/>
    </div>
  );
}
'''

files["src/shared/FileUploadButton.jsx"] = '''// src/shared/FileUploadButton.jsx
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export default function FileUploadButton({
  accept = '*',
  onPick,
  label = '选择文件',
  accentColor = '#c41e3a',
  maxMB = 50,
}) {
  const ref = useRef();
  const [name, setName] = useState(null);

  const handle = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > maxMB * 1024 * 1024) {
      alert(`文件超过 ${maxMB} MB 上限`);
      return;
    }
    setName(f.name);
    onPick?.(f);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => ref.current?.click()} style={{
        background: accentColor, color: '#fff', border: 'none',
        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
      }}>
        <Upload size={12}/> {label}
      </button>
      {name && <span style={{ fontSize: 11, color: 'rgba(253,246,227,0.7)' }}>{name}</span>}
      <input ref={ref} type="file" accept={accept} onChange={handle}
        style={{ display: 'none' }}/>
    </div>
  );
}
'''

# ============================================================
# Teacher: updated TeacherApp.jsx with 5-item nav
# ============================================================
files["src/teacher/TeacherApp.jsx"] = '''// src/teacher/TeacherApp.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import RolePanelLayout from '../shared/RolePanelLayout';
import ClassesPage from './pages/ClassesPage';
import HomeworkPage from './pages/HomeworkPage';
import ClassroomPage from './pages/ClassroomPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

const NAV = [
  { path: '/',          icon: '🏫', label: '班级管理' },
  { path: '/homework',  icon: '📝', label: '作业' },
  { path: '/classroom', icon: '🛠️', label: '课堂教学' },
  { path: '/messages',  icon: '💬', label: '消息通知' },
  { path: '/profile',   icon: '👤', label: '个人资料' },
];

export default function TeacherApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/teacher">
          <RequireRole allow={['super_admin', 'teacher']}>
            <RolePanelLayout title="教师工作台" subtitle="Teacher" nav={NAV} accentColor="#c41e3a">
              <Routes>
                <Route path="/"           element={<ClassesPage />} />
                <Route path="/homework"   element={<HomeworkPage />} />
                <Route path="/classroom"  element={<ClassroomPage />} />
                <Route path="/messages"   element={<MessagesPage />} />
                <Route path="/profile"    element={<ProfilePage />} />
              </Routes>
            </RolePanelLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ============================================================
# ClassesPage / MessagesPage / ProfilePage (carry from before)
# ============================================================
files["src/teacher/pages/ClassesPage.jsx"] = '''// src/teacher/pages/ClassesPage.jsx
import React from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import TeacherHome from './TeacherHome';

export default function ClassesPage() {
  return (
    <div>
      <PageHero icon="🏫" title="班级管理" subtitle="Classes" accentColor="#c41e3a"/>
      <TeacherHome />
    </div>
  );
}
'''

files["src/teacher/pages/MessagesPage.jsx"] = '''// src/teacher/pages/MessagesPage.jsx
import React, { useState } from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import CommunicationPage from './CommunicationPage';
import NoticesPage from './NoticesPage';

const TABS = [
  { id: 'comm',    label: '沟通', Component: CommunicationPage },
  { id: 'notices', label: '通知', Component: NoticesPage },
];

export default function MessagesPage() {
  const [tab, setTab] = useState('comm');
  const Active = TABS.find(t => t.id === tab)?.Component || CommunicationPage;
  return (
    <div>
      <PageHero icon="💬" title="消息通知" subtitle="Messages" accentColor="#c41e3a"/>
      <TabBar tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{
        background: 'rgba(253,246,227,0.04)',
        border: '1px solid rgba(255,245,230,0.1)',
        borderRadius: 14, padding: 20,
      }}>
        <Active />
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 18, padding: 4,
      background: 'rgba(253,246,227,0.05)', borderRadius: 10,
      border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: active === t.id ? '#c41e3a' : 'transparent',
          color: active === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
          cursor: 'pointer', fontSize: 13,
          fontWeight: active === t.id ? 700 : 500,
        }}>{t.label}</button>
      ))}
    </div>
  );
}
'''

files["src/teacher/pages/ProfilePage.jsx"] = '''// src/teacher/pages/ProfilePage.jsx
import React from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { PageHero } from '../../shared/RolePanelLayout';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHero icon="👤" title="个人资料" subtitle="Profile" accentColor="#c41e3a"/>
      <div style={{
        background: 'rgba(253,246,227,0.05)',
        border: '1px solid rgba(255,245,230,0.15)',
        borderRadius: 12, padding: 20, color: '#fff5e6',
      }}>
        <Row label="姓名"   value={user?.name}/>
        <Row label="账号"   value={user?.email?.split('@')[0]}/>
        <Row label="邮箱"   value={user?.email}/>
        <Row label="角色"   value="教师"/>
      </div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', padding: '10px 0',
      borderBottom: '1px solid rgba(255,245,230,0.08)',
    }}>
      <div style={{ width: 90, fontSize: 12, color: 'rgba(253,246,227,0.6)' }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value || '-'}</div>
    </div>
  );
}
'''

# ============================================================
# ClassroomPage: 4 tabs (备课 / 课程 / 资料 / 进度)
# ============================================================
files["src/teacher/pages/ClassroomPage.jsx"] = '''// src/teacher/pages/ClassroomPage.jsx
// 课堂教学: tabs 备课 | 课程 | 资料 | 进度
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import CoursePrepWizard from './CoursePrepWizard';
import CoursesPage from './CoursesPage';
import MaterialsPage from './MaterialsPage';

const TABS = [
  { id: 'prep',      label: '备课' },
  { id: 'courses',   label: '课程' },
  { id: 'materials', label: '资料' },
  { id: 'progress',  label: '进度' },
];

export default function ClassroomPage() {
  const [tab, setTab] = useState('prep');
  return (
    <div>
      <PageHero icon="🛠️" title="课堂教学" subtitle="Classroom" accentColor="#c41e3a"/>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18, padding: 4,
        background: 'rgba(253,246,227,0.05)', borderRadius: 10,
        border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
        flexWrap: 'wrap',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: tab === t.id ? '#c41e3a' : 'transparent',
            color: tab === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
            cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{
        background: 'rgba(253,246,227,0.04)',
        border: '1px solid rgba(255,245,230,0.1)',
        borderRadius: 14, padding: 20,
      }}>
        {tab === 'prep'      && <CoursePrepWizard />}
        {tab === 'courses'   && <CoursesPage />}
        {tab === 'materials' && <MaterialsPage />}
        {tab === 'progress'  && <ProgressView />}
      </div>
    </div>
  );
}

function ProgressView() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: cls } = await supabase
        .from('clf_classes')
        .select('id, name, grade_level')
        .eq('teacher_id', user.id);
      const out = [];
      for (const c of cls || []) {
        const [{ count: studentCount }, { count: hwCount }, { count: gradedCount }] = await Promise.all([
          supabase.from('clf_class_members').select('id', { count: 'exact', head: true })
            .eq('class_id', c.id),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true })
            .eq('class_id', c.id),
          supabase.from('clf_homework_submissions').select('id', { count: 'exact', head: true })
            .in('homework_id',
              (await supabase.from('clf_homework').select('id').eq('class_id', c.id)).data?.map(h => h.id) || ['__none__'])
            .not('graded_at', 'is', null),
        ]);
        out.push({ ...c,
          studentCount: studentCount || 0,
          hwCount: hwCount || 0,
          gradedCount: gradedCount || 0,
        });
      }
      setClasses(out);
    })();
  }, [user?.id]);

  if (classes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 30, color: 'rgba(253,246,227,0.5)' }}>
        还没有班级
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {classes.map(c => (
        <div key={c.id} style={{
          background: 'rgba(196,30,58,0.08)',
          border: '1px solid rgba(196,30,58,0.3)',
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6', marginBottom: 8,
            fontFamily: \"'STKaiti','KaiTi',serif\" }}>
            {c.name}
          </div>
          <Stat label="学生" value={c.studentCount}/>
          <Stat label="作业" value={c.hwCount}/>
          <Stat label="已批" value={c.gradedCount}/>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      padding: '4px 0', fontSize: 12 }}>
      <span style={{ color: 'rgba(253,246,227,0.6)' }}>{label}</span>
      <span style={{ color: '#fff5e6', fontWeight: 700 }}>{value}</span>
    </div>
  );
}
'''

# ============================================================
# Teacher HomeworkPage: full workflow (assign + media + grade)
# ============================================================
files["src/teacher/pages/HomeworkPage.jsx"] = '''// src/teacher/pages/HomeworkPage.jsx
// Merged: 作业 = create + distribute + view submissions + grade
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { Plus, FileText, Calendar, ChevronRight, X, Mic } from 'lucide-react';
import FileUploadButton from '../../shared/FileUploadButton';
import AudioRecorder from '../../shared/AudioRecorder';
import AudioPlayer from '../../shared/AudioPlayer';
import PDFViewer from '../../shared/PDFViewer';
import { uploadHomeworkPrompt, refreshSignedUrl } from '../../lib/homeworkStorage';

const ACCENT = '#c41e3a';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [view, setView] = useState({ mode: 'list', homework: null }); // list | create | detail

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_classes').select('id, name, grade_level')
      .eq('teacher_id', user.id).order('name');
    setClasses(cls || []);
    const ids = (cls || []).map(c => c.id);
    if (ids.length === 0) { setItems([]); return; }
    const { data } = await supabase
      .from('clf_homework')
      .select('*, clf_classes(name)')
      .in('class_id', ids)
      .order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  return (
    <div>
      <PageHero icon="📝" title="作业" subtitle="Homework" accentColor={ACCENT}>
        {view.mode === 'list' && (
          <button onClick={() => setView({ mode: 'create' })} style={{
            background: ACCENT, color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={14}/> 新建作业
          </button>
        )}
        {view.mode !== 'list' && (
          <button onClick={() => { setView({ mode: 'list' }); load(); }} style={{
            background: 'transparent', color: '#fff5e6',
            border: '1px solid rgba(255,245,230,0.3)',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <X size={12}/> 返回列表
          </button>
        )}
      </PageHero>

      {view.mode === 'create' && (
        <CreateForm classes={classes} userId={user?.id}
          onDone={() => { setView({ mode: 'list' }); load(); }}/>
      )}
      {view.mode === 'detail' && (
        <DetailView homework={view.homework} userId={user?.id}/>
      )}
      {view.mode === 'list' && (
        <ListView items={items} classes={classes}
          onOpen={(h) => setView({ mode: 'detail', homework: h })}/>
      )}
    </div>
  );
}

// ─── Create form (assign) ───────────────────────────────────────
function CreateForm({ classes, userId, onDone }) {
  const [form, setForm] = useState({
    class_id: '', title: '', description: '', due_at: '',
    words_list: '', attachment_kind: '', // '' | 'pdf' | 'audio'
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.class_id || !form.title.trim()) {
      alert('请选择班级并填写标题');
      return;
    }
    setSaving(true);
    try {
      const wordsList = form.words_list
        .split('\\n').map(w => w.trim()).filter(Boolean);
      const { data: hw, error } = await supabase.from('clf_homework').insert({
        class_id: form.class_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_at: form.due_at || null,
        created_by: userId,
        words_list: wordsList.length > 0 ? wordsList : null,
      }).select().single();
      if (error) throw error;

      let updates = {};
      if (form.attachment_kind === 'pdf' && pdfFile) {
        const uploaded = await uploadHomeworkPrompt(hw.id, pdfFile);
        updates = {
          attachment_url: uploaded.url,
          attachment_path: uploaded.path,
          attachment_type: 'pdf',
          attachment_name: uploaded.name,
        };
      } else if (form.attachment_kind === 'audio' && audioBlob) {
        const file = new File([audioBlob], 'prompt.webm', { type: 'audio/webm' });
        const uploaded = await uploadHomeworkPrompt(hw.id, file);
        updates = {
          attachment_url: uploaded.url,
          attachment_path: uploaded.path,
          attachment_type: 'audio',
          attachment_name: uploaded.name,
        };
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clf_homework').update(updates).eq('id', hw.id);
      }
      onDone();
    } catch (e) {
      alert('保存失败：' + (e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div style={panel}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#fff5e6',
        fontFamily: \"'STKaiti','KaiTi',serif\", letterSpacing: 2 }}>
        新建作业
      </h3>
      <select value={form.class_id} onChange={e => setForm(f => ({...f, class_id: e.target.value}))} style={input}>
        <option value="">选择班级…</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
        placeholder="作业标题" style={input}/>
      <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
        placeholder="作业说明（可选）" rows={3} style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>
      <textarea value={form.words_list} onChange={e => setForm(f => ({...f, words_list: e.target.value}))}
        placeholder="单词表（可选，每行一个）" rows={3} style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>
      <input type="datetime-local" value={form.due_at}
        onChange={e => setForm(f => ({...f, due_at: e.target.value}))} style={input}/>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
          附件（可选）：
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {['', 'pdf', 'audio'].map(k => (
            <button key={k} onClick={() => setForm(f => ({...f, attachment_kind: k}))} style={{
              padding: '6px 12px', borderRadius: 16,
              background: form.attachment_kind === k ? ACCENT : 'rgba(253,246,227,0.06)',
              color: form.attachment_kind === k ? '#fff' : 'rgba(253,246,227,0.7)',
              border: '1px solid rgba(253,246,227,0.15)',
              cursor: 'pointer', fontSize: 11,
            }}>{k === '' ? '无附件' : k === 'pdf' ? 'PDF' : '音频'}</button>
          ))}
        </div>
        {form.attachment_kind === 'pdf' && (
          <FileUploadButton accept=".pdf" label="选择 PDF"
            onPick={setPdfFile} accentColor={ACCENT}/>
        )}
        {form.attachment_kind === 'audio' && (
          <AudioRecorder accentColor={ACCENT} onComplete={setAudioBlob}/>
        )}
      </div>

      <button onClick={submit} disabled={saving} style={{
        background: ACCENT, color: '#fff', border: 'none',
        padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, marginTop: 8,
      }}>{saving ? '保存中…' : '发布作业'}</button>
    </div>
  );
}

// ─── List view ──────────────────────────────────────────────────
function ListView({ items, classes, onOpen }) {
  if (classes.length === 0) {
    return <Empty>还没有班级。请先到「班级管理」创建班级。</Empty>;
  }
  if (items.length === 0) {
    return <Empty>还没有布置作业。点击上方「新建作业」开始。</Empty>;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map(h => (
        <button key={h.id} onClick={() => onOpen(h)} style={{
          ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
          background: 'rgba(253,246,227,0.05)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <FileText size={14} color={ACCENT}/>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6' }}>{h.title}</div>
            <span style={chip}>{h.clf_classes?.name}</span>
            {h.attachment_type && (
              <span style={{ ...chip, background: '#3b82f630', color: '#7dd3fc' }}>
                {h.attachment_type === 'pdf' ? 'PDF' : '🎤 音频'}
              </span>
            )}
            <ChevronRight size={14} color="rgba(253,246,227,0.4)" style={{ marginLeft: 'auto' }}/>
          </div>
          {h.description && (
            <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
              {h.description.length > 80 ? h.description.slice(0, 80) + '…' : h.description}
            </div>
          )}
          {h.due_at && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center',
              fontSize: 11, color: '#fda4af' }}>
              <Calendar size={11}/>
              截止：{new Date(h.due_at).toLocaleString()}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Detail view (submissions + grading) ────────────────────────
function DetailView({ homework, userId }) {
  const [subs, setSubs] = useState([]);
  const [activeSub, setActiveSub] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [promptUrl, setPromptUrl] = useState(homework.attachment_url);

  const load = async () => {
    const { data } = await supabase
      .from('clf_homework_submissions')
      .select('*, clf_user_profiles!student_id(display_name_zh, display_name, email)')
      .eq('homework_id', homework.id)
      .order('submitted_at', { ascending: false });
    setSubs(data || []);
  };
  useEffect(() => { load(); }, [homework.id]);

  // Refresh signed URL for prompt attachment if needed
  useEffect(() => {
    if (homework.attachment_path && !promptUrl) {
      refreshSignedUrl(homework.attachment_path).then(setPromptUrl);
    }
  }, [homework.attachment_path]);

  const grade = async () => {
    if (!activeSub) return;
    setSaving(true);
    try {
      await supabase.from('clf_homework_submissions').update({
        score: score ? Number(score) : null,
        feedback: feedback.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: userId,
      }).eq('id', activeSub.id);
      setActiveSub(null); setScore(''); setFeedback('');
      load();
    } catch (e) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {/* Homework header info */}
      <div style={panel}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff5e6', marginBottom: 6,
          fontFamily: \"'STKaiti','KaiTi',serif\" }}>
          {homework.title}
        </div>
        {homework.description && (
          <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.8)', marginBottom: 8 }}>
            {homework.description}
          </div>
        )}
        {homework.words_list?.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>单词表：</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {homework.words_list.map((w, i) => (
                <span key={i} style={{ ...chip, background: '#10b98130', color: '#86efac' }}>{w}</span>
              ))}
            </div>
          </div>
        )}
        {homework.attachment_type === 'pdf' && promptUrl && (
          <PDFViewer src={promptUrl} name={homework.attachment_name} accentColor={ACCENT}/>
        )}
        {homework.attachment_type === 'audio' && promptUrl && (
          <AudioPlayer src={promptUrl} label={homework.attachment_name} accentColor={ACCENT}/>
        )}
      </div>

      <h3 style={{ fontSize: 14, color: '#fff5e6', margin: '20px 0 10px' }}>
        提交情况 · {subs.length} 人已交
      </h3>

      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: activeSub ? '1fr 1.5fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subs.length === 0 ? (
            <Empty>还没有学生提交</Empty>
          ) : subs.map(s => (
            <button key={s.id} onClick={() => {
              setActiveSub(s);
              setScore(s.score?.toString() || '');
              setFeedback(s.feedback || '');
            }} style={{
              ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
              background: activeSub?.id === s.id
                ? 'rgba(196,30,58,0.18)'
                : 'rgba(253,246,227,0.05)',
              borderColor: activeSub?.id === s.id ? ACCENT : 'rgba(255,245,230,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff5e6' }}>
                  {s.clf_user_profiles?.display_name_zh
                    || s.clf_user_profiles?.display_name
                    || s.clf_user_profiles?.email?.split('@')[0]
                    || '(未知)'}
                </div>
                <span style={{ ...chip,
                  background: s.graded_at ? '#10b98130' : '#f59e0b30',
                  color: s.graded_at ? '#86efac' : '#fcd34d' }}>
                  {s.graded_at ? `已批 ${s.score ?? '-'}` : '待批'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginTop: 2 }}>
                提交于 {new Date(s.submitted_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {activeSub && (
          <SubmissionGrader sub={activeSub}
            score={score} setScore={setScore}
            feedback={feedback} setFeedback={setFeedback}
            saving={saving} onGrade={grade}/>
        )}
      </div>
    </div>
  );
}

function SubmissionGrader({ sub, score, setScore, feedback, setFeedback, saving, onGrade }) {
  const [responsePdfUrl, setResponsePdfUrl] = useState(sub.response_pdf_url);
  const [responseAudioUrl, setResponseAudioUrl] = useState(sub.response_audio_url);

  useEffect(() => {
    if (sub.response_pdf_path && !responsePdfUrl) {
      refreshSignedUrl(sub.response_pdf_path).then(setResponsePdfUrl);
    }
    if (sub.response_audio_path && !responseAudioUrl) {
      refreshSignedUrl(sub.response_audio_path).then(setResponseAudioUrl);
    }
  }, [sub.id]);

  return (
    <div style={panel}>
      <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.6)', marginBottom: 8 }}>
        学生提交内容：
      </div>
      {sub.content && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8,
          fontSize: 13, color: '#fff5e6', whiteSpace: 'pre-wrap',
          maxHeight: 200, overflowY: 'auto', marginBottom: 10,
        }}>{sub.content}</div>
      )}
      {responsePdfUrl && (
        <div style={{ marginBottom: 10 }}>
          <PDFViewer src={responsePdfUrl} name={sub.response_pdf_name || 'response.pdf'}
            accentColor={ACCENT} height={300}/>
        </div>
      )}
      {responseAudioUrl && (
        <div style={{ marginBottom: 10 }}>
          <AudioPlayer src={responseAudioUrl} label="学生录音" accentColor={ACCENT}/>
        </div>
      )}
      {!sub.content && !responsePdfUrl && !responseAudioUrl && (
        <div style={{ color: 'rgba(253,246,227,0.5)', fontSize: 12,
          marginBottom: 10, fontStyle: 'italic' }}>
          (没有提交内容)
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="number" value={score} onChange={e => setScore(e.target.value)}
          placeholder="分数 (0-100)" min={0} max={100} style={input}/>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
          placeholder="批语（可选）" rows={3} style={{...input, resize: 'vertical'}}/>
        <button onClick={onGrade} disabled={saving} style={{
          background: '#10b981', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>{saving ? '保存中…' : '完成批改'}</button>
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────
const panel = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 12, padding: 16, marginBottom: 14,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit',
};
const card = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 10, padding: 12,
};
const chip = {
  fontSize: 10, padding: '2px 8px', borderRadius: 10,
  background: '#c41e3a30', color: '#fda4af',
};
function Empty({ children }) {
  return (
    <div style={{
      background: 'rgba(253,246,227,0.04)',
      border: '1px dashed rgba(255,245,230,0.2)',
      borderRadius: 12, padding: 30, textAlign: 'center',
      color: 'rgba(253,246,227,0.5)', fontSize: 13,
    }}>{children}</div>
  );
}
'''

# ============================================================
# Student HomeworkPage: view + submit response (text/audio/PDF)
# ============================================================
files["src/student/pages/HomeworkPage.jsx"] = '''// src/student/pages/HomeworkPage.jsx
// Student view: list assignments + open detail + submit response
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { FileText, ChevronRight, X, Calendar, Send } from 'lucide-react';
import FileUploadButton from '../../shared/FileUploadButton';
import AudioRecorder from '../../shared/AudioRecorder';
import AudioPlayer from '../../shared/AudioPlayer';
import PDFViewer from '../../shared/PDFViewer';
import { uploadStudentResponse, refreshSignedUrl } from '../../lib/homeworkStorage';

const ACCENT = '#10b981';

export default function StudentHomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [submap, setSubmap] = useState({});
  const [active, setActive] = useState(null);

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_class_members').select('class_id').eq('user_id', user.id);
    const ids = (cls || []).map(c => c.class_id);
    if (ids.length === 0) { setItems([]); return; }
    const { data: hw } = await supabase
      .from('clf_homework')
      .select('*, clf_classes(name)')
      .in('class_id', ids)
      .order('created_at', { ascending: false });
    setItems(hw || []);
    const { data: subs } = await supabase
      .from('clf_homework_submissions')
      .select('*').eq('student_id', user.id);
    const map = {};
    (subs || []).forEach(s => { map[s.homework_id] = s; });
    setSubmap(map);
  };
  useEffect(() => { load(); }, [user?.id]);

  return (
    <div>
      <PageHero icon="📝" title="我的作业" subtitle="Homework" accentColor={ACCENT}>
        {active && (
          <button onClick={() => { setActive(null); load(); }} style={{
            background: 'transparent', color: '#fff5e6',
            border: '1px solid rgba(255,245,230,0.3)',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <X size={12}/> 返回列表
          </button>
        )}
      </PageHero>

      {!active && (
        items.length === 0 ? (
          <Empty>暂无作业</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(h => {
              const sub = submap[h.id];
              return (
                <button key={h.id} onClick={() => setActive(h)} style={{
                  ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <FileText size={14} color={ACCENT}/>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6' }}>{h.title}</div>
                    <span style={chip}>{h.clf_classes?.name}</span>
                    {sub?.graded_at ? (
                      <span style={{ ...chip, background: '#10b98130', color: '#86efac' }}>
                        已批 {sub.score ?? '-'}
                      </span>
                    ) : sub ? (
                      <span style={{ ...chip, background: '#f59e0b30', color: '#fcd34d' }}>
                        已提交
                      </span>
                    ) : (
                      <span style={{ ...chip, background: '#a0785030', color: '#fef3c7' }}>
                        待提交
                      </span>
                    )}
                    <ChevronRight size={14} color="rgba(253,246,227,0.4)"
                      style={{ marginLeft: 'auto' }}/>
                  </div>
                  {h.due_at && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center',
                      fontSize: 11, color: '#fda4af' }}>
                      <Calendar size={11}/>
                      截止：{new Date(h.due_at).toLocaleString()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {active && (
        <DetailView homework={active} existingSub={submap[active.id]}
          userId={user?.id} onSubmitted={() => { load(); }}/>
      )}
    </div>
  );
}

// ─── Detail view: prompt + response form ────────────────────────
function DetailView({ homework, existingSub, userId, onSubmitted }) {
  const [text, setText] = useState(existingSub?.content || '');
  const [pdfFile, setPdfFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [promptUrl, setPromptUrl] = useState(homework.attachment_url);
  const [respPdfUrl, setRespPdfUrl] = useState(existingSub?.response_pdf_url);
  const [respAudioUrl, setRespAudioUrl] = useState(existingSub?.response_audio_url);

  useEffect(() => {
    if (homework.attachment_path && !promptUrl) {
      refreshSignedUrl(homework.attachment_path).then(setPromptUrl);
    }
  }, [homework.attachment_path]);
  useEffect(() => {
    if (existingSub?.response_pdf_path && !respPdfUrl) {
      refreshSignedUrl(existingSub.response_pdf_path).then(setRespPdfUrl);
    }
    if (existingSub?.response_audio_path && !respAudioUrl) {
      refreshSignedUrl(existingSub.response_audio_path).then(setRespAudioUrl);
    }
  }, [existingSub?.id]);

  const submit = async () => {
    setSaving(true);
    try {
      // 1. Upsert submission row first (need ID for storage path)
      let subId = existingSub?.id;
      if (!subId) {
        const { data, error } = await supabase
          .from('clf_homework_submissions')
          .insert({
            homework_id: homework.id,
            student_id: userId,
            content: text.trim() || null,
            submitted_at: new Date().toISOString(),
          })
          .select().single();
        if (error) throw error;
        subId = data.id;
      } else {
        await supabase.from('clf_homework_submissions').update({
          content: text.trim() || null,
          submitted_at: new Date().toISOString(),
        }).eq('id', subId);
      }

      // 2. Upload media if provided
      const updates = {};
      if (pdfFile) {
        const up = await uploadStudentResponse(subId, pdfFile, 'pdf');
        updates.response_pdf_url = up.url;
        updates.response_pdf_path = up.path;
        updates.response_pdf_name = up.name;
      }
      if (audioBlob) {
        const file = new File([audioBlob], 'response.webm', { type: 'audio/webm' });
        const up = await uploadStudentResponse(subId, file, 'audio');
        updates.response_audio_url = up.url;
        updates.response_audio_path = up.path;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clf_homework_submissions').update(updates).eq('id', subId);
      }
      onSubmitted();
      alert('提交成功！');
    } catch (e) {
      alert('提交失败：' + (e.message || e));
    } finally { setSaving(false); }
  };

  const isGraded = !!existingSub?.graded_at;

  return (
    <div>
      {/* Prompt */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff5e6', marginBottom: 8,
          fontFamily: \"'STKaiti','KaiTi',serif\" }}>
          {homework.title}
        </div>
        {homework.description && (
          <div style={{ fontSize: 13, color: 'rgba(253,246,227,0.85)', marginBottom: 10,
            whiteSpace: 'pre-wrap' }}>
            {homework.description}
          </div>
        )}
        {homework.words_list?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>单词表：</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {homework.words_list.map((w, i) => (
                <span key={i} style={{ ...chip, background: '#10b98130', color: '#86efac' }}>{w}</span>
              ))}
            </div>
          </div>
        )}
        {homework.attachment_type === 'pdf' && promptUrl && (
          <PDFViewer src={promptUrl} name={homework.attachment_name} accentColor={ACCENT}/>
        )}
        {homework.attachment_type === 'audio' && promptUrl && (
          <AudioPlayer src={promptUrl} label={homework.attachment_name} accentColor={ACCENT}/>
        )}
      </div>

      {/* Existing graded feedback (read-only) */}
      {isGraded && (
        <div style={{
          ...card, marginBottom: 16,
          background: 'rgba(16,185,129,0.08)', borderColor: '#10b98155',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.7)' }}>分数</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#86efac' }}>
              {existingSub.score ?? '-'}
            </div>
          </div>
          {existingSub.feedback && (
            <div style={{ fontSize: 12, color: '#fff5e6',
              padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6,
              whiteSpace: 'pre-wrap' }}>
              老师批语：{existingSub.feedback}
            </div>
          )}
        </div>
      )}

      {/* Response area (locked once graded) */}
      <div style={card}>
        <div style={{ fontSize: 14, color: '#fff5e6', marginBottom: 10, fontWeight: 600 }}>
          {isGraded ? '我的回答（已批改，不可修改）' : '回答区'}
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="文字回答（可选）" rows={5}
          disabled={isGraded}
          style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>

        {!isGraded && (
          <>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
                上传 PDF（可选）：
              </div>
              <FileUploadButton accept=".pdf" label="选择 PDF"
                onPick={setPdfFile} accentColor={ACCENT}/>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
                录制音频（可选）：
              </div>
              <AudioRecorder accentColor={ACCENT} onComplete={setAudioBlob}/>
            </div>
          </>
        )}

        {/* Existing media (if already submitted) */}
        {respPdfUrl && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>
              已上传的 PDF：
            </div>
            <PDFViewer src={respPdfUrl} name={existingSub.response_pdf_name}
              accentColor={ACCENT} height={300}/>
          </div>
        )}
        {respAudioUrl && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>
              已上传的音频：
            </div>
            <AudioPlayer src={respAudioUrl} label="我的录音" accentColor={ACCENT}/>
          </div>
        )}

        {!isGraded && (
          <button onClick={submit} disabled={saving} style={{
            background: ACCENT, color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, marginTop: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Send size={14}/> {saving ? '提交中…' : (existingSub ? '更新答案' : '提交')}
          </button>
        )}
      </div>
    </div>
  );
}

const card = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 12, padding: 16,
};
const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};
const chip = {
  fontSize: 10, padding: '2px 8px', borderRadius: 10,
  background: '#10b98130', color: '#86efac',
};
function Empty({ children }) {
  return (
    <div style={{
      background: 'rgba(253,246,227,0.04)',
      border: '1px dashed rgba(255,245,230,0.2)',
      borderRadius: 12, padding: 30, textAlign: 'center',
      color: 'rgba(253,246,227,0.5)', fontSize: 13,
    }}>{children}</div>
  );
}
'''

# ============================================================
# Write all files
# ============================================================
print(f"=== Writing {len(files)} files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  wrote  {rel}  ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
checks = [
    ('src/teacher/TeacherApp.jsx', 'ClassroomPage'),
    ('src/teacher/pages/HomeworkPage.jsx', 'uploadHomeworkPrompt'),
    ('src/teacher/pages/ClassroomPage.jsx', 'ProgressView'),
    ('src/teacher/pages/MessagesPage.jsx', 'CommunicationPage'),
    ('src/student/pages/HomeworkPage.jsx', 'uploadStudentResponse'),
    ('src/shared/AudioRecorder.jsx', 'MediaRecorder'),
    ('src/shared/AudioPlayer.jsx', 'AudioPlayer'),
    ('src/shared/PDFViewer.jsx', 'iframe'),
    ('src/shared/FileUploadButton.jsx', 'FileUploadButton'),
    ('src/lib/homeworkStorage.js', 'createSignedUrl'),
    ('db_migration_phase_e1.sql', 'attachment_type'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    if marker in p.read_text(encoding='utf-8'):
        print(f"  [OK] {rel}")
    else:
        print(f"  [FAIL] {rel}: missing '{marker}'")
        all_ok = False

import re
total_escapes = 0
for rel in files.keys():
    p = ROOT / rel
    if p.exists() and p.suffix in ('.jsx', '.js'):
        n = len(re.findall(r'\\u[0-9a-fA-F]{4}', p.read_text(encoding='utf-8')))
        total_escapes += n
print(f"  Total raw \\\\uXXXX escapes in JSX/JS: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("BEFORE BUILD:")
print("  1. Open Supabase dashboard -> Storage -> Create bucket")
print("       Name: homework-files")
print("       Public: NO")
print("       File size limit: 50 MB")
print("  2. Open Supabase SQL Editor, paste db_migration_phase_e1.sql, click Run")
print()
print("THEN:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
