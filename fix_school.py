# fix_school.py  (v2 -- super_admin redirects to external /admin)
# Run from clf-platform root: python fix_school.py
#
# Changes vs v1:
#   * RoleRedirect.jsx: super_admin -> window.location.replace('/admin')
#   * SchoolApp.jsx:    /admin/* route removed (super_admin uses existing /admin)
#   * AdminPanel.jsx:   deleted (orphan)
#
# Idempotent. Safe to run after v1 or fresh.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run this from the clf-platform root (no src/App.jsx found)")
    sys.exit(1)

base = ROOT / "src" / "school"
for sub in ["", "guards", "roles", "components"]:
    (base / sub).mkdir(parents=True, exist_ok=True)

# ---- 9 files (AdminPanel.jsx dropped) ----
files = {

    "src/school/SchoolApp.jsx": '''// src/school/SchoolApp.jsx
// Mounted at /school/* -- role-based panels for the David Zhongwen school system.
// Uses the same unified AuthContext as kechuang (single login for whole CLF platform).
//
// NOTE: super_admin does NOT have a /school/admin route -- they use the
// existing CLF /admin (AdminApp). RoleRedirect handles the cross-router jump.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../kechuang/contexts/AuthContext.jsx';
import { LanguageProvider } from '../context/LanguageContext.jsx';

import RequireSchoolRole from './guards/RequireSchoolRole.jsx';
import RoleRedirect      from './guards/RoleRedirect.jsx';
import SchoolUnauthed    from './components/SchoolUnauthed.jsx';

import SchoolMasterPanel from './roles/SchoolMasterPanel.jsx';
import TeacherPanel      from './roles/TeacherPanel.jsx';
import StudentsPanel     from './roles/StudentsPanel.jsx';
import ParentsPanel      from './roles/ParentsPanel.jsx';

function SchoolRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{padding:40,textAlign:'center',color:'#8B4513'}}>Loading\u2026</div>;
  if (!isAuthenticated) return <SchoolUnauthed />;
  return (
    <Routes>
      <Route path="/"               element={<RoleRedirect />} />
      <Route path="/schoolmaster/*" element={<RequireSchoolRole allow={['super_admin','school_master']}><SchoolMasterPanel/></RequireSchoolRole>} />
      <Route path="/teacher/*"      element={<RequireSchoolRole allow={['super_admin','school_master','teacher']}><TeacherPanel/></RequireSchoolRole>} />
      <Route path="/students/*"     element={<RequireSchoolRole allow={['student','teacher','school_master','super_admin']}><StudentsPanel/></RequireSchoolRole>} />
      <Route path="/parents/*"      element={<RequireSchoolRole allow={['parent','teacher','school_master','super_admin']}><ParentsPanel/></RequireSchoolRole>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function SchoolApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/school">
          <SchoolRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
''',

    "src/school/guards/RequireSchoolRole.jsx": '''// Role gate. Redirect or 403 message based on the unified AuthContext role.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../kechuang/contexts/AuthContext.jsx';

export default function RequireSchoolRole({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!allow.includes(user.role)) {
    return (
      <div style={{ padding:40, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>\U0001F6AB</div>
        <div style={{ fontSize:18, color:'#8B4513' }}>\u6743\u9650\u4e0d\u8db3 \u00B7 Access denied</div>
        <div style={{ fontSize:13, color:'#a07850', marginTop:6 }}>
          Your role <code>{user.role}</code> can't access this page.
        </div>
        <a href="/school" style={{ display:'inline-block', marginTop:16, color:'#c41e3a' }}>
          \u2190 Your dashboard
        </a>
      </div>
    );
  }
  return children;
}
''',

    "src/school/guards/RoleRedirect.jsx": '''// /school root -> role-specific landing page.
// super_admin escapes the /school router and goes to the existing CLF /admin.
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../kechuang/contexts/AuthContext.jsx';

// Routes inside /school basename. super_admin handled separately via window.location.
const ROLE_HOME = {
  school_master:  '/schoolmaster',
  teacher:        '/teacher',
  student:        '/students',
  parent:         '/parents',
};

export default function RoleRedirect() {
  const { user, loading } = useAuth();

  // super_admin: jump out of /school router to the existing /admin app.
  useEffect(() => {
    if (!loading && user?.role === 'super_admin') {
      window.location.replace('/admin');
    }
  }, [loading, user]);

  if (loading) return null;
  if (!user)   return <Navigate to="/" replace />;

  if (user.role === 'super_admin') {
    // Briefly visible while the location.replace fires.
    return (
      <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>
        \u8df3\u8f6c\u5230\u7ba1\u7406\u540e\u53f0\u2026 Redirecting to admin\u2026
      </div>
    );
  }

  const dest = ROLE_HOME[user.role];
  if (!dest) {
    return (
      <div style={{ padding:40, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>\U0001F464</div>
        <div style={{ fontSize:18, color:'#8B4513' }}>\u6ca1\u6709\u5b66\u6821\u89d2\u8272</div>
        <div style={{ fontSize:13, color:'#a07850', marginTop:6 }}>
          {user.email} has role <code>{user.role}</code>, no school dashboard yet.
        </div>
        <a href="/" style={{ display:'inline-block', marginTop:16, color:'#c41e3a' }}>
          \u2190 Main app
        </a>
      </div>
    );
  }
  return <Navigate to={dest} replace />;
}
''',

    "src/school/components/SchoolUnauthed.jsx": '''// Shown when an unauthed user lands on /school -- redirects to CLF main entrance.
import React from 'react';

const LOGIN_URL = '/';

export default function SchoolUnauthed() {
  return (
    <div style={{
      minHeight:'100dvh', background:'#fdf6e3',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, gap:14, textAlign:'center',
    }}>
      <div style={{ fontSize:60 }}>\U0001F3EB</div>
      <div style={{ fontSize:28, fontWeight:700, color:'#c41e3a',
        fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>\u5927\u536b\u5b66\u4e2d\u6587 \u00B7 \u5b66\u6821</div>
      <div style={{ fontSize:13, color:'#a07850', maxWidth:340, lineHeight:1.6 }}>
        \u8bf7\u5148\u767b\u5f55\u4e3b\u5e73\u53f0 \u00B7 Please log in via the main platform first
      </div>
      <a href={LOGIN_URL} style={{
        marginTop:8, padding:'10px 22px', borderRadius:8,
        background:'#c41e3a', color:'#fff', fontSize:14,
        textDecoration:'none', fontWeight:500,
      }}>
        Go to login \u2192
      </a>
    </div>
  );
}
''',

    "src/school/components/SchoolPanelShell.jsx": '''// Shared shell for the 4 role panels. Phase 2 lifts the David-Chinese admin UI in here.
import React from 'react';
import { useAuth } from '../../kechuang/contexts/AuthContext.jsx';

export default function SchoolPanelShell({ titleZh, titleEn, accent = '#c41e3a', children }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>
      <div style={{ background: accent, padding:'18px 16px', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700,
              fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>{titleZh}</div>
            <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>
              {titleEn} \u00B7 {user?.email} \u00B7 role: <code>{user?.role}</code>
            </div>
          </div>
          <button onClick={logout} style={{
            padding:'6px 12px', borderRadius:8, border:'1px solid #fff5',
            background:'transparent', color:'#fff', fontSize:12, cursor:'pointer',
          }}>\u9000\u51fa \u00B7 Logout</button>
        </div>
      </div>
      <div style={{ padding:'24px 16px', maxWidth:920, margin:'0 auto' }}>
        {children || (
          <div style={{ background:'#fff', borderRadius:12, padding:32, textAlign:'center',
            border:'1px dashed #e8d5b0', color:'#a07850' }}>
            <div style={{ fontSize:48, marginBottom:8 }}>\U0001F43C</div>
            <div style={{ fontSize:14 }}>
              Phase 2: panel UI from David-Chinese is lifted here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
''',

    "src/school/roles/SchoolMasterPanel.jsx": '''import React from 'react';
import SchoolPanelShell from '../components/SchoolPanelShell.jsx';
export default function SchoolMasterPanel() {
  return <SchoolPanelShell titleZh="\u6821\u957f" titleEn="School Master" />;
}
''',

    "src/school/roles/TeacherPanel.jsx": '''import React from 'react';
import SchoolPanelShell from '../components/SchoolPanelShell.jsx';
export default function TeacherPanel() {
  return <SchoolPanelShell titleZh="\u6559\u5e08" titleEn="Teacher" />;
}
''',

    "src/school/roles/StudentsPanel.jsx": '''import React from 'react';
import SchoolPanelShell from '../components/SchoolPanelShell.jsx';
export default function StudentsPanel() {
  return <SchoolPanelShell titleZh="\u5b66\u751f" titleEn="Student" />;
}
''',

    "src/school/roles/ParentsPanel.jsx": '''import React from 'react';
import SchoolPanelShell from '../components/SchoolPanelShell.jsx';
export default function ParentsPanel() {
  return <SchoolPanelShell titleZh="\u5bb6\u957f" titleEn="Parent" />;
}
''',
}

