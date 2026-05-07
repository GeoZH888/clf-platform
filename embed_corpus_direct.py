# scripts/embed_corpus_direct.py
# Direct embedding pipeline (skips Netlify function).
# - Auto-loads .env for OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# - Fetches chunks WITHOUT embeddings (resumable)
# - Batches of 100 to OpenAI text-embedding-3-small
# - Upserts embeddings to clf_chunk_embeddings via Supabase REST
# - Cost estimate: ~$0.02 for all 11,092 chunks (text-embedding-3-small @ $0.02/1M tokens)
# - Wall time: ~10-15 min

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ============================================================
# Config
# ============================================================
OPENAI_BATCH_SIZE = 100   # max texts per OpenAI call (their API supports up to 2048)
SUPABASE_BATCH_SIZE = 100 # max embeddings per Supabase upsert
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536
OPENAI_RATE_LIMIT_DELAY = 0.2  # seconds between OpenAI calls
MAX_RETRIES = 3

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
        # Map both VITE_ and non-prefixed
        if k == "VITE_SUPABASE_URL" and not os.environ.get("SUPABASE_URL"):
            os.environ["SUPABASE_URL"] = v
        elif k == "SUPABASE_SERVICE_ROLE_KEY" and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = v
        elif k == "OPENAI_API_KEY" and not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = v

_load_dotenv()

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ============================================================
# Pre-flight
# ============================================================
if not OPENAI_KEY:
    print("ERROR: OPENAI_API_KEY not set in environment or .env")
    print("Set it in .env:  OPENAI_API_KEY=sk-...")
    sys.exit(1)
if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

print(f"OpenAI:      {EMBED_MODEL} (dim={EMBED_DIM})")
print(f"Supabase:    {SUPABASE_URL}")
print(f"Batch size:  {OPENAI_BATCH_SIZE} texts per OpenAI call")
print()

# ============================================================
# Supabase REST helper
# ============================================================
def supabase_call(method, path, body=None, prefer=None):
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
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return None, str(e)

# ============================================================
# OpenAI helper
# ============================================================
def openai_embed(texts):
    """Returns list of embeddings (one per text)."""
    payload = {"model": EMBED_MODEL, "input": texts}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=data, method="POST"
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {OPENAI_KEY}")

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return [d["embedding"] for d in result["data"]]
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            if e.code == 429:  # rate limit
                wait = 2 ** (attempt + 1)
                print(f"\n  [rate limit] waiting {wait}s before retry {attempt+1}/{MAX_RETRIES}")
                time.sleep(wait)
                continue
            raise Exception(f"OpenAI HTTP {e.code}: {body[:200]}")
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n  [error] {e}; retry {attempt+1}/{MAX_RETRIES}")
                time.sleep(2)
                continue
            raise
    raise Exception("Max retries exceeded")

# ============================================================
# Step 1: Count totals
# ============================================================
print("=== Step 1: Survey ===")
code, total_chunks = supabase_call(
    "GET",
    "/rest/v1/clf_corpus_chunks?select=count",
    prefer="count=exact"
)
# Supabase returns count via Content-Range header but our helper doesn't expose it;
# fall back to fetching ids
code, all_chunks = supabase_call(
    "GET",
    "/rest/v1/clf_corpus_chunks?select=id&limit=20000"
)
if code != 200 or not isinstance(all_chunks, list):
    print(f"[FAIL] couldn't fetch chunks: code={code}, body={str(all_chunks)[:200]}")
    sys.exit(1)
total_chunks_n = len(all_chunks)
all_chunk_ids = set(c["id"] for c in all_chunks)
print(f"  total chunks in DB: {total_chunks_n}")

code, all_embs = supabase_call(
    "GET",
    "/rest/v1/clf_chunk_embeddings?select=chunk_id&limit=20000"
)
if code != 200:
    print(f"[FAIL] couldn't fetch existing embeddings: code={code}")
    sys.exit(1)
embedded_ids = set(e["chunk_id"] for e in (all_embs or []))
print(f"  already embedded:   {len(embedded_ids)}")

pending_ids = list(all_chunk_ids - embedded_ids)
print(f"  pending:            {len(pending_ids)}")
print()

if not pending_ids:
    print("[OK] All chunks already embedded. Nothing to do.")
    sys.exit(0)

