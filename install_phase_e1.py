# install_phase_e1.py
# Wire Phase B real pages into Phase D nav structure.
#
# Final teacher panel:
#   班级管理 (/)         -> TeacherHome (existing Phase B dashboard)
#   作业管理 (/homework) -> NEW HomeworkPage (assign + list)
#   作业批改 (/grading)  -> NEW GradingPage (review + comment)
#   教学工具 (/tools)    -> tabs: 备课向导 | 课程 | 资料 (CoursePrepWizard / CoursesPage / MaterialsPage)
#   教学进度 (/progress) -> placeholder (genuinely new feature)
#   消息通知 (/messages) -> tabs: 沟通 | 通知 (CommunicationPage / NoticesPage)
#   个人资料 (/profile)  -> NEW ProfilePage
#
# Run from clf-platform root:
#   python install_phase_e1.py

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# Files to write
# ============================================================
files = {}

# ── New HomeworkPage (teacher) ─────────────────────────────────────
files["src/teacher/pages/HomeworkPage.jsx"] = '''// src/teacher/pages/HomeworkPage.jsx
// Teacher's homework management: list existing + create new
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { Plus, FileText, Calendar } from 'lucide-react';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    class_id: '', title: '', description: '', due_at: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_classes')
      .select('id, name, grade_level')
      .eq('teacher_id', user.id)
      .order('name');
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

  const submit = async () => {
    if (!form.class_id || !form.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('clf_homework').insert({
        class_id: form.class_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_at: form.due_at || null,
        created_by: user.id,
      });
      setForm({ class_id: '', title: '', description: '', due_at: '' });
      setCreating(false);
      load();
    } catch (e) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHero icon="📝" title="作业管理" subtitle="Homework" accentColor="#c41e3a">
        <button onClick={() => setCreating(c => !c)} style={{
          background: '#c41e3a', color: '#fff', border: 'none',
          padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14}/> {creating ? '取消' : '新建作业'}
        </button>
      </PageHero>

      {creating && (
        <div style={panel}>
          <select value={form.class_id} onChange={e => setForm(f => ({...f, class_id: e.target.value}))} style={input}>
            <option value="">选择班级…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            placeholder="作业标题" style={input}/>
          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            placeholder="作业说明（可选）" rows={3} style={{...input, resize: 'vertical'}}/>
          <input type="datetime-local" value={form.due_at}
            onChange={e => setForm(f => ({...f, due_at: e.target.value}))} style={input}/>
          <button onClick={submit} disabled={saving} style={{
            background: '#c41e3a', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, marginTop: 8,
          }}>{saving ? '保存中…' : '发布作业'}</button>
        </div>
      )}

      {classes.length === 0 ? (
        <Empty>还没有班级。请先到「班级管理」创建班级。</Empty>
      ) : items.length === 0 ? (
        <Empty>还没有布置作业。点击上方「新建作业」开始。</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(h => (
            <div key={h.id} style={card}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <FileText size={14} color="#c41e3a"/>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6' }}>{h.title}</div>
                <div style={chip}>{h.clf_classes?.name}</div>
              </div>
              {h.description && (
                <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
                  {h.description}
                </div>
              )}
              {h.due_at && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center',
                  fontSize: 11, color: '#fda4af' }}>
                  <Calendar size={11}/>
                  截止：{new Date(h.due_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const panel = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 12, padding: 16, marginBottom: 18,
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
  borderRadius: 10, padding: 14,
};
const chip = {
  marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 10,
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

# ── New GradingPage (teacher) ─────────────────────────────────────
files["src/teacher/pages/GradingPage.jsx"] = '''// src/teacher/pages/GradingPage.jsx
// Teacher's grading workflow: list submissions -> grade + comment
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { CheckCircle, Clock } from 'lucide-react';

