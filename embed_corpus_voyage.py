# embed_corpus_voyage.py
# Direct embedding pipeline using Voyage AI text-embeddings.
# FIX: paginate Supabase REST queries (default limit is 1000 rows).

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

VOYAGE_BATCH_SIZE = 128
EMBED_MODEL = "voyage-3"
EMBED_DIM = 1024
RATE_LIMIT_DELAY = 0.3
MAX_RETRIES = 3
PAGE_SIZE = 1000

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
        elif k == "VOYAGE_API_KEY" and not os.environ.get("VOYAGE_API_KEY"):
            os.environ["VOYAGE_API_KEY"] = v

_load_dotenv()

VOYAGE_KEY = os.environ.get("VOYAGE_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not VOYAGE_KEY:
    print("ERROR: VOYAGE_API_KEY not set")
    sys.exit(1)
if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Supabase env not set")
    sys.exit(1)

print(f"Voyage:      {EMBED_MODEL} (dim={EMBED_DIM})")
print(f"Supabase:    {SUPABASE_URL}")
print(f"Batch size:  {VOYAGE_BATCH_SIZE} texts per Voyage call")
print(f"Pagination:  {PAGE_SIZE} rows per Supabase page")
print()

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

def fetch_all_paginated(base_path):
    """Page through Supabase REST results using offset+limit."""
    out = []
    offset = 0
    while True:
        sep = "&" if "?" in base_path else "?"
        path = f"{base_path}{sep}offset={offset}&limit={PAGE_SIZE}"
        code, page = supabase_call("GET", path)
        if code != 200 or not isinstance(page, list):
            print(f"  [FAIL] page at offset {offset}: code={code}, body={str(page)[:200]}")
            break
        if not page:
            break
        out.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        if offset > 100000:
            print("  [WARN] hit 100k row safety limit")
            break
    return out

def voyage_embed(texts):
    payload = {"input": texts, "model": EMBED_MODEL, "input_type": "document"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request("https://api.voyageai.com/v1/embeddings", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {VOYAGE_KEY}")
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return [d["embedding"] for d in result["data"]]
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            if e.code == 429:
                wait = 2 ** (attempt + 1)
                print(f"\n  [rate limit] waiting {wait}s")
                time.sleep(wait)
                continue
            raise Exception(f"Voyage HTTP {e.code}: {body[:300]}")
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n  [error] {e}; retry")
                time.sleep(2)
                continue
            raise
    raise Exception("Max retries exceeded")

print("=== Step 1: Survey (paginated) ===")
print("  fetching all chunk ids...")
all_chunks = fetch_all_paginated("/rest/v1/clf_corpus_chunks?select=id")
print(f"  total chunks in DB: {len(all_chunks)}")

print("  fetching all embedded chunk ids...")
all_embs = fetch_all_paginated("/rest/v1/clf_chunk_embeddings?select=chunk_id")
print(f"  already embedded:   {len(all_embs)}")

all_chunk_ids = set(c["id"] for c in all_chunks)
embedded_ids = set(e["chunk_id"] for e in all_embs)
pending_ids = list(all_chunk_ids - embedded_ids)
print(f"  pending:            {len(pending_ids)}")
print()

if not pending_ids:
    print("[OK] All chunks already embedded.")
    sys.exit(0)

answer = input(f"  Embed {len(pending_ids)} chunks via Voyage? [y/N]: ").strip().lower()
if answer != "y":
    print("  Aborted.")
    sys.exit(0)

print("\n=== Step 2: Embedding loop ===")
start = time.time()
total_done = 0
total_failed = 0

for batch_start in range(0, len(pending_ids), VOYAGE_BATCH_SIZE):
    batch_ids = pending_ids[batch_start:batch_start + VOYAGE_BATCH_SIZE]
    batch_n = len(batch_ids)
    id_list = ",".join(batch_ids)
    code, chunks = supabase_call(
        "GET",
        f"/rest/v1/clf_corpus_chunks?id=in.({id_list})&select=id,content,title"
    )
    if code != 200 or not isinstance(chunks, list):
        print(f"  [FAIL] fetch chunks batch: code={code}")
        total_failed += batch_n
        continue

    texts = []
    chunk_refs = []
    for c in chunks:
        text = (c.get("content") or c.get("title") or "").strip()
        if not text:
            continue
        text = text[:8000]
        texts.append(text)
        chunk_refs.append(c["id"])
    if not texts:
        continue

    try:
        embeddings = voyage_embed(texts)
    except Exception as e:
        print(f"\n  [FAIL] Voyage batch {batch_start//VOYAGE_BATCH_SIZE+1}: {e}")
        total_failed += batch_n
        time.sleep(2)
        continue

    if len(embeddings) != len(chunk_refs):
        print(f"\n  [FAIL] count mismatch")
        total_failed += batch_n
        continue

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
    print(f"  batch {batch_start//VOYAGE_BATCH_SIZE+1:3d}: +{len(rows):3d}  total={total_done:5d}/{len(pending_ids)}  rate={rate:.1f}/s  ETA={eta:.0f}s", flush=True)
    time.sleep(RATE_LIMIT_DELAY)

elapsed = time.time() - start
print()
print("=" * 60)
print(f"  Embedded: {total_done}")
print(f"  Failed:   {total_failed}")
print(f"  Time:     {elapsed:.0f}s ({elapsed/60:.1f} min)")
print("=" * 60)
print()
print("VERIFY:")
print("  SELECT count(*) FROM clf_chunk_embeddings;")
print(f"  -- should show {total_done + len(embedded_ids)}")