# Estimate cost
est_tokens = len(pending_ids) * 5  # avg ~5 tokens per word
est_cost = est_tokens * 0.00000002  # text-embedding-3-small = $0.02 / 1M tokens
print(f"  estimated cost: ${est_cost:.4f} (~{est_tokens} tokens)")
print()

# Confirm
answer = input(f"  Embed {len(pending_ids)} chunks? [y/N]: ").strip().lower()
if answer != "y":
    print("  Aborted.")
    sys.exit(0)

# ============================================================
# Step 2: Process in batches
# ============================================================
print("\n=== Step 2: Embedding loop ===")
start = time.time()
total_done = 0
total_failed = 0

for batch_start in range(0, len(pending_ids), OPENAI_BATCH_SIZE):
    batch_ids = pending_ids[batch_start:batch_start + OPENAI_BATCH_SIZE]
    batch_n = len(batch_ids)

    # Fetch chunk content for this batch
    # Use ?id=in.(uuid1,uuid2,...) syntax
    id_list = ",".join(batch_ids)
    code, chunks = supabase_call(
        "GET",
        f"/rest/v1/clf_corpus_chunks?id=in.({id_list})&select=id,content,title"
    )
    if code != 200 or not isinstance(chunks, list):
        print(f"  [FAIL] fetch chunks batch: code={code}")
        total_failed += batch_n
        continue

    # Build texts (use content, fallback to title)
    texts = []
    chunk_refs = []
    for c in chunks:
        text = (c.get("content") or c.get("title") or "").strip()
        if not text:
            continue
        # Truncate to 8000 chars (well within OpenAI's 8192 token limit)
        text = text[:8000]
        texts.append(text)
        chunk_refs.append(c["id"])

    if not texts:
        print(f"  [skip] batch {batch_start//OPENAI_BATCH_SIZE+1}: no usable text")
        continue

    # Call OpenAI
    try:
        embeddings = openai_embed(texts)
    except Exception as e:
        print(f"\n  [FAIL] OpenAI batch {batch_start//OPENAI_BATCH_SIZE+1}: {e}")
        total_failed += batch_n
        time.sleep(2)
        continue

    if len(embeddings) != len(chunk_refs):
        print(f"\n  [FAIL] count mismatch: got {len(embeddings)}, expected {len(chunk_refs)}")
        total_failed += batch_n
        continue

    # Upsert to Supabase in sub-batches
    rows = [
        {
            "chunk_id": chunk_refs[i],
            "embedding": embeddings[i],
            "model": EMBED_MODEL,
            "embedded_at": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
        }
        for i in range(len(chunk_refs))
    ]
    code, result = supabase_call(
        "POST",
        "/rest/v1/clf_chunk_embeddings?on_conflict=chunk_id",
        body=rows,
        prefer="resolution=merge-duplicates"
    )
    if code not in (200, 201, 204):
        print(f"\n  [FAIL] Supabase upsert: code={code}, body={str(result)[:200]}")
        total_failed += batch_n
        continue

    total_done += len(rows)
    elapsed = time.time() - start
    rate = total_done / elapsed if elapsed > 0 else 0
    eta = (len(pending_ids) - total_done) / rate if rate > 0 else 0
    print(f"  batch {batch_start//OPENAI_BATCH_SIZE+1:3d}: +{len(rows):3d}  total={total_done:5d}/{len(pending_ids)}  rate={rate:.1f}/s  ETA={eta:.0f}s", flush=True)

    time.sleep(OPENAI_RATE_LIMIT_DELAY)

elapsed = time.time() - start
print()
print("=" * 60)
print(f"  Embedded: {total_done}")
print(f"  Failed:   {total_failed}")
print(f"  Time:     {elapsed:.0f}s ({elapsed/60:.1f} min)")
print(f"  Cost:     ~${total_done * 5 * 0.00000002:.4f}")
print("=" * 60)
print()
print("VERIFY in Supabase SQL Editor:")
print("  SELECT count(*) FROM clf_chunk_embeddings;")
print(f"  -- should show {total_done + len(embedded_ids)}")
print()
print("Once verified, RAG retrieval should return real results:")
print("  curl -X POST https://david-zhongwen.net/.netlify/functions/retrieve-content \\")
print("       -H 'Content-Type: application/json' \\")
print("       -d '{\"query\": \"family\", \"hsk_level\": 1, \"max_results\": 5}'")
