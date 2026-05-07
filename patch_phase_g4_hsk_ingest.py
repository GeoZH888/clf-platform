# patch_phase_g4_hsk_ingest.py
# Phase G.4 — HSK 3.0 corpus ingestion.
#
# Reads hsk30.csv from project root (downloaded from
# https://github.com/ivankra/hsk30/raw/master/hsk30.csv)
# and inserts:
#   - 1 row in clf_corpus (the HSK 3.0 corpus container)
#   - ~11,092 rows in clf_corpus_chunks (one per word, level=5 = sentence)
#   - ~11,092 rows in clf_atoms (type='word', linked to chunks via chunk_atoms)
#   - chunks <-> atoms mapping
#
# Idempotent: ON CONFLICT clauses prevent duplicates on re-run.
#
# Calls Supabase REST API directly. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# env vars (SERVICE_ROLE because anon would be blocked by RLS for inserts).

import csv
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ============================================================
# Config
# ============================================================
ROOT = Path.cwd()
CSV_PATH = ROOT / "hsk30.csv"
BATCH_SIZE = 500  # atoms per HTTP request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ============================================================
# Pre-flight
# ============================================================
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

if not CSV_PATH.exists():
    print(f"ERROR: hsk30.csv not found at {CSV_PATH}")
    print()
    print("Download it first:")
    print("  Go to: https://github.com/ivankra/hsk30")
    print("  Click on 'hsk30.csv' file")
    print("  Click 'Download raw file' button")
    print("  Save to: " + str(CSV_PATH))
    print()
    print("Then re-run this script.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
    print()
    print("Get the service role key from:")
    print("  Supabase Dashboard > Settings > API > service_role secret")
    print()
    print("Set them in PowerShell before running:")
    print('  $env:SUPABASE_URL = "https://yqcojudvvjntaajnrilr.supabase.co"')
    print('  $env:SUPABASE_SERVICE_ROLE_KEY = "<your service role key>"')
    print('  python patch_phase_g4_hsk_ingest.py')
    sys.exit(1)

print(f"CSV: {CSV_PATH}")
print(f"Supabase: {SUPABASE_URL}")
print()

# ============================================================
# Read CSV
# ============================================================
print("=== Reading CSV ===")
rows = []
with open(CSV_PATH, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

print(f"Parsed {len(rows)} rows")
print(f"Columns: {list(rows[0].keys()) if rows else '(empty)'}")
if rows:
    print(f"First row sample:")
    for k, v in list(rows[0].items())[:6]:
        print(f"  {k}: {v}")

# ============================================================
# Parse level from each row
# ============================================================
def parse_level(level_str):
    """Map HSK level string to int. '7-9' -> 7."""
    if not level_str:
        return None
    s = str(level_str).strip()
    if s in ("1","2","3","4","5","6"):
        return int(s)
    if s.startswith("7"):
        return 7
    return None

level_counts = {}
for r in rows:
    lvl = parse_level(r.get("Level", ""))
    level_counts[lvl] = level_counts.get(lvl, 0) + 1

print(f"\nLevel distribution:")
for lvl in sorted(level_counts.keys(), key=lambda x: (x is None, x)):
    print(f"  Level {lvl}: {level_counts[lvl]} words")

# ============================================================
# Supabase REST helper
# ============================================================
def supabase_call(method, path, body=None, prefer=None):
    """Call PostgREST endpoint."""
    url = SUPABASE_URL + path
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            txt = resp.read().decode("utf-8")
            return resp.getcode(), (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return e.code, body
    except Exception as e:
        return None, str(e)

# ============================================================
# Step 1: Upsert corpus row
# ============================================================
print("\n=== Step 1: Upsert clf_corpus ===")
corpus_payload = [{
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
print(f"[OK] corpus_id = {corpus_id}")

# ============================================================
# Step 2: Insert chunks (one per word, level=5 = sentence-level)
# We use 'level=5' (sentence) since each row is one word/term.
# This lets RAG retrieve at word-granularity later.
# ============================================================
print(f"\n=== Step 2: Insert {len(rows)} chunks ===")

# Prepare chunk rows. We use the source ID (e.g. L1-0001) as a
# deterministic external ID we can use for upsert, but Supabase
# generates UUIDs server-side. Strategy: insert with metadata.source_id,
# then fetch chunks back to map source_id -> chunk_id.

chunks_to_insert = []
for r in rows:
    src_id = r.get("ID", "").strip()
    simplified = r.get("Simplified", "").strip()
    pinyin = r.get("Pinyin", "").strip()
    pos = r.get("POS", "").strip()
    level = parse_level(r.get("Level", ""))
    traditional = r.get("Traditional", "").strip()
    variants = r.get("Variants", "").strip()
    freq = r.get("Freq", "").strip()
    writing_level = r.get("WritingLevel", "").strip()

    if not src_id or not simplified:
        continue

    chunks_to_insert.append({
        "corpus_id": corpus_id,
        "level": 5,  # sentence-level (single word)
        "ord": 0,
        "title": simplified,
        "content": simplified,
        "hsk_level": level,
        "metadata": {
            "source_id": src_id,
            "pinyin": pinyin,
            "pos": pos,
            "traditional": traditional,
            "variants": variants,
            "freq": freq,
            "writing_level": writing_level,
        }
    })

print(f"  Prepared {len(chunks_to_insert)} chunk rows")

# Check if already ingested
print("  Checking existing chunks for this corpus...")
code, existing = supabase_call(
    "GET",
    f"/rest/v1/clf_corpus_chunks?corpus_id=eq.{corpus_id}&select=id,metadata"
)
if isinstance(existing, list) and len(existing) > 0:
    print(f"  Found {len(existing)} existing chunks for this corpus.")
    answer = input("  Re-ingest? (will skip already-present source_ids) [y/N]: ").strip().lower()
    if answer != "y":
        print("  Skipping ingestion. Exiting.")
        sys.exit(0)
    existing_source_ids = set()
    for e in existing:
        meta = e.get("metadata") or {}
        sid = meta.get("source_id")
        if sid:
            existing_source_ids.add(sid)
    chunks_to_insert = [
        c for c in chunks_to_insert
        if c["metadata"]["source_id"] not in existing_source_ids
    ]
    print(f"  After dedup: {len(chunks_to_insert)} new chunks to insert")

if not chunks_to_insert:
    print("  Nothing to insert. Done.")
    sys.exit(0)

# Batch insert chunks
inserted_chunks = []
n = len(chunks_to_insert)
for i in range(0, n, BATCH_SIZE):
    batch = chunks_to_insert[i:i+BATCH_SIZE]
    code, result = supabase_call(
        "POST", "/rest/v1/clf_corpus_chunks",
        body=batch,
        prefer="return=representation"
    )
    if code not in (200, 201):
        print(f"  [FAIL] chunk batch {i}: code={code}, body={str(result)[:300]}")
        sys.exit(1)
    inserted_chunks.extend(result)
    print(f"  inserted {len(inserted_chunks)} / {n} chunks", end="\r")

print(f"\n[OK] inserted {len(inserted_chunks)} chunks")

# ============================================================
# Step 3: Insert atoms (type='word'), one per chunk.
# ============================================================
print(f"\n=== Step 3: Insert {len(inserted_chunks)} atoms ===")

atoms_to_insert = []
for chunk in inserted_chunks:
    chunk_id = chunk["id"]
    meta = chunk.get("metadata", {})
    src_id = meta.get("source_id")
    simplified = chunk.get("title", "")
    hsk = chunk.get("hsk_level")
    if not src_id or not simplified:
        continue

    # Difficulty seeded from level (Elo-style).
    # HSK 1=1000, HSK 2=1200, ..., HSK 6=2000, HSK 7-9=2200
    if hsk is not None and hsk >= 1 and hsk <= 7:
        difficulty = 800 + hsk * 200
    else:
        difficulty = 1000

    atoms_to_insert.append({
        "type": "word",
        "ref_table": "clf_corpus_chunks",
        "ref_id": chunk_id,
        "display_text": simplified,
        "level": hsk,
        "category": "hsk",
        "difficulty": difficulty,
        "metadata": meta,  # carry the source metadata
    })

print(f"  Prepared {len(atoms_to_insert)} atom rows")

inserted_atoms = []
n = len(atoms_to_insert)
for i in range(0, n, BATCH_SIZE):
    batch = atoms_to_insert[i:i+BATCH_SIZE]
    code, result = supabase_call(
        "POST", "/rest/v1/clf_atoms?on_conflict=type,ref_table,ref_id",
        body=batch,
        prefer="resolution=merge-duplicates,return=representation"
    )
    if code not in (200, 201):
        print(f"  [FAIL] atom batch {i}: code={code}, body={str(result)[:300]}")
        sys.exit(1)
    inserted_atoms.extend(result)
    print(f"  inserted {len(inserted_atoms)} / {n} atoms", end="\r")

print(f"\n[OK] inserted {len(inserted_atoms)} atoms")

# ============================================================
# Step 4: Map chunks <-> atoms (clf_chunk_atoms)
# ============================================================
print(f"\n=== Step 4: Insert chunk_atoms mapping ===")

# Build mapping: chunk_id -> atom_id from inserted_atoms
chunk_to_atom = {}
for a in inserted_atoms:
    chunk_to_atom[a["ref_id"]] = a["id"]

mappings = []
for chunk in inserted_chunks:
    chunk_id = chunk["id"]
    atom_id = chunk_to_atom.get(chunk_id)
    if atom_id:
        mappings.append({
            "chunk_id": chunk_id,
            "atom_id": atom_id,
            "occurrences": 1,
        })

print(f"  Prepared {len(mappings)} mappings")

inserted_mappings = 0
n = len(mappings)
for i in range(0, n, BATCH_SIZE):
    batch = mappings[i:i+BATCH_SIZE]
    code, result = supabase_call(
        "POST", "/rest/v1/clf_chunk_atoms?on_conflict=chunk_id,atom_id",
        body=batch,
        prefer="resolution=merge-duplicates"
    )
    if code not in (200, 201, 204):
        print(f"  [FAIL] mapping batch {i}: code={code}, body={str(result)[:300]}")
        sys.exit(1)
    inserted_mappings += len(batch)
    print(f"  inserted {inserted_mappings} / {n} mappings", end="\r")

print(f"\n[OK] inserted {inserted_mappings} chunk_atoms mappings")

# ============================================================
# Final summary
# ============================================================
print()
print("=" * 60)
print("PHASE G.4 INGESTION COMPLETE")
print("=" * 60)
print(f"  Corpus: HSK 3.0 Standard Wordlist  (id={corpus_id})")
print(f"  Chunks inserted:    {len(inserted_chunks)}")
print(f"  Atoms inserted:     {len(inserted_atoms)}")
print(f"  Mappings inserted:  {inserted_mappings}")
print()
print("VERIFY in Supabase SQL Editor:")
print("  SELECT type, count(*) FROM clf_atoms GROUP BY type;")
print("  -- should show 'word' count went from 80 to ~11,170")
print()
print("  SELECT count(*) FROM clf_corpus_chunks WHERE corpus_id =")
print(f"    '{corpus_id}';")
print(f"  -- should show {len(inserted_chunks)}")
print()
print("EMBEDDINGS NOT YET COMPUTED.")
print("  Phase G.5 (embed-chunk Netlify function) is ready, but expensive at scale.")
print("  Embedding all 11k chunks would take ~5-10 min and cost ~$0.02 (cheap).")
print("  Recommend embedding HSK 1-3 first (~2k chunks) to test the retrieval API,")
print("  then embed remaining levels later.")
print()
print("KNOWLEDGE MAP at /knowledge-map will now show all HSK words.")
print("  Tree map will be very dense at this scale (11k atoms).")
print("  Bubble and galaxy views may need scaling adjustments — note for next session.")
