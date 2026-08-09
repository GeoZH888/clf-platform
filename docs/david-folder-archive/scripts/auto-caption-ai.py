"""
scripts/auto-caption-ai.py

Auto-captions oracle bone dataset using Claude API.
Reads filename hex codes → gets character → Claude describes oracle bone form.

Usage on RunPod:
  export ANTHROPIC_API_KEY=sk-ant-...
  python auto-caption-ai.py --dataset /workspace/lora_ready/10_jgw_oracle

Cost estimate: ~30,000 images × $0.000003 = ~$0.09 total
Time estimate: ~2 hours (rate limited to 50 req/sec)
"""

import os
import glob
import time
import json
import argparse
import urllib.request
import urllib.error

# ── Hardcoded descriptions for common characters (no API needed) ──
KNOWN = {
    '日': 'sun, rectangle with horizontal midline, circle with central dot',
    '月': 'crescent moon, curved body with two interior horizontal lines',
    '山': 'three mountain peaks, three vertical strokes rising from base',
    '水': 'flowing water, vertical stroke with curved lateral branches',
    '火': 'fire flames, central upward stroke with splaying base strokes',
    '木': 'tree, vertical trunk with horizontal branches above and roots below',
    '土': 'earth mound, vertical stroke rising from double horizontal base',
    '金': 'metal ore, inverted triangle with two dots and descending strokes',
    '人': 'walking person, two diagonal strokes forming legs in profile',
    '口': 'open mouth, simple square or rectangular outline',
    '一': 'number one, single horizontal stroke',
    '二': 'number two, two parallel horizontal strokes',
    '三': 'number three, three parallel horizontal strokes',
    '十': 'number ten, cross shape vertical bisecting horizontal',
    '明': 'brightness, sun rectangle beside crescent moon',
    '休': 'rest, person figure leaning against tree trunk',
    '林': 'grove, two tree characters side by side',
    '森': 'forest, three tree characters in triangular arrangement',
    '好': 'good, kneeling woman figure beside child figure',
    '马': 'horse, animal body with mane flowing neck four legs tail',
    '鱼': 'fish, oval body with scale grid fins and forked tail',
    '龟': 'turtle, oval shell with grid pattern head four legs tail',
    '鸟': 'bird, round body with beak eye wing tail and feet',
    '王': 'king, three horizontal strokes connected by central vertical',
    '天': 'heaven, great person with outstretched arms under large horizontal',
    '帝': 'emperor deity, elaborate crown symbol with descending ritual strokes',
    '贞': 'divination, tripod vessel with fire divination crack pattern',
    '吉': 'auspicious, axe or weapon head above rectangular mouth',
    '龙': 'dragon, serpentine body with open jaws claws scales',
    '凤': 'phoenix, bird with elaborate tail feathers and crown',
    '虎': 'tiger, striped feline body with open jaws and tail',
}

def hex_to_char(hex_str):
    try:
        return chr(int(hex_str, 16))
    except:
        return None

def get_char_from_filename(filename):
    base = os.path.basename(filename)
    parts = base.replace('.jpg','').replace('.png','').split('_')
    if len(parts) >= 2:
        return hex_to_char(parts[1])
    return None

def claude_describe(char, api_key, retries=3):
    """Ask Claude to describe the oracle bone form of a character."""
    prompt = f"""For the Chinese character "{char}" (Unicode {hex(ord(char))}):
Describe its oracle bone script (甲骨文) form in 10-15 words.
Focus on the VISUAL SHAPE — strokes, lines, curves, what it looks like drawn on bone.
Return ONLY the description, no explanation, no character name, no pinyin.
Example format: "curved rectangular body with horizontal midline and central dot"
Example format: "three vertical strokes of different heights rising from horizontal base"
Example format: "human figure in profile with bent knee and outstretched arm" """

    data = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": prompt}]
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=data,
        headers={
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
        }
    )

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                return result['content'][0]['text'].strip()
        except urllib.error.HTTPError as e:
            if e.code == 429:  # Rate limited
                wait = 2 ** attempt
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP error {e.code}: {e.read().decode()}")
                return None
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(1)
    return None

def build_caption(char, description):
    return (
        f"jgw_oracle {char}, "
        f"oracle bone script character {char}, "
        f"{description}, "
        f"shang dynasty 1250 BCE inscription, "
        f"bone engraving incised line, ivory background, "
        f"monochrome high contrast"
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/workspace/lora_ready/10_jgw_oracle')
    parser.add_argument('--api-key', default=os.environ.get('ANTHROPIC_API_KEY', ''))
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--overwrite', action='store_true', help='Re-caption existing files')
    parser.add_argument('--batch-size', type=int, default=10, help='Chars to cache per batch')
    args = parser.parse_args()

    if not args.dry_run and not args.api_key:
        print("ERROR: Set ANTHROPIC_API_KEY or pass --api-key")
        print("Usage: export ANTHROPIC_API_KEY=sk-ant-...")
        return

    images = sorted(glob.glob(os.path.join(args.dataset, '*.jpg')))
    images += sorted(glob.glob(os.path.join(args.dataset, '*.png')))
    print(f"Found {len(images)} images")

    # Cache descriptions per character (one API call per unique character)
    desc_cache = {}
    skipped = 0
    captioned = 0
    api_calls = 0

    # Get unique characters first
    unique_chars = set()
    for img in images:
        char = get_char_from_filename(img)
        if char:
            unique_chars.add(char)

    print(f"Found {len(unique_chars)} unique characters")
    print(f"Known descriptions: {len([c for c in unique_chars if c in KNOWN])}")
    print(f"Need API calls: {len([c for c in unique_chars if c not in KNOWN])}")

    if args.dry_run:
        print("\nDry run — showing sample captions:")
        for char in list(unique_chars)[:5]:
            desc = KNOWN.get(char, f"oracle bone script form of {char}")
            print(f"  {char}: {build_caption(char, desc)}")
        return

    # Pre-fetch descriptions for unknown characters
    unknown = [c for c in unique_chars if c not in KNOWN]
    if unknown and args.api_key:
        print(f"\nFetching descriptions for {len(unknown)} characters via Claude...")
        for i, char in enumerate(unknown):
            desc = claude_describe(char, args.api_key)
            if desc:
                desc_cache[char] = desc
                api_calls += 1
                if i % 10 == 0:
                    print(f"  {i+1}/{len(unknown)}: {char} → {desc[:50]}...")
            else:
                desc_cache[char] = f"oracle bone script form of character {char}"
            time.sleep(0.1)  # Rate limit

    # Now write all caption files
    print(f"\nWriting captions...")
    for i, img_path in enumerate(images):
        txt_path = img_path.replace('.jpg','.txt').replace('.png','.txt')

        if os.path.exists(txt_path) and os.path.getsize(txt_path) > 0 and not args.overwrite:
            skipped += 1
            continue

        char = get_char_from_filename(img_path)
        if char:
            desc = KNOWN.get(char) or desc_cache.get(char) or f"oracle bone script character {char}"
        else:
            desc = "oracle bone script inscription shang dynasty"

        caption = build_caption(char or '?', desc)

        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(caption)
        captioned += 1

        if i % 5000 == 0:
            print(f"  {i}/{len(images)} images captioned...")

    print(f"\n✓ Done!")
    print(f"  Captioned: {captioned}")
    print(f"  Skipped (existing): {skipped}")
    print(f"  API calls made: {api_calls}")
    print(f"  Estimated cost: ${api_calls * 0.000003:.4f}")

if __name__ == '__main__':
    main()
