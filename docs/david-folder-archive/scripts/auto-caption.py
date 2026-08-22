"""
scripts/auto-caption.py

Auto-captions the oracle bone dataset with individual character labels.
Each image filename is like: char_59dc_019.jpg
The hex code (59dc) is the Unicode codepoint of the character.

Run on RunPod:
  python auto-caption.py --dataset /workspace/lora_ready/10_jgw_oracle
"""

import os
import glob
import argparse

def hex_to_char(hex_str):
    """Convert hex unicode codepoint to character e.g. '65e5' -> '日'"""
    try:
        return chr(int(hex_str, 16))
    except:
        return None

# Oracle bone character descriptions for better captions
CHAR_DESC = {
    '日': 'sun circle with central dot, rectangle with horizontal midline',
    '月': 'crescent moon, curved rectangle with two interior lines',
    '山': 'three mountain peaks, three vertical strokes on base',
    '水': 'flowing water, vertical stroke with curved branches',
    '火': 'fire flames, central stroke with splaying base',
    '木': 'tree, trunk with branches above and roots below',
    '土': 'earth mound, vertical stroke on horizontal base',
    '金': 'metal ore, triangle with dots and descending strokes',
    '人': 'person walking, two diagonal strokes like legs',
    '口': 'mouth open, simple square or rectangle',
    '一': 'number one, single horizontal stroke',
    '二': 'number two, two horizontal strokes',
    '三': 'number three, three horizontal strokes',
    '十': 'number ten, cross shape vertical and horizontal',
    '明': 'bright light, sun and moon side by side',
    '休': 'rest, person leaning against tree trunk',
    '林': 'grove, two trees side by side',
    '森': 'forest, three trees arranged in triangle',
    '好': 'good, woman and child together',
    '马': 'horse, animal with mane legs and tail',
    '鱼': 'fish, oval body with scales fins and tail',
    '龟': 'turtle, oval shell with head legs and tail',
    '鸟': 'bird, round body with beak tail and feet',
    '王': 'king, three horizontal strokes connected by vertical',
    '天': 'heaven sky, person with raised arms great horizontal stroke',
    '帝': 'emperor deity, elaborate crown and ritual symbol',
    '贞': 'divination, tripod vessel with fire below',
    '吉': 'auspicious lucky, weapon or axe with mouth',
}

def get_caption(filename):
    """Generate caption from filename like char_59dc_019.jpg"""
    base = os.path.basename(filename)
    parts = base.replace('.jpg','').replace('.png','').split('_')
    
    char = None
    if len(parts) >= 2:
        # Try second part as hex codepoint
        hex_code = parts[1]
        char = hex_to_char(hex_code)
    
    if char and char in CHAR_DESC:
        desc = CHAR_DESC[char]
        return f"jgw_oracle {char}, oracle bone script inscription, {desc}, shang dynasty 1250 BCE, bone engraving incised line, ivory background"
    elif char:
        return f"jgw_oracle {char}, oracle bone script character {char}, shang dynasty inscription, bone engraving, ivory background"
    else:
        return "jgw_oracle, oracle bone script inscription, shang dynasty 1250 BCE, bone engraving incised line, ivory background"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/workspace/lora_ready/10_jgw_oracle')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    
    images = glob.glob(os.path.join(args.dataset, '*.jpg'))
    images += glob.glob(os.path.join(args.dataset, '*.png'))
    
    print(f"Found {len(images)} images in {args.dataset}")
    
    counts = {}
    fixed = 0
    skipped = 0
    
    for img_path in images:
        txt_path = img_path.replace('.jpg','.txt').replace('.png','.txt')
        caption = get_caption(img_path)
        
        # Extract char for stats
        base = os.path.basename(img_path)
        parts = base.replace('.jpg','').replace('.png','').split('_')
        char = hex_to_char(parts[1]) if len(parts) >= 2 else '?'
        counts[char] = counts.get(char, 0) + 1
        
        if args.dry_run:
            if fixed < 5:
                print(f"  {os.path.basename(img_path)} -> {caption}")
        else:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(caption)
            fixed += 1
    
    print(f"\nCharacter distribution:")
    for char, count in sorted(counts.items(), key=lambda x: -x[1])[:20]:
        print(f"  {char}: {count} images")
    
    if not args.dry_run:
        print(f"\n✓ Captioned {fixed} images")
    else:
        print(f"\nDry run complete. Run without --dry-run to apply.")

if __name__ == '__main__':
    main()
