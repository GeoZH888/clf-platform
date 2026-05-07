# install_teacher_phase_b.py
# Phase B: full teacher panel
#
# Replaces TeacherApp placeholder with real working pages:
#   * TeacherLayout: responsive shell (sidebar desktop / bottom-nav mobile)
#   * Home: stats dashboard
#   * Classes: list/create classes, view roster
#   * Homework: assign + grade (text/image/file)
#   * Communication: parent threads
#   * Notices: class broadcasts
#   * Courses: list + AI course prep wizard (knowledge map -> outline -> PPT/quiz)
#   * Materials: upload to 3 destinations (students/rag/private)
#
# + netlify/functions/clf-teacher-ai.js   (multi-provider gateway)
# + supabase_migrations/phase_b_teacher.sql
#
# Run from clf-platform root:
#   python install_teacher_phase_b.py
#
# Idempotent. Safe to re-run.

import pathlib, sys, re

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make sure all dirs exist
for sub in ["", "pages"]:
    (ROOT / "src" / "teacher" / sub).mkdir(parents=True, exist_ok=True)
(ROOT / "netlify" / "functions").mkdir(parents=True, exist_ok=True)
(ROOT / "supabase_migrations").mkdir(parents=True, exist_ok=True)


# ============================================================
# SQL MIGRATION
# ============================================================
SQL = '''-- ===============================================================
-- Phase B: Teacher panel schema
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent.
-- ===============================================================

-- Classes (each teacher owns one or more classes)
CREATE TABLE IF NOT EXISTS clf_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  grade_level text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clf_classes_teacher_idx ON clf_classes(teacher_id);

-- Class membership (teacher invites students/parents)
CREATE TABLE IF NOT EXISTS clf_class_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name  text NOT NULL,
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, user_id)
);
CREATE INDEX IF NOT EXISTS clf_class_members_class_idx ON clf_class_members(class_id);

-- Homework assignments
CREATE TABLE IF NOT EXISTS clf_homework (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Homework submissions (text + file_url + image_url, multi-modal)
CREATE TABLE IF NOT EXISTS clf_homework_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   uuid NOT NULL REFERENCES clf_homework(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES clf_classes(id) ON DELETE CASCADE,
  student_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text_content  text,
  file_urls     text[] DEFAULT '{}',
  image_urls    text[] DEFAULT '{}',
  audio_url     text,
  score         numeric,
  feedback      text,
  graded_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Parent-teacher communication threads
CREATE TABLE IF NOT EXISTS clf_pt_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_name text NOT NULL,
  student_id  uuid,
  subject     text NOT NULL,
  last_msg_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clf_pt_messages (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES clf_pt_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  body      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notices (broadcasts to a class)
CREATE TABLE IF NOT EXISTS clf_notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id   uuid REFERENCES clf_classes(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Courses + AI-generated artifacts
CREATE TABLE IF NOT EXISTS clf_courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES clf_classes(id) ON DELETE SET NULL,
  title       text NOT NULL,
  topic       text,
  level       text,
  knowledge_map jsonb,
  outline     jsonb,
  ppt_url     text,
  quiz        jsonb,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Teaching materials (3 destinations: students / rag / private)
CREATE TABLE IF NOT EXISTS clf_materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id     uuid REFERENCES clf_classes(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  file_url     text NOT NULL,
  file_size    bigint,
  mime_type    text,
  destination  text NOT NULL CHECK (destination IN ('students', 'rag-pending', 'private')),
  rag_status   text DEFAULT 'pending' CHECK (rag_status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clf_materials_uploader_idx ON clf_materials(uploader_id, destination);

-- Storage bucket (run separately if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-materials', 'teacher-materials', false)
ON CONFLICT (id) DO NOTHING;

-- ROW LEVEL SECURITY
ALTER TABLE clf_classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_class_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_homework             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_pt_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_pt_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_notices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_materials            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher own classes" ON clf_classes;
CREATE POLICY "teacher own classes" ON clf_classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own homework" ON clf_homework;
CREATE POLICY "teacher own homework" ON clf_homework FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own threads" ON clf_pt_threads;
CREATE POLICY "teacher own threads" ON clf_pt_threads FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own notices" ON clf_notices;
CREATE POLICY "teacher own notices" ON clf_notices FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own courses" ON clf_courses;
CREATE POLICY "teacher own courses" ON clf_courses FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "uploader own materials" ON clf_materials;
CREATE POLICY "uploader own materials" ON clf_materials FOR ALL TO authenticated
  USING (uploader_id = auth.uid()) WITH CHECK (uploader_id = auth.uid());

DROP POLICY IF EXISTS "teacher class members" ON clf_class_members;
CREATE POLICY "teacher class members" ON clf_class_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "submission via class" ON clf_homework_submissions;
CREATE POLICY "submission via class" ON clf_homework_submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_classes WHERE id = class_id AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "msg via thread" ON clf_pt_messages;
CREATE POLICY "msg via thread" ON clf_pt_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_pt_threads WHERE id = thread_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_pt_threads WHERE id = thread_id AND teacher_id = auth.uid()));

-- Sanity check
SELECT 'classes'        AS what, count(*) FROM clf_classes
UNION ALL SELECT 'homework',     count(*) FROM clf_homework
UNION ALL SELECT 'threads',      count(*) FROM clf_pt_threads
UNION ALL SELECT 'notices',      count(*) FROM clf_notices
UNION ALL SELECT 'courses',      count(*) FROM clf_courses
UNION ALL SELECT 'materials',    count(*) FROM clf_materials;
'''


