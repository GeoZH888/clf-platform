# fix_g7_card.py
# Fix the broken patch_phase_g7_personal_dashboard.py result.
#
# What's broken: previous patch's regex inserted "我的" panel jammed inside
# the 非遗 panel JSX, breaking the build at line 396.
#
# Fix:
# 1. Remove the orphan 我的 panel from inside 非遗 panel
# 2. Insert a proper DoorCard for 我的 after the 非遗 DoorCard
# 3. Insert a proper 我的 expand panel after the 非遗 panel closes

import pathlib, sys

ROOT = pathlib.Path.cwd()
p = ROOT / "src" / "community" / "CommunityHome.jsx"
if not p.exists():
    print("ERROR: CommunityHome.jsx not found")
    sys.exit(1)

src = p.read_text(encoding="utf-8")
print(f"Read CommunityHome.jsx: {len(src)} bytes")

# ============================================================
# Step 1: Remove the orphan 我的 panel that was inserted inside 非遗 panel.
# This is the broken block we need to delete entirely.
# ============================================================
ORPHAN_START = "\n\n      {openSection === 'mine' && ("
ORPHAN_END = "</div>\n      )}"

# Find the orphan
orphan_start_idx = src.find(ORPHAN_START)
if orphan_start_idx < 0:
    print("[INFO] orphan panel marker not found at expected location")
    print("       checking if it was already removed...")
    if "openSection === 'mine'" not in src:
        print("[OK] no orphan panel exists, skipping removal")
    else:
        print("[WARN] 'openSection === \\'mine\\'' exists but at unexpected location")
        print("       manual inspection needed — aborting to avoid corruption")
        sys.exit(1)
else:
    # Find the matching closing brace
    # Search forward from orphan_start_idx to find ORPHAN_END
    orphan_end_search = src.find(ORPHAN_END, orphan_start_idx)
    if orphan_end_search < 0:
        print("[FAIL] could not find orphan panel closing brace")
        sys.exit(1)

    orphan_end_idx = orphan_end_search + len(ORPHAN_END)
    orphan_block = src[orphan_start_idx:orphan_end_idx]
    print(f"[FOUND] orphan panel: {len(orphan_block)} chars at offset {orphan_start_idx}")
    print(f"        spans: '{orphan_block[:40]}...{orphan_block[-30:]}'")

    src = src[:orphan_start_idx] + src[orphan_end_idx:]
    print(f"[OK] removed orphan panel — file now {len(src)} bytes")

# ============================================================
# Step 2: Insert proper DoorCard for 我的 after the 非遗 DoorCard.
# Anchor: the 非遗 DoorCard ends with `onClick={() => toggleSection('feiyi')}\n          />`
# Insert a new DoorCard right after that closing />.
# ============================================================
FEIYI_CARD_END = "onClick={() => toggleSection('feiyi')}\n          />"
NEW_CARD = """onClick={() => toggleSection('feiyi')}
          />
          <DoorCard
            emoji="🌸"
            title="我的"
            subtitle="My Records"
            desc={"个人学习记录。掌握进度、最近活动、待复习内容。"}
            features={['进度', '记录', '复习', '统计']}
            color="#ec4899"
            bgGrad="linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)"
            textColor="#1a0a05" accentColor="#9d174d"
            isOpen={openSection === 'mine'} compact
            onClick={() => toggleSection('mine')}
          />"""

if FEIYI_CARD_END not in src:
    print("[FAIL] could not find 非遗 DoorCard end marker — file may have been edited")
    print("       expected to find: 'onClick={() => toggleSection(\\'feiyi\\')}\\n          />'")
    sys.exit(1)
elif NEW_CARD.replace(FEIYI_CARD_END, "").strip() in src:
    # Already inserted (idempotent re-run)
    print("[SKIP] 我的 DoorCard already present")
else:
    # Replace exactly once at first occurrence
    src = src.replace(FEIYI_CARD_END, NEW_CARD, 1)
    print("[OK] inserted 我的 DoorCard after 非遗 DoorCard")

# ============================================================
# Step 3: Insert proper 我的 expand panel after 非遗 panel closes.
# Anchor: the 非遗 ExpandedSection closes with `</ExpandedSection>\n        )}`
# right before `</main>`. Insert after that closing.
# ============================================================
FEIYI_PANEL_END = "</ExpandedSection>\n        )}\n      </main>"
NEW_PANEL = """</ExpandedSection>
        )}

        {openSection === 'mine' && (
          <div style={{
            marginTop: 12, padding: 16,
            background: '#fdf2f8',
            border: '1px solid #fbcfe8',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#831843',
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🌸</span><span>我的学习记录</span>
            </div>
            <PersonalDashboard user={user}/>
          </div>
        )}
      </main>"""

if FEIYI_PANEL_END not in src:
    print("[FAIL] could not find 非遗 panel end marker")
    print("       expected: '</ExpandedSection>\\n        )}\\n      </main>'")
    print("       file may have unusual whitespace — please check manually")
    sys.exit(1)
elif "openSection === 'mine'" in src:
    # Check if it's the new clean version (above </main>) or somehow still broken
    mine_idx = src.find("openSection === 'mine'")
    main_idx = src.find("</main>")
    if mine_idx < main_idx:
        print("[SKIP] 我的 expand panel already in correct position")
    else:
        print("[WARN] 'openSection === \\'mine\\'' found but AFTER </main>")
        print("       this shouldn't happen — please inspect manually")
        sys.exit(1)
else:
    src = src.replace(FEIYI_PANEL_END, NEW_PANEL, 1)
    print("[OK] inserted 我的 expand panel after 非遗 panel")

# Write back
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p.write_bytes(data)
print(f"\n[OK] wrote CommunityHome.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p.read_text(encoding="utf-8")

# Check the structural fixes
checks = [
    ('我的 DoorCard present', "title=\"我的\"" in final),
    ('toggleSection mine wired', "toggleSection('mine')" in final),
    ('Mine panel present', "openSection === 'mine'" in final),
    ('PersonalDashboard rendered', "<PersonalDashboard user={user}/>" in final),
    ('Mine panel BEFORE </main>',
        final.find("openSection === 'mine'") < final.find("</main>")
        if "openSection === 'mine'" in final and "</main>" in final
        else False),
    ('Mine panel NOT inside feiyi panel — no jam',
        not (final.find("openSection === 'mine'") > final.find("openSection === 'feiyi'")
             and final.find("openSection === 'mine'") < final.find("FEIYI.map")
             if all(x in final for x in ["openSection === 'mine'", "openSection === 'feiyi'", "FEIYI.map"])
             else True)),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Count card occurrences — should now be 6 DoorCards (was 5)
doorcard_count = final.count("<DoorCard")
print(f"  DoorCard count: {doorcard_count} (expected 6)")
if doorcard_count != 6:
    all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
i = 0
while i < len(final) - 5:
    if final[i] == chr(92) and final[i+1] == 'u':
        if all(c in hex_chars for c in final[i+2:i+6]):
            total_escapes += 1
            i += 6
            continue
    i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("Now run: npm run build")
print("Should succeed with no errors.")
print()
print("Then refresh localhost:5174/community as marco")
print("You should see 6 cards. Click 我的 (pink, 🌸) → expands inline.")
print("Empty state expected for marco (no learning history).")
