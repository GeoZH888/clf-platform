# patch_role_tier_creation.py
# Adds role + tier dropdowns to DirectCreateUserPanel and wires them through
# the netlify function. Also fixes:
#   - Duplicate-key bug: profile insert -> upsert with onConflict
#   - Mojibate error strings in admin-create-user.js
#
# Run from clf-platform root:
#   python patch_role_tier_creation.py
#
# Idempotent. Re-runnable.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. Patch netlify/functions/admin-create-user.js
# ============================================================
print("=== Patching netlify/functions/admin-create-user.js ===")
fn_path = ROOT / "netlify" / "functions" / "admin-create-user.js"
src = fn_path.read_text(encoding="utf-8")

# 1a. Fix the mojibate error strings
src = src.replace("'å§“åå¿…å¡«'", "'\u59d3\u540d\u5fc5\u586b'")  # 姓名必填
src = src.replace("'è¯·æ¾›è‡³å°‘ä¸€ä¸ªå§“å'", "'\u8bf7\u586b\u81f3\u5c11\u4e00\u4e2a\u59d3\u540d'")  # 请填至少一个姓名
src = src.replace("'æ‰¹é‡æœ€å¤š 100 ä¸ª'", "'\u6279\u91cf\u6700\u591a 100 \u4e2a'")  # 批量最多 100 个

# 1b. Add tier_id to createOne signature & profile row
old_signature = "async function createOne({ name, username, password, email, adminUser, role,\n                          generateQrToken, maxDevices, expiresAt, label }) {"
new_signature = "async function createOne({ name, username, password, email, adminUser, role, tier_id,\n                          generateQrToken, maxDevices, expiresAt, label }) {"
if old_signature in src:
    src = src.replace(old_signature, new_signature)
    print("  added tier_id to createOne signature")
elif "tier_id" in src:
    print("  signature already has tier_id")
else:
    print("  WARN: createOne signature didn't match, manual edit may be needed")

# 1c. Add tier_id to profileRow object
old_profile_row = """  const profileRow = {
    user_id: userId,
    email: fakeEmail,
    role: finalRole,
    display_name: name.trim(),
    is_active: true,
  };"""
new_profile_row = """  const profileRow = {
    user_id: userId,
    email: fakeEmail,
    role: finalRole,
    display_name: name.trim(),
    is_active: true,
    tier_id: tier_id || null,
  };"""
if old_profile_row in src:
    src = src.replace(old_profile_row, new_profile_row)
    print("  added tier_id to profileRow")
elif "tier_id: tier_id || null" in src:
    print("  profileRow already has tier_id")
else:
    print("  WARN: profileRow didn't match")

# 1d. Switch insert to upsert (kills dup-key bug from on_auth_user_created trigger)
old_insert = """  const { error: profErr } = await supabase
    .from('clf_user_profiles')
    .insert(profileRow);"""
new_insert = """  const { error: profErr } = await supabase
    .from('clf_user_profiles')
    .upsert(profileRow, { onConflict: 'user_id' });"""
if old_insert in src:
    src = src.replace(old_insert, new_insert)
    print("  switched profile insert -> upsert (fixes dup-key bug)")
elif "upsert(profileRow" in src:
    print("  already using upsert")
else:
    print("  WARN: insert pattern didn't match")

# 1e. Make batch mode pass tier_id through (it already passes role)
old_batch_call = """        const r = await createOne({
          name: rawName, adminUser,
          role: body.role,
          ...qrOpts,
          label: body.labelPrefix ? `${body.labelPrefix} #${i + 1}` : null,
        });"""
new_batch_call = """        const r = await createOne({
          name: rawName, adminUser,
          role: body.role,
          tier_id: body.tier_id,
          ...qrOpts,
          label: body.labelPrefix ? `${body.labelPrefix} #${i + 1}` : null,
        });"""
if old_batch_call in src:
    src = src.replace(old_batch_call, new_batch_call)
    print("  added tier_id to batch mode")
elif "tier_id: body.tier_id" in src:
    print("  batch mode already passes tier_id")

fn_path.write_text(src, encoding="utf-8")
print("  admin-create-user.js written")

# ============================================================
# 2. Patch src/admin/DirectCreateUserPanel.jsx
# ============================================================
print("\n=== Patching src/admin/DirectCreateUserPanel.jsx ===")
panel_path = ROOT / "src" / "admin" / "DirectCreateUserPanel.jsx"
panel = panel_path.read_text(encoding="utf-8")