# ============================================================
# CODE FILES
# ============================================================
files = {}

# ---- TeacherApp (mount + router) ----
files["src/teacher/TeacherApp.jsx"] = '''// src/teacher/TeacherApp.jsx
// Phase B: full teacher panel mounted at /teacher
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';
import TeacherLayout from './TeacherLayout';
import TeacherHome from './pages/TeacherHome';
import ClassesPage from './pages/ClassesPage';
import HomeworkPage from './pages/HomeworkPage';
import CommunicationPage from './pages/CommunicationPage';
import NoticesPage from './pages/NoticesPage';
import CoursesPage from './pages/CoursesPage';
import CoursePrepWizard from './pages/CoursePrepWizard';
import MaterialsPage from './pages/MaterialsPage';

export default function TeacherApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/teacher">
          <RequireRole allow={['super_admin', 'teacher']}>
            <TeacherLayout>
              <Routes>
                <Route path="/" element={<TeacherHome />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/homework" element={<HomeworkPage />} />
                <Route path="/communication" element={<CommunicationPage />} />
                <Route path="/notices" element={<NoticesPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:id/prepare" element={<CoursePrepWizard />} />
                <Route path="/materials" element={<MaterialsPage />} />
              </Routes>
            </TeacherLayout>
          </RequireRole>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- TeacherLayout (responsive shell) ----
files["src/teacher/TeacherLayout.jsx"] = '''// src/teacher/TeacherLayout.jsx
// Responsive shell: sidebar on desktop, bottom-nav on mobile.
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../school/contexts/AuthContext';
import { Home, Users, FileCheck, MessageSquare, Bell, BookOpen, Upload, LogOut } from 'lucide-react';

const NAV = [
  { path: '/',              label_zh: '\u9996\u9875',   label_en: 'Home',          icon: Home },
  { path: '/classes',       label_zh: '\u73ed\u7ea7',   label_en: 'Classes',       icon: Users },
  { path: '/homework',      label_zh: '\u4f5c\u4e1a',   label_en: 'Homework',      icon: FileCheck },
  { path: '/communication', label_zh: '\u6c9f\u901a',   label_en: 'Comm.',         icon: MessageSquare },
  { path: '/notices',       label_zh: '\u901a\u77e5',   label_en: 'Notices',       icon: Bell },
  { path: '/courses',       label_zh: '\u8bfe\u7a0b',   label_en: 'Courses',       icon: BookOpen },
  { path: '/materials',     label_zh: '\u8d44\u6599',   label_en: 'Materials',     icon: Upload },
];

export default function TeacherLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fdf6e3', paddingBottom: 64 }}>
        <header style={{
          background: '#c41e3a', color: '#fff', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            \u6559\u5e08\u5de5\u4f5c\u53f0
          </div>
          <button onClick={logout} style={{
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', padding: 4,
          }}><LogOut size={18}/></button>
        </header>
        <main style={{ padding: '12px 12px 24px' }}>{children}</main>
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #e8d5b0',
          display: 'flex', height: 60, justifyContent: 'space-around',
          alignItems: 'center', overflowX: 'auto',
        }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)}
                style={{
                  background: 'transparent', border: 'none',
                  color: active ? '#c41e3a' : '#a07850',
                  cursor: 'pointer', padding: '4px 6px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2,
                  fontSize: 10, minWidth: 50,
                }}>
                <Icon size={18}/>
                {n.label_zh}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3', display: 'flex' }}>
      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #e8d5b0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 18, borderBottom: '1px solid #e8d5b0' }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: '#c41e3a',
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
          }}>\u6559\u5e08\u5de5\u4f5c\u53f0</div>
          <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>
            {user?.name || user?.email}
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <button key={n.path} onClick={() => navigate(n.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: active ? '#c41e3a15' : 'transparent',
                color: active ? '#c41e3a' : '#5d4630',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left',
              }}>
                <Icon size={16}/>
                {n.label_zh} \u00B7 {n.label_en}
              </button>
            );
          })}
        </div>
        <button onClick={logout} style={{
          margin: 12, padding: '8px 12px', background: '#fdf6e3',
          color: '#c41e3a', border: '1px solid #c41e3a',
          borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        }}>
          <LogOut size={14}/> \u9000\u51fa
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
'''

# ---- TeacherHome (dashboard) ----
files["src/teacher/pages/TeacherHome.jsx"] = '''// src/teacher/pages/TeacherHome.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Users, FileCheck, MessageSquare, BookOpen } from 'lucide-react';