export default function GradingPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_classes').select('id').eq('teacher_id', user.id);
    const classIds = (cls || []).map(c => c.id);
    if (classIds.length === 0) { setPending([]); return; }

    const { data: hw } = await supabase
      .from('clf_homework').select('id').in('class_id', classIds);
    const hwIds = (hw || []).map(h => h.id);
    if (hwIds.length === 0) { setPending([]); return; }

    const { data } = await supabase
      .from('clf_homework_submissions')
      .select('*, clf_homework(title, clf_classes(name))')
      .in('homework_id', hwIds)
      .is('graded_at', null)
      .order('submitted_at', { ascending: true });
    setPending(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const grade = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await supabase.from('clf_homework_submissions').update({
        score: score ? Number(score) : null,
        feedback: feedback.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: user.id,
      }).eq('id', active.id);
      setActive(null); setScore(''); setFeedback('');
      load();
    } catch (e) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHero icon="✅" title="作业批改" subtitle="Grading" accentColor="#c41e3a"/>
      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: active ? '1fr 1.5fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.length === 0 ? (
            <Empty>暂无待批改作业</Empty>
          ) : pending.map(s => (
            <button key={s.id} onClick={() => { setActive(s); setScore(''); setFeedback(''); }} style={{
              background: active?.id === s.id ? 'rgba(196,30,58,0.18)' : 'rgba(253,246,227,0.05)',
              border: `1px solid ${active?.id === s.id ? '#c41e3a' : 'rgba(255,245,230,0.15)'}`,
              borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer',
              color: '#fff5e6',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Clock size={12} color="#fda4af"/>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {s.clf_homework?.title || '(无标题)'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)' }}>
                {s.clf_homework?.clf_classes?.name} · 提交于 {new Date(s.submitted_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {active && (
          <div style={{
            background: 'rgba(253,246,227,0.05)',
            border: '1px solid rgba(255,245,230,0.15)',
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6', marginBottom: 6 }}>
              {active.clf_homework?.title}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 12 }}>
              提交内容：
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8,
              fontSize: 13, color: '#fff5e6', whiteSpace: 'pre-wrap',
              maxHeight: 240, overflowY: 'auto', marginBottom: 14,
            }}>
              {active.content || '(无文字内容)'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="number" value={score} onChange={e => setScore(e.target.value)}
                placeholder="分数 (0-100)" min={0} max={100} style={input}/>
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                placeholder="批语（可选）" rows={4} style={{...input, resize: 'vertical'}}/>
              <button onClick={grade} disabled={saving} style={{
                background: '#10b981', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'inline-flex',
                alignItems: 'center', gap: 6, justifyContent: 'center',
              }}>
                <CheckCircle size={14}/> {saving ? '保存中…' : '完成批改'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit',
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

# ── ToolsPage with tabs (备课向导 / 课程 / 资料) ──────────────────
files["src/teacher/pages/ToolsPage.jsx"] = '''// src/teacher/pages/ToolsPage.jsx
// Tabs: 备课向导 | 课程 | 资料
import React, { useState } from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import CoursePrepWizard from './CoursePrepWizard';
import CoursesPage from './CoursesPage';
import MaterialsPage from './MaterialsPage';

const TABS = [
  { id: 'prep',      label: '备课向导', Component: CoursePrepWizard },
  { id: 'courses',   label: '课程',     Component: CoursesPage },
  { id: 'materials', label: '资料',     Component: MaterialsPage },
];

export default function ToolsPage() {
  const [tab, setTab] = useState('prep');
  const Active = TABS.find(t => t.id === tab)?.Component || CoursePrepWizard;

  return (
    <div>
      <PageHero icon="🛠️" title="教学工具" subtitle="Teaching Tools" accentColor="#c41e3a"/>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18, padding: 4,
        background: 'rgba(253,246,227,0.05)', borderRadius: 10,
        border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: tab === t.id ? '#c41e3a' : 'transparent',
            color: tab === t.id ? '#fff' : 'rgba(253,246,227,0.7)',
            cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t.id ? 700 : 500,
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>
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
'''

# ── MessagesPage with tabs (沟通 / 通知) ──────────────────────────
files["src/teacher/pages/MessagesPage.jsx"] = '''// src/teacher/pages/MessagesPage.jsx
// Tabs: 沟通 | 通知
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
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18, padding: 4,
        background: 'rgba(253,246,227,0.05)', borderRadius: 10,
        border: '1px solid rgba(255,245,230,0.1)', width: 'fit-content',
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
        <Active />
      </div>
    </div>
  );
}
'''

# ── ClassesPage = TeacherHome wrapped in PageHero ─────────────────
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

# ── New ProfilePage ─────────────────────────────────────────────
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
      <div style={{
        marginTop: 14, padding: 12,
        background: 'rgba(253,246,227,0.03)',
        border: '1px dashed rgba(255,245,230,0.15)',
        borderRadius: 10, fontSize: 11,
        color: 'rgba(253,246,227,0.5)', textAlign: 'center',
      }}>
        修改密码、更新头像等功能将在下一期开放
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
# Write them
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
    ('src/teacher/pages/HomeworkPage.jsx', 'clf_homework'),
    ('src/teacher/pages/GradingPage.jsx', 'clf_homework_submissions'),
    ('src/teacher/pages/ToolsPage.jsx', 'CoursePrepWizard'),
    ('src/teacher/pages/MessagesPage.jsx', 'CommunicationPage'),
    ('src/teacher/pages/ClassesPage.jsx', 'TeacherHome'),
    ('src/teacher/pages/ProfilePage.jsx', 'useAuth'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    if marker in p.read_text(encoding="utf-8"):
        print(f"  [OK] {rel}")
    else:
        print(f"  [FAIL] {rel}: missing '{marker}'")
        all_ok = False

# Also check zero raw escapes
import re
for rel in files.keys():
    p = ROOT / rel
    if p.exists():
        n = len(re.findall(r'\\u[0-9a-fA-F]{4}', p.read_text(encoding='utf-8')))
        if n > 0:
            print(f"  [WARN] {rel}: {n} raw escape sequences")
            all_ok = False

print("\n" + ("=== ALL OK ===" if all_ok else "=== SOME FAIL ==="))
print()
print("NEXT:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("AFTER DEPLOY, login as laoshi (teacher):")
print("  /teacher           -> 班级管理 dashboard (TeacherHome live data)")
print("  /teacher/homework  -> create + view homework assignments")
print("  /teacher/grading   -> grade pending submissions")
print("  /teacher/tools     -> tabs: 备课向导 | 课程 | 资料")
print("  /teacher/messages  -> tabs: 沟通 | 通知")
print("  /teacher/profile   -> read-only profile info")
print("  /teacher/progress  -> still placeholder (Phase E.4 work)")
