# migrate_school.py
# Phase A: wholesale mount David-Chinese into clf-platform/src/school/
#
# Run from anywhere (uses absolute paths):
#   python migrate_school.py
#
# What it does:
#   1. Deletes the 9 stub files from fix_school.py (Geo chose "discard stubs")
#   2. Copies David-Chinese src/{components,contexts,pages,services,styles}
#      into clf-platform/src/school/
#   3. Copies David-Chinese App.jsx as SchoolApp.jsx with <Router basename="/school">
#   4. Rewrites process.env.REACT_APP_X -> import.meta.env.VITE_X
#   5. Rewrites process.env.PUBLIC_URL  -> import.meta.env.BASE_URL
#   6. Merges .env / .env.production into clf-platform root
#   7. Copies missing Netlify functions from lingua-school
#   8. Reports missing dependencies (does NOT npm install -- you do that)
#
# Idempotent. Run, fix build errors, re-run if needed.

import json, pathlib, re, shutil, sys

DC          = pathlib.Path(r"C:\Users\Lun_z\Desktop\LINGUA\David-Chinese")
LINGUA      = pathlib.Path(r"C:\Users\Lun_z\Desktop\coding_assistant\lingua-school")
CLF         = pathlib.Path(r"C:\Users\Lun_z\Desktop\coding_assistant\clf-platform")
SCHOOL      = CLF / "src" / "school"

for label, p in [("David-Chinese", DC), ("clf-platform", CLF), ("lingua-school", LINGUA)]:
    if not p.exists():
        print(f"ERROR: {label} not found at {p}")
        sys.exit(1)

# ─── 1. delete the 9 stub files we made earlier ───────────────────────────
print("=== Deleting Phase 1 stub files ===")
stubs = [
    "SchoolApp.jsx",
    "guards/RequireSchoolRole.jsx",
    "guards/RoleRedirect.jsx",
    "components/SchoolUnauthed.jsx",
    "components/SchoolPanelShell.jsx",
    "roles/SchoolMasterPanel.jsx",
    "roles/TeacherPanel.jsx",
    "roles/StudentsPanel.jsx",
    "roles/ParentsPanel.jsx",
]
n_del = 0
for stub in stubs:
    p = SCHOOL / stub
    if p.exists():
        p.unlink()
        n_del += 1
        print(f"  deleted  src/school/{stub}")
# remove empty subdirs (only if they're now empty -- new ones may have arrived from copy)
print(f"  {n_del} stubs removed")

# ─── 2. wipe + recreate the school folder, then copy David-Chinese src/ ───
print("\n=== Copying David-Chinese src/ -> clf-platform/src/school/ ===")
# Don't blow away src/school entirely -- empty subdirs from stubs may still be there.
# Just clear out anything we'd be re-copying.
for sub in ["components", "contexts", "pages", "services", "styles"]:
    src_dir = DC / "src" / sub
    if not src_dir.exists():
        print(f"  SKIP   src/{sub}/ (not in David-Chinese)")
        continue
    dst_dir = SCHOOL / sub
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    shutil.copytree(src_dir, dst_dir)
    n = sum(1 for _ in dst_dir.rglob("*") if _.is_file())
    print(f"  copied  src/{sub}/  ({n} files)")

# ─── 3. App.jsx -> SchoolApp.jsx, with basename="/school" ─────────────────
print("\n=== Adapting App.jsx -> src/school/SchoolApp.jsx ===")
src_app = DC / "src" / "App.jsx"
dst_app = SCHOOL / "SchoolApp.jsx"
content = src_app.read_text(encoding="utf-8")

original_size = len(content)

# Header comment
header = (
    "// src/school/SchoolApp.jsx\n"
    "// Migrated from David-Chinese (phase A wholesale mount).\n"
    "// All routes live under /school/* via the basename prop.\n"
    "//\n"
    "// PHASE B TODO: replace this AuthProvider with kechuang's unified one\n"
    "// PHASE C TODO: super_admin should escape /school and redirect to /admin\n"
    "\n"
)
content = header + content

# Add basename="/school" to whichever Router-style is used.
content = re.sub(r"<Router>", r'<Router basename="/school">', content)
content = re.sub(r"<BrowserRouter>", r'<BrowserRouter basename="/school">', content)

# Rename App -> SchoolApp throughout
content = re.sub(r"export default function App\(", "export default function SchoolApp(", content)
content = re.sub(r"^function App\(", "function SchoolApp(", content, flags=re.MULTILINE)
content = re.sub(r"\bconst App\s*=", "const SchoolApp =", content)
content = re.sub(r"export default App\b", "export default SchoolApp", content)
# Self-closing references like <App/> are unusual but possible
content = re.sub(r"<App\s*/>", "<SchoolApp />", content)
content = re.sub(r"<App\s+", "<SchoolApp ", content)

dst_app.write_text(content, encoding="utf-8")
print(f"  wrote SchoolApp.jsx  ({original_size} -> {len(content)} chars)")

# Quick sanity: did the basename actually land somewhere?
if "basename=\"/school\"" not in content:
    print("  WARN: basename=\"/school\" not found in SchoolApp.jsx -- check Router style manually")

# ─── 4. rewrite CRA env vars across the copied tree ──────────────────────
print("\n=== Rewriting CRA env vars across school tree ===")
EVAR_RE       = re.compile(r"process\.env\.REACT_APP_(\w+)")
PUBLIC_URL_RE = re.compile(r"process\.env\.PUBLIC_URL")