# 2a. Add tiers fetch + role/tier state at top of DirectCreateUserPanel
# Find a good anchor: the existing useState lines
old_state_block = """export default function DirectCreateUserPanel() {
  const [mode, setMode] = useState('single');
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [creating, setCreating] = useState(false);

  // Shared QR options
  const [generateQr, setGenerateQr] = useState(true);
  const [maxDevices, setMaxDevices] = useState(2);
  const [expiryDays, setExpiryDays] = useState(30);
  const [label, setLabel] = useState('');"""

new_state_block = """export default function DirectCreateUserPanel() {
  const [mode, setMode] = useState('single');
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [creating, setCreating] = useState(false);

  // Shared QR options
  const [generateQr, setGenerateQr] = useState(true);
  const [maxDevices, setMaxDevices] = useState(2);
  const [expiryDays, setExpiryDays] = useState(30);
  const [label, setLabel] = useState('');

  // Role + tier (NEW)
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

if old_state_block in panel:
    panel = panel.replace(old_state_block, new_state_block)
    print("  added role + tier state + tiers fetch")
elif "const [role, setRole]" in panel:
    print("  role/tier state already present")
else:
    print("  WARN: state block didn't match exactly")

# 2b. Pass role + tierId into the qrOptions sibling object so forms can read them
# We'll create a roleOptions prop that we pass alongside qrOptions
# Find the qrOptions object and add a roleOptions next to it
old_qr_options = """  const qrOptions = {
    generateQrToken: generateQr,
    maxDevices,
    expiresAt: expiryDays > 0
      ? new Date(Date.now() + expiryDays * 864e5).toISOString()
      : null,
  };"""

new_qr_options = """  const qrOptions = {
    generateQrToken: generateQr,
    maxDevices,
    expiresAt: expiryDays > 0
      ? new Date(Date.now() + expiryDays * 864e5).toISOString()
      : null,
  };

  const roleOptions = { role, tier_id: tierId || null };"""

if old_qr_options in panel:
    panel = panel.replace(old_qr_options, new_qr_options)
    print("  added roleOptions object")
elif "const roleOptions" in panel:
    print("  roleOptions already present")

# 2c. Insert RoleTierPicker UI right after QrOptionsPanel
old_qr_panel_jsx = """      <QrOptionsPanel
        generateQr={generateQr} setGenerateQr={setGenerateQr}
        maxDevices={maxDevices} setMaxDevices={setMaxDevices}
        expiryDays={expiryDays} setExpiryDays={setExpiryDays}
        label={label} setLabel={setLabel}
        showLabelField={mode === 'single'}/>"""

new_qr_panel_jsx = """      <QrOptionsPanel
        generateQr={generateQr} setGenerateQr={setGenerateQr}
        maxDevices={maxDevices} setMaxDevices={setMaxDevices}
        expiryDays={expiryDays} setExpiryDays={setExpiryDays}
        label={label} setLabel={setLabel}
        showLabelField={mode === 'single'}/>

      <RoleTierPicker role={role} setRole={setRole}
        tierId={tierId} setTierId={setTierId} tiers={tiers}/>"""

if old_qr_panel_jsx in panel:
    panel = panel.replace(old_qr_panel_jsx, new_qr_panel_jsx)
    print("  inserted RoleTierPicker JSX")
elif "<RoleTierPicker" in panel:
    print("  RoleTierPicker already in JSX")

# 2d. Pass roleOptions to both forms
old_single_form = """        ? <SingleForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} label={label}
            onResult={r => setResults(prev => [r, ...prev])}/>"""
new_single_form = """        ? <SingleForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} roleOptions={roleOptions} label={label}
            onResult={r => setResults(prev => [r, ...prev])}/>"""
if old_single_form in panel:
    panel = panel.replace(old_single_form, new_single_form)
    print("  passed roleOptions to SingleForm")

old_batch_form = """        : <BatchForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} labelPrefix={label}
            onResults={(rs, es) => { setResults(rs); setErrors(es); }}/>}"""
new_batch_form = """        : <BatchForm call={call} creating={creating} setCreating={setCreating}
            qrOptions={qrOptions} roleOptions={roleOptions} labelPrefix={label}
            onResults={(rs, es) => { setResults(rs); setErrors(es); }}/>}"""
if old_batch_form in panel:
    panel = panel.replace(old_batch_form, new_batch_form)
    print("  passed roleOptions to BatchForm")

# 2e. Update SingleForm signature + submit to use roleOptions
old_single_sig = """function SingleForm({ call, creating, setCreating, qrOptions, label, onResult }) {"""
new_single_sig = """function SingleForm({ call, creating, setCreating, qrOptions, roleOptions, label, onResult }) {"""
if old_single_sig in panel:
    panel = panel.replace(old_single_sig, new_single_sig)
    print("  added roleOptions to SingleForm signature")

old_single_submit = """      const { result } = await call({
        mode: 'single',
        name, username: username || undefined,
        password: password || undefined, email: email || undefined,
        ...qrOptions, label: label || null,
      });"""
new_single_submit = """      const { result } = await call({
        mode: 'single',
        name, username: username || undefined,
        password: password || undefined, email: email || undefined,
        ...qrOptions, ...roleOptions, label: label || null,
      });"""
if old_single_submit in panel:
    panel = panel.replace(old_single_submit, new_single_submit)
    print("  added roleOptions to SingleForm submit")

# 2f. Update BatchForm signature + submit
old_batch_sig = """function BatchForm({ call, creating, setCreating, qrOptions, labelPrefix, onResults }) {"""
new_batch_sig = """function BatchForm({ call, creating, setCreating, qrOptions, roleOptions, labelPrefix, onResults }) {"""
if old_batch_sig in panel:
    panel = panel.replace(old_batch_sig, new_batch_sig)
    print("  added roleOptions to BatchForm signature")

old_batch_submit = """      const data = await call({ mode: 'batch', names: list,
        ...qrOptions, labelPrefix: labelPrefix || null });"""
new_batch_submit = """      const data = await call({ mode: 'batch', names: list,
        ...qrOptions, ...roleOptions, labelPrefix: labelPrefix || null });"""
if old_batch_submit in panel:
    panel = panel.replace(old_batch_submit, new_batch_submit)
    print("  added roleOptions to BatchForm submit")

# 2g. Add the RoleTierPicker component definition before SingleForm
ROLE_TIER_PICKER = '''
function RoleTierPicker({ role, setRole, tierId, setTierId, tiers }) {
  return (
    <div style={{
      background: '#fdf6e3', border: `1px solid ${V.border}`,
      borderRadius: 8, padding: 10, marginBottom: 10,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
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
        <div>
          <label style={{ fontSize: 12, color: V.text3, display: 'block', marginBottom: 4 }}>
            \u7b49\u7ea7 Tier
          </label>
          <select value={tierId} onChange={e => setTierId(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: `1px solid ${V.border}`, borderRadius: 6,
              background: '#fff', color: V.text, boxSizing: 'border-box',
            }}>
            <option value="">(default / no tier)</option>
            {tiers.map(t => (
              <option key={t.id} value={t.id}>
                {t.label_zh} \u00B7 {t.label_en}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

'''

if "function RoleTierPicker(" not in panel:
    # Insert before the SingleForm definition
    anchor = "function SingleForm({"
    if anchor in panel:
        panel = panel.replace(anchor, ROLE_TIER_PICKER + anchor, 1)
        print("  added RoleTierPicker component definition")
    else:
        print("  WARN: SingleForm anchor not found for RoleTierPicker insertion")
else:
    print("  RoleTierPicker definition already present")

panel_path.write_text(panel, encoding="utf-8")
print("  DirectCreateUserPanel.jsx written")

# ============================================================
# Verification
# ============================================================
print("\n=== Verification ===")
checks = [
    (panel_path, "RoleTierPicker"),
    (panel_path, "const [role, setRole]"),
    (panel_path, "...roleOptions"),
    (fn_path,    "tier_id: tier_id || null"),
    (fn_path,    "upsert(profileRow"),
]
for path, marker in checks:
    found = marker in path.read_text(encoding="utf-8")
    flag = "OK" if found else "MISSING"
    print(f"  [{flag}] {path.name}: '{marker}'")

print("\n=== DONE ===")
print()
print("NEXT STEPS:")
print("  1. Test locally:")
print("       npm run dev")
print("       Log in as super_admin -> Admin -> User creation panel")
print("       New 'Role' and 'Tier' dropdowns should appear")
print("       Create one test account per role:")
print("         super_admin / school_master / teacher / parent / student / no-role")
print("  2. Build + deploy:")
print("       npm run build")
print("       netlify deploy --prod --dir dist --no-build")
print()
print("  Important: the netlify function reads SUPABASE_SERVICE_ROLE_KEY env var.")
print("  Confirm it's set in production:")
print("       netlify env:list | findstr SUPABASE")