# ---- Write the 9 files (UTF-8) ----
print("=== Writing 9 school module files (UTF-8) ===")
for path, content in files.items():
    full = ROOT / path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    print(f"  wrote  {path}")

# ---- Delete orphan AdminPanel.jsx if leftover from v1 ----
admin_orphan = ROOT / "src/school/roles/AdminPanel.jsx"
if admin_orphan.exists():
    admin_orphan.unlink()
    print(f"  removed orphan  src/school/roles/AdminPanel.jsx")

# ---- Verify Chinese survived ----
sample = (ROOT / "src/school/roles/SchoolMasterPanel.jsx").read_text(encoding="utf-8")
assert "\u6821\u957f" in sample, "Chinese chars still corrupted!"
print(f"  OK -- SchoolMasterPanel.jsx contains the correct Chinese title")

# ---- Patch App.jsx ----
print("\n=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")
original = src

# 1. Add SchoolApp import after KechuangApp import
import_marker = "import KechuangApp from './kechuang/KechuangApp.jsx';"
import_add    = "\nimport SchoolApp   from './school/SchoolApp.jsx';"
if "from './school/SchoolApp.jsx'" not in src:
    if import_marker in src:
        src = src.replace(import_marker, import_marker + import_add)
        print("  added SchoolApp import")
    else:
        print("  WARN: KechuangApp import line not found verbatim")
