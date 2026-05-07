# cleanup_tier_system.py
# Removes the redundant tier system. UserModulesButton.jsx + clf_user_modules
# stay as the sole module-gating path.
#
# What this does:
#   1. Deletes 3 files: useUserTier.js, CommunityApp.jsx, TiersAdminApp.jsx
#   2. Patches App.jsx: removes 4 imports, 2 flags, 2 routing branches
#   3. Patches DirectCreateUserPanel.jsx: removes tier dropdown + state + fetch
#      (keeps the role dropdown -- that's still useful)
#   4. Patches RoleRedirect.jsx: no-role users go to '/' instead of '/community'
#
# Does NOT delete the clf_tiers / clf_tier_modules tables in Supabase.
# Empty tables don't hurt anything; you can drop them manually if you want.
#
# Idempotent. Safe to re-run.

import pathlib, re, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. Delete redundant files
# ============================================================
print("=== Deleting redundant files ===")
to_delete = [
    "src/auth/useUserTier.js",
    "src/community/CommunityApp.jsx",
    "src/tiers-admin/TiersAdminApp.jsx",
]
for rel in to_delete:
    p = ROOT / rel
    if p.exists():
        p.unlink()
        print(f"  deleted  {rel}")
    else:
        print(f"  already gone  {rel}")

# Remove now-empty parent directories
for rel in ["src/community", "src/tiers-admin"]:
    p = ROOT / rel
    if p.exists() and not any(p.iterdir()):
        p.rmdir()
        print(f"  rmdir  {rel}")

# ============================================================
# 2. Patch App.jsx
# ============================================================
print("\n=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")
orig = src

# Remove imports
patterns_to_remove = [
    r"import CommunityApp\s+from\s+'\./community/CommunityApp\.jsx';\s*\n",
    r"import TiersAdminApp\s+from\s+'\./tiers-admin/TiersAdminApp\.jsx';\s*\n",
]
for pat in patterns_to_remove:
    if re.search(pat, src):
        src = re.sub(pat, "", src)
        print(f"  removed import matching: {pat[:50]}...")

# Remove IS_COMMUNITY and IS_TIERS_ADMIN flag declarations
src = re.sub(
    r"const IS_COMMUNITY\s+=\s+window\.location\.pathname\.startsWith\('/community'\);\s*\n",
    "", src)
src = re.sub(
    r"const IS_TIERS_ADMIN\s+=\s+window\.location\.pathname\.startsWith\('/tiers-admin'\);\s*\n",
    "", src)

# Remove routing branches
src = re.sub(
    r":\s*IS_COMMUNITY\s*\?\s*<CommunityApp/>\s*\n\s*",
    "", src)
src = re.sub(
    r":\s*IS_TIERS_ADMIN\s*\?\s*<TiersAdminApp/>\s*\n\s*",
    "", src)

if src != orig:
    app.write_text(src, encoding="utf-8")
    print("  App.jsx written")
else:
    print("  no changes (already clean)")

# ============================================================
# 3. Patch RoleRedirect.jsx: no-role -> '/' instead of '/community'
# ============================================================
print("\n=== Patching src/auth/RoleRedirect.jsx ===")
rr = ROOT / "src" / "auth" / "RoleRedirect.jsx"
if rr.exists():
    src = rr.read_text(encoding="utf-8")
    orig = src
    src = src.replace(
        "window.location.replace(ROLE_HOME[user.role] || '/community');",
        "window.location.replace(ROLE_HOME[user.role] || '/');"
    )
    if src != orig:
        rr.write_text(src, encoding="utf-8")
        print("  no-role landing: /community -> /")
    else:
        print("  no changes")
else:
    print("  RoleRedirect.jsx not found, skipping")

# ============================================================
# 4. Patch DirectCreateUserPanel.jsx: remove tier dropdown
# ============================================================
print("\n=== Patching src/admin/DirectCreateUserPanel.jsx ===")
panel = ROOT / "src" / "admin" / "DirectCreateUserPanel.jsx"
src = panel.read_text(encoding="utf-8")
orig = src

# 4a. Remove tier state declarations and tiers fetch useEffect
# We grep for the Role+tier (NEW) block and remove the tier-specific lines
old_state_block = """  // Role + tier (NEW)
  const [role, setRole]       = useState('student');
  const [tierId, setTierId]   = useState('');
  const [tiers, setTiers]     = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('clf_tiers')
          .select('id, slug, label_zh, label_en')
          .order('sort_order');
        if (!cancelled) setTiers(data || []);
      } catch (e) { console.warn('[tiers fetch]', e); }
    })();
    return () => { cancelled = true; };
  }, []);"""

new_state_block = """  // Role (NEW)
  const [role, setRole] = useState('student');"""

if old_state_block in src:
    src = src.replace(old_state_block, new_state_block)
    print("  removed tier state + fetch (kept role state)")
elif "const [tierId, setTierId]" in src:
    print("  WARN: state block didn't match exactly; trying line-by-line")
    # Fallback: remove specific lines individually
    src = re.sub(r"  const \[tierId, setTierId\]\s*=\s*useState\(''\);\s*\n", "", src)
    src = re.sub(r"  const \[tiers, setTiers\]\s*=\s*useState\(\[\]\);\s*\n", "", src)
    # Remove the useEffect block (rough best-effort)
    src = re.sub(
        r"  useEffect\(\(\) => \{\s*\n\s*let cancelled = false;\s*\n\s*\(async \(\) => \{[^}]*setTiers\(data \|\| \[\]\);[^}]*\}\)\(\);\s*\n\s*return \(\) => \{ cancelled = true; \};\s*\n\s*\}, \[\]\);\s*\n",
        "", src, flags=re.DOTALL)
    print("  fallback patches applied")