n_files_changed = 0
n_evars         = 0
for p in SCHOOL.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx"}:
        continue
    txt = p.read_text(encoding="utf-8", errors="replace")
    new = txt
    new, k1 = EVAR_RE.subn(r"import.meta.env.VITE_\1", new)
    new, k2 = PUBLIC_URL_RE.subn(r"import.meta.env.BASE_URL", new)
    if new != txt:
        p.write_text(new, encoding="utf-8")
        n_files_changed += 1
        n_evars += k1 + k2
        print(f"  fixed  src/school/{p.relative_to(SCHOOL)}  ({k1+k2} replacements)")
print(f"  {n_files_changed} files updated, {n_evars} total replacements")

# ─── 5. merge .env files into clf-platform root ──────────────────────────
print("\n=== Merging .env files into clf-platform root ===")
for envname in [".env", ".env.production", ".env.development", ".env.local"]:
    src_env = DC / envname
    if not src_env.exists():
        continue
    src_text = src_env.read_text(encoding="utf-8", errors="replace")
    # Rename REACT_APP_X= to VITE_X= on whole-line matches
    src_text_v = re.sub(r"^REACT_APP_(\w+)=", r"VITE_\1=", src_text, flags=re.MULTILINE)
    dst_env = CLF / envname
    if dst_env.exists():
        existing = dst_env.read_text(encoding="utf-8", errors="replace")
        existing_keys = set(re.findall(r"^([A-Z_][A-Z0-9_]*)=", existing, flags=re.MULTILINE))
        new_lines = []
        for line in src_text_v.splitlines():
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=", line)
            if m and m.group(1) in existing_keys:
                continue
            new_lines.append(line)
        if new_lines:
            payload = existing.rstrip() + "\n\n# --- merged from David-Chinese (phase A) ---\n" + "\n".join(new_lines) + "\n"
            dst_env.write_text(payload, encoding="utf-8")
            print(f"  merged into  {envname}  (+{len(new_lines)} new keys)")
        else:
            print(f"  no new keys to merge for  {envname}")
    else:
        dst_env.write_text(src_text_v, encoding="utf-8")
        print(f"  copied  {envname}")

# ─── 6. copy lingua-school netlify/functions that aren't in clf-platform ─
print("\n=== Copying Netlify functions from lingua-school ===")
src_fn = LINGUA / "netlify" / "functions"
dst_fn = CLF / "netlify" / "functions"
dst_fn.mkdir(parents=True, exist_ok=True)
existing_fns = {p.name for p in dst_fn.iterdir() if p.is_file()}
n_copied = 0
n_collide = 0
for f in sorted(src_fn.iterdir()):
    if not f.is_file():
        continue
    if f.name == "useDavidAdmin.js":
        # The React hook we removed earlier -- skip
        print(f"  SKIP  {f.name}  (React hook, not a function)")
        continue
    if f.name in existing_fns:
        print(f"  COLLIDE  {f.name}  (already in clf-platform/netlify/functions, NOT overwritten)")
        n_collide += 1
        continue
    shutil.copy2(f, dst_fn / f.name)
    n_copied += 1
    print(f"  copied  {f.name}")
print(f"  {n_copied} new functions, {n_collide} collisions skipped")

# ─── 7. dependency diff (report only) ────────────────────────────────────
print("\n=== Dependency diff ===")
dc_pkg  = json.loads((DC  / "package.json").read_text(encoding="utf-8"))
clf_pkg = json.loads((CLF / "package.json").read_text(encoding="utf-8"))
dc_deps  = dc_pkg.get("dependencies", {})
clf_deps = clf_pkg.get("dependencies", {})

cra_only = {"react-scripts"}  # we don't want this -- clf-platform is Vite
missing  = sorted(set(dc_deps) - set(clf_deps) - cra_only)
print(f"  David-Chinese has {len(dc_deps)} deps, clf-platform has {len(clf_deps)} deps")
print(f"  Missing in clf-platform: {len(missing)}")
if missing:
    install_args = []
    for name in missing:
        ver = dc_deps[name]
        print(f"    {name}@{ver}")
        install_args.append(f"{name}@{ver}")
    print("\n  Install command:")
    print("    npm install " + " ".join(install_args))
else:
    print("  All deps already present.")

# ─── 8. App.jsx (clf-platform root) sanity check ─────────────────────────
print("\n=== clf-platform/src/App.jsx mount check ===")
clf_app = CLF / "src" / "App.jsx"
clf_app_src = clf_app.read_text(encoding="utf-8")
if "import SchoolApp" in clf_app_src and "/school/SchoolApp.jsx" in clf_app_src:
    print("  OK -- App.jsx already imports SchoolApp from src/school/SchoolApp.jsx")
else:
    print("  WARN -- App.jsx is NOT importing the new SchoolApp.")
    print("          Run fix_school.py first to wire IS_SCHOOL routing.")

print("\n=== DONE ===")
print("Next steps:")
print("  1. cd C:\\Users\\Lun_z\\Desktop\\coding_assistant\\clf-platform")
print("  2. npm install ... (the command printed above, if any)")
print("  3. npm run build")
print("  4. Paste the FIRST error and we work through them.")
