# patch_institution.py
# Add institution branding (logo + name) per user.
# 1. SQL migration creates 2 columns on clf_user_profiles
# 2. AccountsManagement gets an "institution edit" modal per user
# 3. CommunityHome header shows institution next to "大卫学中文" when user has one

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. SQL migration
# ============================================================
SQL = '''-- Phase E.3: Institution branding columns

ALTER TABLE clf_user_profiles
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_logo_url TEXT;

-- Optional index for filtering by institution
CREATE INDEX IF NOT EXISTS idx_user_profiles_institution
  ON clf_user_profiles(institution_name)
  WHERE institution_name IS NOT NULL;

-- Manual step required in Supabase Dashboard:
--   Storage > New bucket > "institution-logos"
--   Public: ON
--   File size limit: 2 MB
--   Allowed MIME types: image/png, image/jpeg, image/svg+xml, image/webp
'''

p_sql = ROOT / "db_migration_phase_e3_institution.sql"
data = SQL.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_sql.write_bytes(data)
print(f"[OK] wrote db_migration_phase_e3_institution.sql ({len(data)} bytes)")

# ============================================================
# 2. Patch AccountsManagement.jsx
# ============================================================
p_acc = ROOT / "src" / "admin" / "v2" / "AccountsManagement.jsx"
src = p_acc.read_text(encoding="utf-8")

# 2a. Extend select() to fetch institution columns
old_select = ".select('user_id, name, email, role, created_at, last_sign_in_at')"
new_select = ".select('user_id, name, email, role, created_at, last_sign_in_at, institution_name, institution_logo_url')"
if old_select in src:
    src = src.replace(old_select, new_select, 1)
    print("[OK] extended select() to fetch institution columns")
elif "institution_name, institution_logo_url" in src:
    print("[SKIP] institution columns already in select")
else:
    print("[FAIL] could not find select line")

# 2b. Add institution state and modal trigger
# Find the line with `const [showCreate, setShowCreate] = useState(false);`
old_state = "  const [showCreate, setShowCreate] = useState(false);"
new_state = """  const [showCreate, setShowCreate] = useState(false);
  const [instUser, setInstUser] = useState(null); // user being edited for institution"""
if old_state in src and "instUser" not in src:
    src = src.replace(old_state, new_state, 1)
    print("[OK] added instUser state")
else:
    print("[SKIP] instUser state already exists or showCreate not found")

# 2c. Add updateInstitution function near updateRole
old_fn = "  const removeUser = async (user) => {"
new_fn = """  const updateInstitution = async (userId, institutionName, logoUrl) => {
    const { error } = await supabase
      .from('clf_user_profiles')
      .update({
        institution_name: institutionName || null,
        institution_logo_url: logoUrl || null,
      })
      .eq('user_id', userId);
    if (error) {
      alert('机构信息更新失败: ' + error.message);
    } else {
      load();
      setInstUser(null);
    }
  };

  const removeUser = async (user) => {"""
if old_fn in src and "updateInstitution" not in src:
    src = src.replace(old_fn, new_fn, 1)
    print("[OK] added updateInstitution function")
else:
    print("[SKIP] updateInstitution exists or marker not found")

# 2d. Add onInstitutionClick prop to UserCard call
old_card_call = "            <UserCard key={u.user_id} user={u}\n              onPermsClick={() => setPermsUser(u)}"
new_card_call = """            <UserCard key={u.user_id} user={u}
              onPermsClick={() => setPermsUser(u)}
              onInstitutionClick={() => setInstUser(u)}"""
if old_card_call in src and "onInstitutionClick" not in src:
    src = src.replace(old_card_call, new_card_call, 1)
    print("[OK] added onInstitutionClick prop to UserCard")
else:
    print("[SKIP] onInstitutionClick already wired or marker not found")

# 2e. Modify UserCard signature and JSX to show institution + add button
old_userCard_sig = "function UserCard({ user, onPermsClick, onRoleChange, onDelete }) {"
new_userCard_sig = "function UserCard({ user, onPermsClick, onInstitutionClick, onRoleChange, onDelete }) {"
if old_userCard_sig in src and "onInstitutionClick" in new_userCard_sig:
    src = src.replace(old_userCard_sig, new_userCard_sig, 1)
    print("[OK] updated UserCard signature")
else:
    print("[SKIP] UserCard signature already updated")

# 2f. Add 机构 button before the existing UserModulesButton
old_actions = """        <UserModulesButton user={user} style={{
          padding: '6px 10px', fontSize: 11,
          background: '#9333ea15', color: '#7e22ce',
          border: '1px solid #9333ea40', borderRadius: 6,
          cursor: 'pointer', fontWeight: 600,
        }}/>"""