else:
    print("  tier state already removed")

# 4b. Replace roleOptions to drop tier_id
src = src.replace(
    "const roleOptions = { role, tier_id: tierId || null };",
    "const roleOptions = { role };"
)

# 4c. Replace RoleTierPicker JSX usage with a Role-only picker
old_picker_jsx = """      <RoleTierPicker role={role} setRole={setRole}
        tierId={tierId} setTierId={setTierId} tiers={tiers}/>"""
new_picker_jsx = """      <RolePicker role={role} setRole={setRole}/>"""
if old_picker_jsx in src:
    src = src.replace(old_picker_jsx, new_picker_jsx)
    print("  swapped <RoleTierPicker> -> <RolePicker>")

# 4d. Replace the RoleTierPicker function definition with a slimmer RolePicker
old_picker_def = """function RoleTierPicker({ role, setRole, tierId, setTierId, tiers }) {"""
if old_picker_def in src:
    # Find the function and replace it entirely
    # Match from 'function RoleTierPicker' through the closing '}' of the function
    new_picker_def = '''function RolePicker({ role, setRole }) {
  return (
    <div style={{
      background: '#fdf6e3', border: `1px solid ${V.border}`,
      borderRadius: 8, padding: 10, marginBottom: 10,
    }}>
      <label style={{ fontSize: 12, color: V.text3, display: 'block', marginBottom: 4 }}>
        \u89d2\u8272 Role
      </label>
      <select value={role} onChange={e => setRole(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px', fontSize: 13,
          border: `1px solid ${V.border}`, borderRadius: 6,
          background: '#fff', color: V.text, boxSizing: 'border-box',
        }}>
        <option value="student">\u5b66\u751f \u00B7 student</option>
        <option value="teacher">\u6559\u5e08 \u00B7 teacher</option>
        <option value="parent">\u5bb6\u957f \u00B7 parent</option>
        <option value="school_master">\u6821\u957f \u00B7 school_master</option>
        <option value="super_admin">\u8d85\u7ba1 \u00B7 super_admin</option>
        <option value="">\u8bbf\u5ba2 \u00B7 (no role / visitor)</option>
      </select>
    </div>
  );
}'''
    # Match function from 'function RoleTierPicker' to its closing '}'
    # The function spans from this line to the line before 'function SingleForm'
    pattern = re.compile(
        r"function RoleTierPicker\(\{[^}]*\}\) \{.*?^\}",
        re.MULTILINE | re.DOTALL
    )
    if pattern.search(src):
        src = pattern.sub(new_picker_def, src, count=1)
        print("  replaced RoleTierPicker function with RolePicker")
    else:
        print("  WARN: couldn't find RoleTierPicker function body to replace")

if src != orig:
    panel.write_text(src, encoding="utf-8")
    print("  DirectCreateUserPanel.jsx written")
else:
    print("  no changes")

# ============================================================
# 5. Verify cleanup
# ============================================================
print("\n=== Verification ===")
remaining = []
for ext in ('*.js', '*.jsx'):
    for p in pathlib.Path('src').rglob(ext):
        text = p.read_text(encoding='utf-8')
        for marker in ['useUserTier', 'TiersAdminApp', 'CommunityApp',
                       'IS_COMMUNITY', 'IS_TIERS_ADMIN', 'clf_tiers',
                       'clf_tier_modules', 'tier_id']:
            if marker in text:
                remaining.append((str(p), marker))

if remaining:
    print("  WARN: still found references:")
    for f, m in remaining:
        print(f"    {f}: {m}")
else:
    print("  CLEAN -- no tier system references remain")

# Files that should be gone
gone_check = [
    "src/auth/useUserTier.js",
    "src/community/CommunityApp.jsx",
    "src/tiers-admin/TiersAdminApp.jsx",
]
for rel in gone_check:
    p = ROOT / rel
    if p.exists():
        print(f"  WARN: {rel} still exists")
    else:
        print(f"  OK: {rel} deleted")

print("\n=== DONE ===")
print()
print("NEXT STEPS:")
print("  1. Restart dev server:")
print("       (Ctrl+C in npm run dev terminal)")
print("       Remove-Item -Recurse -Force node_modules\\.vite -ErrorAction SilentlyContinue")
print("       npm run dev")
print()
print("  2. Test locally:")
print("       /                    -> CLF home")
print("       /login               -> log in")
print("       Log in as super_admin -> /admin")
print("       Create a teacher account in DirectCreateUserPanel")
print("         (Role dropdown: teacher, NO tier dropdown)")
print("       Click the new account -> click \U0001F510 -> module permissions modal")
print("       Adjust modules with the existing UserModulesButton flow")
print()
print("  3. Build + deploy:")
print("       npm run build")
print("       netlify deploy --prod --dir dist --no-build")
print()
print("OPTIONAL:")
print("  Drop the unused SQL tables:")
print("    DROP TABLE IF EXISTS clf_tier_modules CASCADE;")
print("    DROP TABLE IF EXISTS clf_tiers CASCADE;")
print("    ALTER TABLE clf_user_profiles DROP COLUMN IF EXISTS tier_id;")
print("    ALTER TABLE clf_modules DROP COLUMN IF EXISTS is_public;")
