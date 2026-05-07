# scripts/embed_corpus_chunks.py
# Embed corpus chunks via the deployed embed-chunk Netlify function.
# Reads chunks WITHOUT existing embeddings, batches of N, calls function.
#
# Run after corpus is populated:
#   python scripts/embed_corpus_chunks.py
#
# Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBED_FUNCTION_URL env vars.
# EMBED_FUNCTION_URL = https://david-zhongwen.net/.netlify/functions/embed-chunk
#                      (or http://localhost:8888/... in netlify dev)

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ============================================================
# Auto-load .env
# ============================================================
def _load_dotenv():
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k == "VITE_SUPABASE_URL" and not os.environ.get("SUPABASE_URL"):
            os.environ["SUPABASE_URL"] = v
        elif k == "SUPABASE_SERVICE_ROLE_KEY" and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = v
        elif k == "EMBED_FUNCTION_URL" and not os.environ.get("EMBED_FUNCTION_URL"):
            os.environ["EMBED_FUNCTION_URL"] = v

_load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
FUNCTION_URL = os.environ.get(
    "EMBED_FUNCTION_URL",
    "https://david-zhongwen.net/.netlify/functions/embed-chunk"
)

BATCH_SIZE = 50  # chunks per request to embed function
MAX_BATCHES = 250  # safety cap (~12,500 chunks max per run)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

print(f"Supabase: {SUPABASE_URL}")
print(f"Embed function: {FUNCTION_URL}")
print(f"Batch size: {BATCH_SIZE}")
print()

# ============================================================
# Step 1: find chunks WITHOUT embeddings
# ============================================================
def fetch_unembedded_chunks(limit=BATCH_SIZE):
    """Returns chunk_ids that don't have an embedding yet."""
    # Query chunks NOT IN (SELECT chunk_id FROM clf_chunk_embeddings)
    # PostgREST doesn't directly support NOT IN subquery, so use a custom RPC
    # OR we read all embeddings and diff in memory (acceptable for ~11k).
    req = urllib.request.Request(
        SUPABASE_URL + f"/rest/v1/clf_corpus_chunks?select=id&limit={limit*5}",
        method="GET"
    )
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        chunks = json.loads(resp.read().decode("utf-8"))

    # Get embedded chunk_ids
    req2 = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/clf_chunk_embeddings?select=chunk_id&limit=20000",
        method="GET"
    )
    req2.add_header("apikey", SUPABASE_KEY)
    req2.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req2, timeout=30) as resp:
        embedded = json.loads(resp.read().decode("utf-8"))

    embedded_ids = set(e["chunk_id"] for e in embedded)
    pending = [c["id"] for c in chunks if c["id"] not in embedded_ids]
    return pending[:limit]

# ============================================================
# Step 2: call embed function for a batch
# ============================================================
def embed_batch(chunk_ids):
    payload = json.dumps({"chunks": chunk_ids}).encode("utf-8")
    req = urllib.request.Request(FUNCTION_URL, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            txt = resp.read().decode("utf-8")
            return resp.getcode(), json.loads(txt)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return None, str(e)

# ============================================================
# Main loop
# ============================================================
print("=== Starting embedding loop ===")
total_embedded = 0
start = time.time()

for batch_idx in range(MAX_BATCHES):
    pending = fetch_unembedded_chunks(BATCH_SIZE)
    if not pending:
        print(f"\n[OK] No more chunks to embed.")
        break

    print(f"  Batch {batch_idx+1}: embedding {len(pending)} chunks...", end=" ", flush=True)
    code, result = embed_batch(pending)
    if code != 200:
        print(f"[FAIL] code={code}, body={str(result)[:200]}")
        # Don't exit — try to continue with next batch
        time.sleep(5)
        continue

    n = result.get("embedded", 0) if isinstance(result, dict) else 0
    total_embedded += n
    elapsed = time.time() - start
    rate = total_embedded / elapsed if elapsed > 0 else 0
    print(f"[OK] +{n}  total={total_embedded}  rate={rate:.1f}/s")

    # Polite delay to avoid rate limits
    time.sleep(0.5)

elapsed = time.time() - start
print(f"\n=== Done. Embedded {total_embedded} chunks in {elapsed:.0f}s ===")
print(f"Cost estimate: ~${total_embedded * 0.000002:.4f} at OpenAI text-embedding-3-small rates")