new_actions = """        <button onClick={onInstitutionClick} style={{
          padding: '6px 10px', fontSize: 11,
          background: user.institution_name ? '#10b98115' : '#fef3e2',
          color: user.institution_name ? '#047857' : '#92400e',
          border: `1px solid ${user.institution_name ? '#10b98140' : '#f59e0b40'}`,
          borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }} title={user.institution_name || '未设置机构'}>
          {user.institution_logo_url
            ? <img src={user.institution_logo_url} alt="" style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover' }}/>
            : '🏢'}
          {user.institution_name || '机构'}
        </button>
        <UserModulesButton user={user} style={{
          padding: '6px 10px', fontSize: 11,
          background: '#9333ea15', color: '#7e22ce',
          border: '1px solid #9333ea40', borderRadius: 6,
          cursor: 'pointer', fontWeight: 600,
        }}/>"""
if old_actions in src and "onInstitutionClick" in src:
    if "user.institution_name ? '#10b98115'" in src:
        print("[SKIP] institution button already added")
    else:
        src = src.replace(old_actions, new_actions, 1)
        print("[OK] added institution button to UserCard")
else:
    print("[SKIP] could not find UserModulesButton to insert before")

# 2g. Add the InstitutionModal component + render it
# Render: add {instUser && <InstitutionModal ... />} near the PermsModal render
old_modal_render = """      {/* Module permissions modal */}
      {permsUser && (
        <PermsModal user={permsUser} onClose={() => setPermsUser(null)}/>
      )}"""
new_modal_render = """      {/* Institution modal */}
      {instUser && (
        <InstitutionModal user={instUser}
          onClose={() => setInstUser(null)}
          onSave={(name, logo) => updateInstitution(instUser.user_id, name, logo)}/>
      )}

      {/* Module permissions modal */}
      {permsUser && (
        <PermsModal user={permsUser} onClose={() => setPermsUser(null)}/>
      )}"""
if old_modal_render in src and "InstitutionModal" not in src:
    src = src.replace(old_modal_render, new_modal_render, 1)
    print("[OK] added InstitutionModal render")
else:
    print("[SKIP] InstitutionModal render exists or marker not found")

# 2h. Define InstitutionModal component — insert before CreateUserModal
old_create_modal = "function CreateUserModal({ onClose, onCreated }) {"
new_inst_modal = """function InstitutionModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user.institution_name || '');
  const [logoUrl, setLogoUrl] = useState(user.institution_logo_url || '');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('文件大小不能超过 2MB');
      return;
    }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.user_id}/${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage
        .from('institution-logos')
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from('institution-logos')
        .getPublicUrl(filePath);
      setLogoUrl(publicUrl);
    } catch (err) {
      alert('上传失败: ' + err.message + '\\n\\n确认 institution-logos 存储桶已在 Supabase 中创建（公开，2MB 限制）');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 0,
        maxWidth: 500, width: '90%',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e8d5b0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0a05' }}>
              机构信息 · {user.name || user.email}
            </div>
            <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
              该用户所属的学校或机构
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 6, color: '#8b6f47',
          }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Preview */}
          <div style={{
            background: 'linear-gradient(90deg, #c41e3a 0%, #8b0000 100%)',
            color: '#fff5e6', padding: 14, borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>大卫学中文</div>
            {(name || logoUrl) && (
              <>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }}/>
                {logoUrl && (
                  <img src={logoUrl} alt="" style={{
                    width: 28, height: 28, borderRadius: 4,
                    objectFit: 'cover', background: '#fff',
                  }} onError={e => { e.target.style.display = 'none'; }}/>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                  {name || '(机构名称)'}
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#8b6f47', textAlign: 'center', marginTop: -4 }}>
            ↑ 顶部横幅预览
          </div>

          {/* Name input */}
          <div>
            <label style={{ fontSize: 11, color: '#8b6f47', display: 'block', marginBottom: 4 }}>
              机构名称
            </label>
            <input type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：佛罗伦萨中文学校"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', fontSize: 13,
                border: '1px solid #e8d5b0', borderRadius: 6,
              }}/>
          </div>

          {/* Logo upload + URL paste */}
          <div>
            <label style={{ fontSize: 11, color: '#8b6f47', display: 'block', marginBottom: 4 }}>
              机构 Logo
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="粘贴图片 URL 或上传 →"
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12,
                  border: '1px solid #e8d5b0', borderRadius: 6,
                }}/>
              <label style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                background: '#fff', color: '#5d4630',
                border: '1px solid #e8d5b0', borderRadius: 6,
                cursor: uploading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}>
                {uploading ? '上传中…' : '上传'}
                <input type="file" accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}/>
              </label>
            </div>
            <div style={{ fontSize: 10, color: '#a07850', marginTop: 4 }}>
              支持 PNG / JPG / SVG / WebP，最大 2MB
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => onSave(name, logoUrl)} style={{
              flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
              background: '#c41e3a', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
              保存
            </button>
            <button onClick={() => onSave('', '')} style={{
              padding: '10px 16px', fontSize: 13,
              background: '#fff', color: '#991b1b',
              border: '1px solid #991b1b40', borderRadius: 8, cursor: 'pointer',
            }}>
              清除
            </button>
            <button onClick={onClose} style={{
              padding: '10px 16px', fontSize: 13,
              background: '#fff', color: '#5d4630',
              border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer',
            }}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {"""

