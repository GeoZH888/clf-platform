# patch_login_at_root.py
# Makes / the login page. Logged-in users get redirected to role panel.
# - Patches App.jsx routing: removes <UserApp/> fallback, makes / show <LoginGate/>
# - Patches LoginGate.jsx: if user is already logged in -> auto-redirect to role panel
#
# Idempotent.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. Patch App.jsx — replace UserApp fallback with LoginGate
# ============================================================
print("=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")

# Replace the fallback <UserApp/> with <LoginGate/>
# This is the line right above the closing </ErrorBoundary>
old_fallback = ":              <UserApp/>}"
new_fallback = ":              <LoginGate/>}"

if old_fallback in src:
    src = src.replace(old_fallback, new_fallback, 1)
    print("  fallback: <UserApp/> -> <LoginGate/>")
elif new_fallback in src:
    print("  already patched")
else:
    print("  WARN: fallback pattern not found exactly")
    # Try a more generous match
    import re
    pattern = r":\s+<UserApp/>\}"
    if re.search(pattern, src):
        src = re.sub(pattern, ":              <LoginGate/>}", src, count=1)
        print("  fallback patched via regex")

app.write_text(src, encoding="utf-8")
print("  App.jsx written")

# ============================================================
# 2. Patch LoginGate.jsx — auto-redirect already-logged-in users
# ============================================================
print("\n=== Patching src/auth/LoginGate.jsx ===")
gate = ROOT / "src" / "auth" / "LoginGate.jsx"
if not gate.exists():
    print("  ERROR: LoginGate.jsx not found, skipping")
else:
    # Replace entirely with a smart version
    new_gate = '''// src/auth/LoginGate.jsx
// Mounts the David-Chinese login form at / and /login.
// If already authenticated, immediately redirects to /role-redirect.
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import LoginPage from '../school/pages/LoginPage';

function LoginShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Logged in -> bounce to role redirect (which dispatches to role panel)
      window.location.replace('/role-redirect');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fdf6e3', color: '#a07850', fontSize: 14,
      }}>...</div>
    );
  }
  if (user) return null; // useEffect will navigate, render nothing meanwhile

  return <LoginPage />;
}

export default function LoginGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginShell />} />
            <Route path="/login" element={<LoginShell />} />
            <Route path="*" element={<LoginShell />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''
    gate.write_text(new_gate, encoding="utf-8")
    print("  LoginGate.jsx rewritten with auto-redirect-if-logged-in")

# ============================================================
# 3. Verification
# ============================================================
print("\n=== Verification ===")

# App.jsx should have <LoginGate/> as fallback
app_text = app.read_text(encoding="utf-8")
if ":              <LoginGate/>}" in app_text:
    print("  OK: App.jsx fallback is <LoginGate/>")
else:
    print("  WARN: App.jsx fallback didn't update")

# LoginGate should have auto-redirect logic
if gate.exists():
    gate_text = gate.read_text(encoding="utf-8")
    if "window.location.replace('/role-redirect')" in gate_text:
        print("  OK: LoginGate has auto-redirect")
    else:
        print("  WARN: LoginGate auto-redirect missing")

print("\n=== DONE ===")
print()
print("NEXT STEPS:")
print()
print("  1. Stop netlify dev (Ctrl+C in that terminal)")
print()
print("  2. Restart netlify dev:")
print("       netlify dev")
print("     Wait for: Server now ready on http://localhost:8888")
print()
print("  3. Open INCOGNITO at http://localhost:8888/")
print("     - You should see the panda login page IMMEDIATELY (no MainEntrance)")
print("     - Log in as super_admin")
print("     - Should redirect to /role-redirect -> /admin")
print()
print("  4. From /admin, create a teacher:")
print("       Role: teacher")
print("       Username: testteacher")
print("       Password: test1234")
print("       Click 创建账号")
print()
print("  5. Logout, log in as testteacher / test1234")
print("     - Should redirect to /teacher and show full panel")
