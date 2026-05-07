# fix_g4_corpus_constraint.py
# Two fixes for G.4 ingestion:
#
# 1. Write a SQL migration that adds UNIQUE constraint on clf_corpus(name).
#    User runs this in Supabase SQL Editor.
#
# 2. Patch patch_phase_g4_hsk_ingest.py to use "fetch first, then insert"
#    pattern instead of ON CONFLICT (more robust).

import pathlib, sys

ROOT = pathlib.Path.cwd()

# ============================================================
# 1. SQL migration
# ============================================================
SQL = '''-- Fix for G.4 ingestion: add UNIQUE constraint on clf_corpus(name)
-- so we can use ON CONFLICT for idempotent upserts.

-- Safe — does nothing if constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clf_corpus_name_unique'
      AND conrelid = 'public.clf_corpus'::regclass
  ) THEN
    ALTER TABLE clf_corpus
      ADD CONSTRAINT clf_corpus_name_unique UNIQUE (name);
  END IF;
END $$;

-- Verify:
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.clf_corpus'::regclass
  AND contype = 'u';
'''

p_sql = ROOT / "db_fix_clf_corpus_unique.sql"
data = SQL.encode("utf-8")
p_sql.write_bytes(data)
print(f"[OK] wrote {p_sql.name}")

# ============================================================
# 2. Patch the ingest script — switch to fetch-first pattern
# ============================================================
target = ROOT / "patch_phase_g4_hsk_ingest.py"
if not target.exists():
    print(f"[FAIL] {target.name} not found — run from clf-platform root")
    sys.exit(1)

src = target.read_text(encoding="utf-8")

OLD_BLOCK = '''corpus_payload = [{
    "name": "HSK 3.0 Standard Wordlist",
    "source": "hsk_official_3.0",
    "description": "Official HSK 3.0 vocabulary (11,092 words across 9 levels). "
                   "Source: github.com/ivankra/hsk30 (MIT). "
                   "Data derived from Chinese government's 国际中文教育中文水平等级标准.",
    "metadata": {
        "version": "3.0",
        "source_url": "https://github.com/ivankra/hsk30",
        "license": "MIT (data largely derived from PRC government standards)",
        "ingested_rows": len(rows),
    },
    "is_active": True,
}]
code, result = supabase_call(
    "POST", "/rest/v1/clf_corpus?on_conflict=name",
    body=corpus_payload,
    prefer="resolution=merge-duplicates,return=representation"
)
if code not in (200, 201):
    print(f"[FAIL] corpus upsert: code={code}, body={result}")
    sys.exit(1)
corpus_id = result[0]["id"] if isinstance(result, list) and result else None
if not corpus_id:
    # Re-fetch
    code, result = supabase_call(
        "GET", "/rest/v1/clf_corpus?name=eq.HSK%203.0%20Standard%20Wordlist&select=id"
    )
    corpus_id = result[0]["id"] if isinstance(result, list) and result else None
if not corpus_id:
    print(f"[FAIL] couldn't get corpus_id: {result}")
    sys.exit(1)
print(f"[OK] corpus_id = {corpus_id}")'''

NEW_BLOCK = '''CORPUS_NAME = "HSK 3.0 Standard Wordlist"

# First: try to fetch existing corpus by name
code, existing = supabase_call(
    "GET",
    f"/rest/v1/clf_corpus?name=eq.{urllib.parse.quote(CORPUS_NAME)}&select=id"
)
corpus_id = None
if isinstance(existing, list) and len(existing) > 0:
    corpus_id = existing[0]["id"]
    print(f"[OK] reusing existing corpus_id = {corpus_id}")

# If not found, insert
if not corpus_id:
    corpus_payload = [{
        "name": CORPUS_NAME,
        "source": "hsk_official_3.0",
        "description": "Official HSK 3.0 vocabulary (11,092 words across 9 levels). "
                       "Source: github.com/ivankra/hsk30 (MIT). "
                       "Data derived from Chinese government's 国际中文教育中文水平等级标准.",
        "metadata": {
            "version": "3.0",
            "source_url": "https://github.com/ivankra/hsk30",
            "license": "MIT (data largely derived from PRC government standards)",
            "ingested_rows": len(rows),
        },
        "is_active": True,
    }]
    code, result = supabase_call(
        "POST", "/rest/v1/clf_corpus",
        body=corpus_payload,
        prefer="return=representation"
    )
    if code not in (200, 201):
        print(f"[FAIL] corpus insert: code={code}, body={result}")
        sys.exit(1)
    corpus_id = result[0]["id"] if isinstance(result, list) and result else None
    if not corpus_id:
        print(f"[FAIL] couldn't get corpus_id from insert response: {result}")
        sys.exit(1)
    print(f"[OK] inserted new corpus_id = {corpus_id}")'''

# We also need urllib.parse imported
NEW_IMPORT = "import urllib.parse"
if "import urllib.parse" not in src:
    src = src.replace("import urllib.request", "import urllib.request\nimport urllib.parse", 1)
    print("[OK] added 'import urllib.parse'")
else:
    print("[SKIP] urllib.parse already imported")

if OLD_BLOCK in src:
    src = src.replace(OLD_BLOCK, NEW_BLOCK, 1)
    print("[OK] replaced corpus upsert block with fetch-first pattern")
else:
    if "reusing existing corpus_id" in src:
        print("[SKIP] already patched")
    else:
        print("[FAIL] could not find original corpus upsert block")
        print("       file may have been hand-edited")
        sys.exit(1)

# Also need to fix the chunk_atoms ON CONFLICT — that PRIMARY KEY exists,
# so the conflict IS valid there. Leave that alone.
# But clf_atoms has UNIQUE (type, ref_table, ref_id) from G.1 schema —
# verify that's still present in atoms insert. It should be.

data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
target.write_bytes(data)
print(f"[OK] wrote {target.name} ({len(data)} bytes)")

print()
print("=" * 60)
print("MANUAL STEP: Run SQL fix in Supabase first")
print("=" * 60)
print()
print("1. Open Supabase Dashboard > SQL Editor > New query")
print(f"2. Open file: {p_sql.absolute()}")
print("3. Copy contents -> paste in SQL Editor -> Run")
print("4. Should see one row in result: 'clf_corpus_name_unique'")
print()
print("Then re-run the ingestion:")
print("  python patch_phase_g4_hsk_ingest.py")
print()
print("It should now succeed (with the fetch-first pattern, the constraint")
print("is technically optional now, but adding it is still good schema hygiene).")