if old_create_modal in src and "function InstitutionModal" not in src:
    src = src.replace(old_create_modal, new_inst_modal, 1)
    print("[OK] added InstitutionModal definition")
else:
    print("[SKIP] InstitutionModal exists or CreateUserModal not found")

# Write back
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_acc.write_bytes(data)
print(f"\n[OK] wrote AccountsManagement.jsx ({len(data)} bytes)")

# ============================================================
# 3. Patch CommunityHome.jsx — header shows institution
# ============================================================
p_ch = ROOT / "src" / "community" / "CommunityHome.jsx"
src = p_ch.read_text(encoding="utf-8")

# 3a. Extend useEffect to also fetch institution
# Find the existing user fetch — look for where we set allowedIds
old_useeffect = """      try {
        const { data } = await supabase
          .from('clf_user_modules')
          .select('module_id, enabled')
          .eq('user_id', user.id);"""
new_useeffect = """      try {
        const { data: profileData } = await supabase
          .from('clf_user_profiles')
          .select('institution_name, institution_logo_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profileData) {
          setInstitution({
            name: profileData.institution_name,
            logo: profileData.institution_logo_url,
          });
        }
        const { data } = await supabase
          .from('clf_user_modules')
          .select('module_id, enabled')
          .eq('user_id', user.id);"""
if old_useeffect in src and "setInstitution" not in src:
    src = src.replace(old_useeffect, new_useeffect, 1)
    print("[OK] extended useEffect to fetch institution")
else:
    print("[SKIP] institution fetch already in useEffect")

# 3b. Add institution state
old_state2 = "  const [openSection, setOpenSection] = useState(null);"
new_state2 = """  const [openSection, setOpenSection] = useState(null);
  const [institution, setInstitution] = useState(null);"""
if old_state2 in src and "const [institution" not in src:
    src = src.replace(old_state2, new_state2, 1)
    print("[OK] added institution state")
else:
    print("[SKIP] institution state already exists")

# 3c. Update header to show institution side-by-side
old_header = """        <div>
          <div style={{ fontSize: 22, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4 }}>大卫学中文</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {user?.name || user?.email} · {myRole || 'visitor'}
          </div>
        </div>"""
new_header = """        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4 }}>大卫学中文</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              {user?.name || user?.email} · {myRole || 'visitor'}
            </div>
          </div>
          {institution && (institution.name || institution.logo) && (
            <>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.25)' }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {institution.logo && (
                  <img src={institution.logo} alt=""
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{
                      width: 32, height: 32, borderRadius: 6,
                      objectFit: 'cover', background: '#fff',
                    }}/>
                )}
                {institution.name && (
                  <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.95,
                    fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
                    {institution.name}
                  </div>
                )}
              </div>
            </>
          )}
        </div>"""
if old_header in src and "institution.logo" not in src:
    src = src.replace(old_header, new_header, 1)
    print("[OK] header updated to show institution side-by-side")
elif "institution.logo" in src:
    print("[SKIP] header already updated")
else:
    print("[FAIL] could not find existing header — may have whitespace mismatch")

# Write back
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_ch.write_bytes(data)
print(f"\n[OK] wrote CommunityHome.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
acc_final = p_acc.read_text(encoding="utf-8")
ch_final = p_ch.read_text(encoding="utf-8")

checks = [
    ('AccountsManagement: institution columns in select', 'institution_name, institution_logo_url' in acc_final),
    ('AccountsManagement: instUser state', 'instUser' in acc_final),
    ('AccountsManagement: updateInstitution fn', 'updateInstitution' in acc_final),
    ('AccountsManagement: institution button', "user.institution_name ? '#10b98115'" in acc_final),
    ('AccountsManagement: InstitutionModal', 'function InstitutionModal' in acc_final),
    ('CommunityHome: institution state', 'const [institution' in ch_final),
    ('CommunityHome: institution fetch', "institution_name, institution_logo_url" in ch_final),
    ('CommunityHome: header shows institution', 'institution.logo' in ch_final),
    ('SQL migration file', p_sql.exists()),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for f in [p_acc, p_ch]:
    txt = f.read_text(encoding="utf-8")
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("=" * 50)
print("MANUAL STEPS REQUIRED:")
print("=" * 50)
print()
print("1. SUPABASE: Run SQL migration")
print("   Open Supabase Dashboard > SQL Editor > New query")
print("   Paste contents of: db_migration_phase_e3_institution.sql")
print("   Click Run")
print()
print("2. SUPABASE: Create Storage bucket")
print("   Dashboard > Storage > New bucket")
print("   Name: institution-logos")
print("   Public: ON (toggle)")
print("   File size limit: 2 MB")
print("   Click 'Save'")
print()
print("3. (After both above): test in browser")
print("   - npm run dev (if not running)")
print("   - Go to /admin-v2 > 账户管理")
print("   - Click '机构' button on a user row")
print("   - Modal opens with preview, name input, logo upload")
print("   - Save → header on /community shows institution alongside 大卫学中文")
print()
print("If you get errors uploading logos, the bucket isn't created yet.")
print("If 机构 column doesn't appear, the SQL migration didn't run.")