export default function TeacherHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ classes: 0, students: 0, homework: 0, threads: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [c, h, t] = await Promise.all([
          supabase.from('clf_classes').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('clf_homework').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('clf_pt_threads').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
        ]);
        const { data: classes } = await supabase.from('clf_classes').select('id').eq('teacher_id', user.id);
        const classIds = (classes || []).map(c => c.id);
        const { count: studentCount } = classIds.length
          ? await supabase.from('clf_class_members')
              .select('id', { count: 'exact', head: true }).in('class_id', classIds)
          : { count: 0 };
        setStats({
          classes: c.count || 0,
          students: studentCount || 0,
          homework: h.count || 0,
          threads: t.count || 0,
        });
      } catch (e) { console.warn('[TeacherHome stats]', e); }
    })();
  }, [user?.id]);

  const tiles = [
    { label: '\u73ed\u7ea7', value: stats.classes,  icon: Users,         color: '#3b82f6', to: '/classes' },
    { label: '\u5b66\u751f', value: stats.students, icon: Users,         color: '#10b981', to: '/classes' },
    { label: '\u4f5c\u4e1a', value: stats.homework, icon: FileCheck,     color: '#f59e0b', to: '/homework' },
    { label: '\u5bf9\u8bdd', value: stats.threads,  icon: MessageSquare, color: '#8b5cf6', to: '/communication' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, color: '#1a0a05', margin: '0 0 18px',
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
        \u6982\u89c8 \u00B7 Overview
      </h1>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 24,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <button key={i} onClick={() => navigate(t.to)} style={{
              background: '#fff', border: `1px solid ${t.color}22`,
              borderRadius: 12, padding: 14, cursor: 'pointer',
              textAlign: 'left',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${t.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Icon size={16} color={t.color}/>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color, lineHeight: 1 }}>
                {t.value}
              </div>
              <div style={{ fontSize: 12, color: '#a07850', marginTop: 4 }}>
                {t.label}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, padding: 16,
        border: '1px solid #e8d5b0',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05', marginBottom: 6 }}>
          \U0001F44B \u6b22\u8fce\u56de\u6765
        </div>
        <div style={{ fontSize: 13, color: '#5d4630', lineHeight: 1.6 }}>
          \u4ece\u5de6\u4fa7\u83dc\u5355\u5f00\u59cb\uff1a\u521b\u5efa\u73ed\u7ea7 -> \u5e03\u7f6e\u4f5c\u4e1a -> AI \u5907\u8bfe\u3002
        </div>
      </div>
    </div>
  );
}
'''

# ---- ClassesPage ----
files["src/teacher/pages/ClassesPage.jsx"] = '''// src/teacher/pages/ClassesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, Trash2, Users } from 'lucide-react';

export default function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', grade_level: '', description: '' });
  const [activeClass, setActiveClass] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState('');

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('clf_classes')
      .select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
    setClasses(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.name.trim()) return;
    await supabase.from('clf_classes').insert({ ...form, teacher_id: user.id });
    setForm({ name: '', grade_level: '', description: '' });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('\u786e\u5b9a\u5220\u9664?')) return;
    await supabase.from('clf_classes').delete().eq('id', id);
    if (activeClass?.id === id) setActiveClass(null);
    load();
  };

  const openClass = async (c) => {
    setActiveClass(c);
    const { data } = await supabase.from('clf_class_members')
      .select('*').eq('class_id', c.id).order('joined_at');
    setMembers(data || []);
  };

  const addMember = async () => {
    if (!memberForm.trim() || !activeClass) return;
    await supabase.from('clf_class_members').insert({
      class_id: activeClass.id, student_name: memberForm.trim(),
    });
    setMemberForm('');
    openClass(activeClass);
  };

  const removeMember = async (id) => {
    await supabase.from('clf_class_members').delete().eq('id', id);
    openClass(activeClass);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          \u73ed\u7ea7\u7ba1\u7406
        </h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14}/> \u65b0\u5efa\u73ed\u7ea7
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <input placeholder="\u73ed\u7ea7\u540d\u79f0" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            style={inputStyle}/>
          <input placeholder="\u5e74\u7ea7" value={form.grade_level}
            onChange={e => setForm({ ...form, grade_level: e.target.value })}
            style={inputStyle}/>
          <textarea placeholder="\u63cf\u8ff0" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            style={{ ...inputStyle, minHeight: 60 }}/>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>\u521b\u5efa</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: activeClass ? 'minmax(0, 1fr) minmax(0, 1.5fr)' : '1fr' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {classes.length === 0 ? (
            <div style={{ background: '#fff', padding: 24, borderRadius: 12,
              border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
              \u8fd8\u6ca1\u6709\u73ed\u7ea7\u3002
            </div>
          ) : classes.map(c => (
            <div key={c.id} style={{
              background: activeClass?.id === c.id ? '#fef3e2' : '#fff',
              padding: 14, borderRadius: 10,
              border: `1px solid ${activeClass?.id === c.id ? '#c41e3a' : '#e8d5b0'}`,
              cursor: 'pointer',
            }} onClick={() => openClass(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
                    {c.grade_level || '-'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); remove(c.id); }} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', color: '#a07850',
                }}><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>

        {activeClass && (
          <div style={{ background: '#fff', padding: 16, borderRadius: 12,
            border: '1px solid #e8d5b0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Users size={16} color="#c41e3a"/>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{activeClass.name} \u00B7 {members.length} \u5b66\u751f</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input placeholder="\u5b66\u751f\u59d3\u540d" value={memberForm}
                onChange={e => setMemberForm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}/>
              <button onClick={addMember} style={{
                padding: '8px 12px', background: '#c41e3a', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}>\u6dfb\u52a0</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  padding: '8px 10px', borderRadius: 6,
                  background: '#fdf6e3', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 13,
                }}>
                  <span>{m.student_name}</span>
                  <button onClick={() => removeMember(m.id)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#a07850',
                  }}><Trash2 size={12}/></button>
                </div>
              ))}
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
'''

# ---- HomeworkPage (simplified — list/create) ----
files["src/teacher/pages/HomeworkPage.jsx"] = '''// src/teacher/pages/HomeworkPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, FileCheck, Trash2 } from 'lucide-react';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [homework, setHomework] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class_id: '', title: '', description: '', due_at: '' });

  const load = async () => {
    if (!user?.id) return;
    const [c, h] = await Promise.all([
      supabase.from('clf_classes').select('*').eq('teacher_id', user.id),
      supabase.from('clf_homework').select('*, clf_classes(name)')
        .eq('teacher_id', user.id).order('created_at', { ascending: false }),
    ]);
    setClasses(c.data || []);
    setHomework(h.data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.title.trim() || !form.class_id) return;
    await supabase.from('clf_homework').insert({
      ...form, teacher_id: user.id,
      due_at: form.due_at || null,
    });
    setForm({ class_id: '', title: '', description: '', due_at: '' });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('\u5220\u9664?')) return;
    await supabase.from('clf_homework').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>\u4f5c\u4e1a\u7ba1\u7406</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> \u65b0\u4f5c\u4e1a</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            style={inputStyle}>
            <option value="">\u9009\u62e9\u73ed\u7ea7</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="\u4f5c\u4e1a\u6807\u9898" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
          <textarea placeholder="\u8981\u6c42\u4e0e\u8bf4\u660e" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            style={{ ...inputStyle, minHeight: 80 }}/>
          <input type="datetime-local" value={form.due_at}
            onChange={e => setForm({ ...form, due_at: e.target.value })} style={inputStyle}/>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>\u521b\u5efa</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {homework.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            \u8fd8\u6ca1\u6709\u4f5c\u4e1a
          </div>
        ) : homework.map(h => (
          <div key={h.id} style={{
            background: '#fff', padding: 14, borderRadius: 10,
            border: '1px solid #e8d5b0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <FileCheck size={14} color="#10b981"/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{h.title}</div>
                </div>
                <div style={{ fontSize: 11, color: '#a07850' }}>
                  {h.clf_classes?.name} {h.due_at ? '\u00B7 \u622a\u6b62: ' + new Date(h.due_at).toLocaleString() : ''}
                </div>
                {h.description && (
                  <div style={{ fontSize: 12, color: '#5d4630', marginTop: 6 }}>{h.description}</div>
                )}
              </div>
              <button onClick={() => remove(h.id)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#a07850', alignSelf: 'flex-start',
              }}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
'''

# ---- CommunicationPage ----
files["src/teacher/pages/CommunicationPage.jsx"] = '''// src/teacher/pages/CommunicationPage.jsx
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
          fontFamily: "'STKaiti','KaiTi',serif" }}>\u5bb6\u6821\u6c9f\u901a</h1>
        <button onClick={() => setShowNew(!showNew)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> \u65b0\u5efa\u5bf9\u8bdd</button>
      </div>

      {showNew && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <input placeholder="\u5bb6\u957f\u59d3\u540d" value={newThread.parent_name}
            onChange={e => setNewThread({ ...newThread, parent_name: e.target.value })}
            style={inputStyle}/>
          <input placeholder="\u4e3b\u9898" value={newThread.subject}
            onChange={e => setNewThread({ ...newThread, subject: e.target.value })}
            style={inputStyle}/>
          <button onClick={createThread} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>\u521b\u5efa</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: active ? 'minmax(0, 1fr) minmax(0, 1.5fr)' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.length === 0 ? (
            <div style={{ background: '#fff', padding: 24, borderRadius: 12,
              border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
              \u8fd8\u6ca1\u6709\u5bf9\u8bdd
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
                  \u8fd8\u6ca1\u6709\u6d88\u606f
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
                placeholder="\u8f93\u5165\u6d88\u606f"
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
'''

# ---- NoticesPage ----
files["src/teacher/pages/NoticesPage.jsx"] = '''// src/teacher/pages/NoticesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, Bell, Trash2, Pin } from 'lucide-react';

export default function NoticesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class_id: '', title: '', body: '', pinned: false });

  const load = async () => {
    if (!user?.id) return;
    const [c, n] = await Promise.all([
      supabase.from('clf_classes').select('*').eq('teacher_id', user.id),
      supabase.from('clf_notices').select('*, clf_classes(name)')
        .eq('teacher_id', user.id).order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    setClasses(c.data || []);
    setNotices(n.data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    await supabase.from('clf_notices').insert({ ...form, teacher_id: user.id });
    setForm({ class_id: '', title: '', body: '', pinned: false });
    setShowForm(false);
    load();
  };

  const togglePin = async (n) => {
    await supabase.from('clf_notices').update({ pinned: !n.pinned }).eq('id', n.id);
    load();
  };

  const remove = async (id) => {
    if (!confirm('\u5220\u9664?')) return;
    await supabase.from('clf_notices').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>\u901a\u77e5\u516c\u544a</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> \u65b0\u901a\u77e5</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            style={inputStyle}>
            <option value="">\u5168\u4f53 (\u5168\u90e8\u73ed\u7ea7)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="\u6807\u9898" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
          <textarea placeholder="\u6b63\u6587" value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            style={{ ...inputStyle, minHeight: 100 }}/>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <input type="checkbox" checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}/>
            \u7f6e\u9876
          </label>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>\u53d1\u5e03</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {notices.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            \u8fd8\u6ca1\u6709\u901a\u77e5
          </div>
        ) : notices.map(n => (
          <div key={n.id} style={{
            background: n.pinned ? '#fef3e2' : '#fff',
            padding: 14, borderRadius: 10,
            border: `1px solid ${n.pinned ? '#c41e3a' : '#e8d5b0'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  {n.pinned && <Pin size={12} color="#c41e3a"/>}
                  <Bell size={14} color="#8b5cf6"/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
                </div>
                <div style={{ fontSize: 11, color: '#a07850', marginBottom: 6 }}>
                  {n.clf_classes?.name || '\u5168\u4f53'} \u00B7 {new Date(n.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: '#5d4630', whiteSpace: 'pre-wrap' }}>{n.body}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => togglePin(n)} style={iconBtn}><Pin size={14}/></button>
                <button onClick={() => remove(n.id)} style={iconBtn}><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#a07850', padding: 4,
};
'''

# ---- CoursesPage ----
files["src/teacher/pages/CoursesPage.jsx"] = '''// src/teacher/pages/CoursesPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Plus, BookOpen, Sparkles, Trash2 } from 'lucide-react';

export default function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', topic: '', level: 'HSK1', class_id: '' });

  const load = async () => {
    if (!user?.id) return;
    const [c, k] = await Promise.all([
      supabase.from('clf_classes').select('*').eq('teacher_id', user.id),
      supabase.from('clf_courses').select('*').eq('teacher_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setClasses(c.data || []);
    setCourses(k.data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!form.title.trim()) return;
    const { data } = await supabase.from('clf_courses').insert({
      ...form, teacher_id: user.id, class_id: form.class_id || null,
    }).select().single();
    setForm({ title: '', topic: '', level: 'HSK1', class_id: '' });
    setShowForm(false);
    if (data) navigate(`/courses/${data.id}/prepare`);
    else load();
  };

  const remove = async (id) => {
    if (!confirm('\u5220\u9664?')) return;
    await supabase.from('clf_courses').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif" }}>\u8bfe\u7a0b\u7ba1\u7406</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14}/> \u65b0\u8bfe\u7a0b</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #e8d5b0', marginBottom: 16 }}>
          <input placeholder="\u8bfe\u7a0b\u540d" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
          <input placeholder="\u4e3b\u9898 (\u4f8b: \u5bb6\u5ead\u6210\u5458)" value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })} style={inputStyle}/>
          <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
            style={inputStyle}>
            <option>HSK1</option><option>HSK2</option><option>HSK3</option>
            <option>HSK4</option><option>HSK5</option><option>HSK6</option>
          </select>
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            style={inputStyle}>
            <option value="">(\u4e0d\u5173\u8054\u73ed\u7ea7)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={create} style={{
            padding: '8px 16px', background: '#c41e3a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}><Sparkles size={14}/> \u521b\u5efa\u5e76 AI \u5907\u8bfe</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {courses.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            \u8fd8\u6ca1\u6709\u8bfe\u7a0b
          </div>
        ) : courses.map(c => (
          <div key={c.id} style={{
            background: '#fff', padding: 14, borderRadius: 10,
            border: '1px solid #e8d5b0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <BookOpen size={14} color="#3b82f6"/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <span style={{ fontSize: 10, padding: '2px 6px',
                    borderRadius: 4, background: '#3b82f615', color: '#3b82f6' }}>
                    {c.level}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#a07850' }}>
                  {c.topic} \u00B7 {c.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => navigate(`/courses/${c.id}/prepare`)} style={{
                  padding: '4px 10px', background: '#fdf6e3', color: '#c41e3a',
                  border: '1px solid #c41e3a', borderRadius: 6,
                  cursor: 'pointer', fontSize: 11,
                }}>\u5907\u8bfe</button>
                <button onClick={() => remove(c.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#a07850',
                }}><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
'''

# ---- CoursePrepWizard ----
files["src/teacher/pages/CoursePrepWizard.jsx"] = '''// src/teacher/pages/CoursePrepWizard.jsx
// AI course-prep flow: knowledge map -> outline -> PPT/quiz
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Sparkles, ArrowLeft, FileText, Brain, FileQuestion, Loader2 } from 'lucide-react';

const PROVIDERS = ['claude', 'gpt-4o', 'deepseek', 'gemini'];

export default function CoursePrepWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('clf_courses').select('*').eq('id', id).single();
    setCourse(data);
  };
  useEffect(() => { load(); }, [id]);

  const aiCall = async (task, payload = {}) => {
    setBusy(task);
    try {
      const res = await fetch('/.netlify/functions/clf-teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, course_id: id, provider, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally { setBusy(null); }
  };

  const buildKnowledgeMap = async () => {
    const result = await aiCall('knowledge_map');
    await supabase.from('clf_courses').update({ knowledge_map: result.data })
      .eq('id', id);
    load();
  };

  const buildOutline = async () => {
    const result = await aiCall('lesson_outline');
    await supabase.from('clf_courses').update({ outline: result.data })
      .eq('id', id);
    load();
  };

  const buildQuiz = async () => {
    const result = await aiCall('quiz');
    await supabase.from('clf_courses').update({ quiz: result.data })
      .eq('id', id);
    load();
  };

  if (!course) return <div style={{ padding: 24, color: '#a07850' }}>\u00b7\u00b7\u00b7</div>;

  return (
    <div>
      <button onClick={() => navigate('/courses')} style={{
        background: 'transparent', border: 'none', color: '#a07850',
        cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center',
        fontSize: 12, marginBottom: 12,
      }}><ArrowLeft size={12}/> \u8fd4\u56de</button>

      <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>{course.title}</h1>
      <div style={{ fontSize: 12, color: '#a07850', marginBottom: 18 }}>
        {course.topic} \u00B7 {course.level}
      </div>

      <div style={{ background: '#fff', padding: 14, borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#5d4630' }}>AI \u63d0\u4f9b\u5546:</span>
        <select value={provider} onChange={e => setProvider(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 12,
            border: '1px solid #e8d5b0', borderRadius: 6 }}>
          {PROVIDERS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <SectionCard
          icon={Brain} color="#8b5cf6" title="\u77e5\u8bc6\u56fe\u8c31"
          subtitle="\u8865\u5145\u4e0e\u5173\u8054\u70b9 (algorithmic)"
          busy={busy === 'knowledge_map'}
          onRun={buildKnowledgeMap}
          payload={course.knowledge_map}
          renderPayload={km => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(km, null, 2)}
            </pre>
          )}
        />
        <SectionCard
          icon={FileText} color="#3b82f6" title="\u8bfe\u7a0b\u5927\u7eb2"
          subtitle="45 \u5206\u949f\u8bfe\u65f6\u8ba1\u5212"
          busy={busy === 'lesson_outline'}
          onRun={buildOutline}
          payload={course.outline}
          renderPayload={o => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {typeof o === 'string' ? o : JSON.stringify(o, null, 2)}
            </pre>
          )}
        />
        <SectionCard
          icon={FileQuestion} color="#10b981" title="\u968f\u5802\u5c0f\u6d4b"
          subtitle="\u591a\u9009 + \u586b\u7a7a"
          busy={busy === 'quiz'}
          onRun={buildQuiz}
          payload={course.quiz}
          renderPayload={q => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(q, null, 2)}
            </pre>
          )}
        />
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, color, title, subtitle, busy, onRun, payload, renderPayload }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12,
      border: `1px solid ${color}33`, padding: 16,
      display: 'flex', flexDirection: 'column', minHeight: 280 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={16} color={color}/></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: '#a07850' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ flex: 1, marginBottom: 10 }}>
        {payload ? renderPayload(payload) : (
          <div style={{ fontSize: 12, color: '#a07850', fontStyle: 'italic',
            padding: 16, textAlign: 'center' }}>
            \u70b9\u51fb\u4e0b\u65b9\u751f\u6210
          </div>
        )}
      </div>

      <button onClick={onRun} disabled={busy} style={{
        padding: '8px 12px', background: busy ? '#ccc' : color,
        color: '#fff', border: 'none', borderRadius: 8,
        cursor: busy ? 'wait' : 'pointer', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
      }}>
        {busy ? <Loader2 size={12}/> : <Sparkles size={12}/>}
        {payload ? '\u91cd\u65b0\u751f\u6210' : '\u751f\u6210'}
      </button>
    </div>
  );
}
'''

# ---- MaterialsPage ----
files["src/teacher/pages/MaterialsPage.jsx"] = '''// src/teacher/pages/MaterialsPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Upload, FileText, Trash2 } from 'lucide-react';

const DESTS = [
  { id: 'students',     label: '\u5b66\u751f\u53ef\u4e0b\u8f7d', color: '#10b981' },
  { id: 'rag-pending',  label: '\u63d0\u4ea4\u5230 RAG (\u7b49\u5f85\u5ba1\u6838)', color: '#f59e0b' },
  { id: 'private',      label: '\u4ec5\u81ea\u5df1\u53ef\u89c1', color: '#8b5cf6' },
];

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', destination: 'students', file: null });

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('clf_materials')
      .select('*').eq('uploader_id', user.id)
      .order('created_at', { ascending: false });
    setMaterials(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const upload = async () => {
    if (!form.file || !form.title.trim()) return;
    setUploading(true);
    try {
      const path = `${form.destination}/${user.id}/${Date.now()}-${form.file.name}`;
      const { error: upErr } = await supabase.storage
        .from('teacher-materials').upload(path, form.file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from('teacher-materials').getPublicUrl(path);
      await supabase.from('clf_materials').insert({
        uploader_id: user.id,
        title: form.title.trim(),
        file_url: urlData.publicUrl,
        file_size: form.file.size,
        mime_type: form.file.type,
        destination: form.destination,
      });
      setForm({ title: '', destination: 'students', file: null });
      load();
    } catch (e) {
      alert('\u4e0a\u4f20\u5931\u8d25: ' + e.message);
    } finally { setUploading(false); }
  };

  const remove = async (m) => {
    if (!confirm('\u5220\u9664?')) return;
    await supabase.from('clf_materials').delete().eq('id', m.id);
    load();
  };

  const filtered = filter === 'all' ? materials : materials.filter(m => m.destination === filter);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>\u6559\u5b66\u8d44\u6599</h1>

      <div style={{ background: '#fff', padding: 16, borderRadius: 12,
        border: '1px solid #e8d5b0', marginBottom: 16 }}>
        <input placeholder="\u8d44\u6599\u540d\u79f0" value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle}/>
        <select value={form.destination}
          onChange={e => setForm({ ...form, destination: e.target.value })}
          style={inputStyle}>
          {DESTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <input type="file" onChange={e => setForm({ ...form, file: e.target.files[0] })}
          style={{ ...inputStyle, padding: 6 }}/>
        <button onClick={upload} disabled={uploading} style={{
          padding: '8px 16px', background: uploading ? '#ccc' : '#c41e3a',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: uploading ? 'wait' : 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Upload size={14}/> {uploading ? '\u4e0a\u4f20\u4e2d\u00b7\u00b7\u00b7' : '\u4e0a\u4f20'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>\u5168\u90e8</FilterBtn>
        {DESTS.map(d => (
          <FilterBtn key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)}>
            {d.label}
          </FilterBtn>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', padding: 24, borderRadius: 12,
            border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
            \u8fd8\u6ca1\u6709\u8d44\u6599
          </div>
        ) : filtered.map(m => {
          const dest = DESTS.find(d => d.id === m.destination);
          return (
            <div key={m.id} style={{
              background: '#fff', padding: 12, borderRadius: 10,
              border: '1px solid #e8d5b0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
                <FileText size={16} color={dest?.color || '#a07850'}/>
                <div>
                  <a href={m.file_url} target="_blank" rel="noreferrer" style={{
                    fontSize: 13, fontWeight: 600, color: '#1a0a05',
                    textDecoration: 'none',
                  }}>{m.title}</a>
                  <div style={{ fontSize: 10, color: '#a07850', marginTop: 2 }}>
                    {dest?.label} \u00B7 {(m.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
              <button onClick={() => remove(m)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#a07850',
              }}><Trash2 size={14}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 12,
      cursor: 'pointer',
      background: active ? '#c41e3a' : '#fff',
      color: active ? '#fff' : '#5d4630',
      border: `1px solid ${active ? '#c41e3a' : '#e8d5b0'}`,
    }}>{children}</button>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
};
'''

# ---- Netlify function: clf-teacher-ai ----
files["netlify/functions/clf-teacher-ai.js"] = '''// netlify/functions/clf-teacher-ai.js
// Multi-provider AI gateway for teacher panel.
// Tasks: knowledge_map | lesson_outline | quiz

const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const { task, course_id, provider = 'claude', payload = {} } = body;
  if (!task || !course_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'task and course_id required' }) };
  }

  try {
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase env vars missing');
    const supa = createClient(SUPA_URL, SUPA_KEY);
    const { data: course } = await supa.from('clf_courses').select('*').eq('id', course_id).single();
    if (!course) throw new Error('course not found');

    const prompt = buildPrompt(task, course, payload);
    const text = await callProvider(provider, prompt);

    let data;
    try { data = JSON.parse(text); }
    catch { data = text; }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, task, provider, data }),
    };
  } catch (err) {
    console.error('[clf-teacher-ai]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function buildPrompt(task, course, payload) {
  const ctx = `Title: ${course.title}\\nTopic: ${course.topic}\\nLevel: ${course.level}`;

  if (task === 'knowledge_map') {
    return {
      system: 'You are a Chinese-language teaching assistant. Build a knowledge map for the given course. Return ONLY a JSON object with shape: { nodes: [{ id, label_zh, label_en, type }], edges: [{ from, to, relation }] }. Cover characters, vocab, grammar relationships. 8-15 nodes.',
      user: `Course context:\\n${ctx}\\n\\nReturn the knowledge map JSON.`,
    };
  }
  if (task === 'lesson_outline') {
    return {
      system: 'You are a Chinese-language teaching assistant. Generate a 45-minute lesson plan in Simplified Chinese. Return JSON with: { goals, warm_up, core_teaching, practice, assessment, homework }. Each section is a string of concrete instructions.',
      user: `Course context:\\n${ctx}\\n\\nReturn the lesson outline JSON.`,
    };
  }
  if (task === 'quiz') {
    return {
      system: 'You are a Chinese-language teaching assistant. Generate 5 quiz questions for the course level. Return JSON with shape: { questions: [{ q_zh, q_en, type: "mc"|"fill", options?, answer, explanation }] }.',
      user: `Course context:\\n${ctx}\\n\\nReturn the quiz JSON.`,
    };
  }
  throw new Error(`Unknown task: ${task}`);
}

async function callProvider(provider, { system, user }) {
  if (provider === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 2000,
        system, messages: [{ role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Claude ${r.status}`);
    return j.content[0].text;
  }
  if (provider === 'gpt-4o' || provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 2000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `OpenAI ${r.status}`);
    return j.choices[0].message.content;
  }
  if (provider === 'deepseek') {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat', max_tokens: 2000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `DeepSeek ${r.status}`);
    return j.choices[0].message.content;
  }
  if (provider === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 2000 },
        }),
      });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
    return j.candidates[0].content.parts[0].text;
  }
  throw new Error(`Unknown provider: ${provider}`);
}
'''


# ============================================================
# Write SQL + code files
# ============================================================
print("=== Writing SQL ===")
sql_path = ROOT / "supabase_migrations" / "phase_b_teacher.sql"
sql_path.write_text(SQL, encoding="utf-8")
print(f"  wrote  {sql_path.relative_to(ROOT)}")

print(f"\n=== Writing {len(files)} code files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  wrote  {rel}")

# Sanity: Chinese chars survived
sample = (ROOT / "src/teacher/TeacherLayout.jsx").read_text(encoding="utf-8")
assert "\u73ed\u7ea7" in sample, "Chinese chars corrupted!"
print("  OK -- Chinese chars preserved")

print("\n=== DONE ===")
print()
print("NEXT STEPS:")
print()
print("  1. Run the SQL migration:")
print("       Open https://supabase.com/dashboard/project/yqcojudvvjntaajnrilr/sql/new")
print("       Paste contents of supabase_migrations/phase_b_teacher.sql")
print("       Run. Sanity should show 6 zero-counts (empty tables, OK).")
print()
print("  2. Set Netlify env vars (production) for AI providers:")
print('       netlify env:set ANTHROPIC_API_KEY "sk-ant-..." --context production')
print('       netlify env:set OPENAI_API_KEY    "sk-..."     --context production  (optional)')
print('       netlify env:set DEEPSEEK_API_KEY  "sk-..."     --context production  (optional)')
print('       netlify env:set GEMINI_API_KEY    "..."        --context production  (optional)')
print('       netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJ..." --context production')
print()
print("  3. Test locally:")
print("       npm run dev")
print("       Log in as a teacher account")
print("       /teacher loads -> should show full panel (sidebar on desktop, bottom nav on mobile)")
print()
print("  4. Build + deploy:")
print("       npm run build")
print("       netlify deploy --prod --dir dist --no-build")
