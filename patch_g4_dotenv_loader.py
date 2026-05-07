# patch_g4_dotenv_loader.py
# Add a small dotenv loader to the top of patch_phase_g4_hsk_ingest.py
# so it reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env automatically.
#
# .env keys we look for:
#   VITE_SUPABASE_URL      -> SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY -> SUPABASE_SERVICE_ROLE_KEY (literal)

import pathlib, sys

ROOT = pathlib.Path.cwd()
target = ROOT / "patch_phase_g4_hsk_ingest.py"
if not target.exists():
    print(f"ERROR: {target.name} not found in cwd. Run this from clf-platform root.")
    sys.exit(1)

src = target.read_text(encoding="utf-8")

# The dotenv loader to inject. Goes right after "import csv ... from pathlib import Path"
# and BEFORE the "Config" section that reads os.environ.
LOADER = '''
# ============================================================
# Auto-load .env (added by patch_g4_dotenv_loader.py)
# Reads VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env in cwd.
# Existing env vars take precedence (don't override what user set).
# ============================================================
def _load_dotenv():
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            # Map VITE_-prefixed vars to non-prefixed equivalents
            if k == "VITE_SUPABASE_URL" and not os.environ.get("SUPABASE_URL"):
                os.environ["SUPABASE_URL"] = v
            elif k == "SUPABASE_SERVICE_ROLE_KEY" and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
                os.environ["SUPABASE_SERVICE_ROLE_KEY"] = v
    except Exception as e:
        print(f"[warn] could not parse .env: {e}")

_load_dotenv()

'''

ANCHOR = "# ============================================================\n# Config\n# ============================================================"
if "_load_dotenv()" in src:
    print("[SKIP] dotenv loader already present")
elif ANCHOR in src:
    src = src.replace(ANCHOR, LOADER.strip() + "\n\n" + ANCHOR, 1)
    data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    target.write_bytes(data)
    print(f"[OK] injected dotenv loader into {target.name} ({len(data)} bytes)")
else:
    print(f"[FAIL] could not find anchor in {target.name}")
    print("       expected to find the '# Config' header")
    sys.exit(1)

# Verify
final = target.read_text(encoding="utf-8")
print("\n=== Verification ===")
print(f"  [{'OK' if '_load_dotenv()' in final else 'FAIL'}] dotenv loader present")
print(f"  [{'OK' if 'VITE_SUPABASE_URL' in final else 'FAIL'}] reads VITE_SUPABASE_URL")
print(f"  [{'OK' if 'SUPABASE_SERVICE_ROLE_KEY' in final else 'FAIL'}] reads SUPABASE_SERVICE_ROLE_KEY")

print()
print("Now run:")
print("  python patch_phase_g4_hsk_ingest.py")
print("(no need to set env vars manually — script reads .env)")