else:
    print("  SchoolApp import already present, skipping")

# 2. Add IS_SCHOOL constant after IS_KECHUANG
const_marker = "const IS_KECHUANG = window.location.pathname.startsWith('/kechuang');"
const_add    = "\nconst IS_SCHOOL   = window.location.pathname.startsWith('/school');"
if "IS_SCHOOL" not in src:
    if const_marker in src:
        src = src.replace(const_marker, const_marker + const_add)
        print("  added IS_SCHOOL constant")
    else:
        print("  WARN: IS_KECHUANG line not found verbatim")
else:
    print("  IS_SCHOOL already present, skipping")

# 3. Add SchoolApp branch in the ternary BEFORE IS_KECHUANG branch
ternary_marker = ": IS_KECHUANG ? <LanguageProvider><KechuangApp/></LanguageProvider>"
ternary_add    = ": IS_SCHOOL   ? <SchoolApp/>\n        "
if "<SchoolApp/>" not in src:
    if ternary_marker in src:
        src = src.replace(ternary_marker, ternary_add + ternary_marker)
        print("  added SchoolApp ternary branch")
    else:
        print("  WARN: ternary line not found verbatim")
else:
    print("  SchoolApp branch already present, skipping")

# 4. Patch onKetang button
ketang_old = "onKetang={() => window.open('https://joyful-paletas-0e1f44.netlify.app', '_blank')}"
ketang_new = "onKetang={() => { window.location.href = '/school'; }}"
if ketang_new not in src:
    if ketang_old in src:
        src = src.replace(ketang_old, ketang_new)
        print("  patched onKetang to navigate to /school")
    else:
        print("  WARN: onKetang line not found verbatim (may already be patched)")
else:
    print("  onKetang already pointing at /school, skipping")

if src != original:
    app.write_text(src, encoding="utf-8")
    print("  App.jsx written")
else:
    print("  no changes to App.jsx (already patched or markers not found)")

# ---- Verify ----
print("\n=== App.jsx patch verification ===")
final = app.read_text(encoding="utf-8")
for marker in ["IS_SCHOOL", "SchoolApp", "/school"]:
    hits = [(i+1, line.strip()) for i, line in enumerate(final.split("\n")) if marker in line]
    print(f"  {marker}: {len(hits)} matches")
    for lineno, line in hits[:3]:
        print(f"    L{lineno}: {line[:100]}")

print("\n=== Route map ===")
print("  /school                -> RoleRedirect (per-role landing)")
print("  /admin                 -> existing CLF AdminApp (super_admin)")
print("  /school/schoolmaster   -> SchoolMasterPanel  (super_admin, school_master)")
print("  /school/teacher        -> TeacherPanel       (+teacher)")
print("  /school/students       -> StudentsPanel      (+student)")
print("  /school/parents        -> ParentsPanel       (+parent)")

print("\n=== Done. Now run: npm run build ===")
