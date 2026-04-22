/**
 * src/components/MnemonicCard.jsx
 *
 * Origin & Memory card — shows:
 *   1. Triple panel: oracle bone → illustration → modern character
 *   2. Pinyin with tone mark
 *   3. Meaning in current UI language (zh/en/it with graceful fallbacks)
 *   4. Mnemonic story (three languages, falls back to built-in etymology)
 *   5. Evolution strip (甲→金→隶→楷) when evolution JSON present
 *
 * Image source priority:
 *   illustration_url (admin-uploaded)
 *   → mnemonic_image_url (older AI-generated)
 *   → mnemonic_svg (inline SVG)
 *   → nothing (gracefully hides the illustration panel, still shows oracle + modern)
 */
import { useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

const KNOWN_ETYMOLOGY = {
  '一': { zh:'一根竹棍', en:'One bamboo stick', it:'Un bastoncino di bambù',
          tip_zh:'最简单的数字，一横表示一', tip_en:'The simplest number — one horizontal stroke', tip_it:'Il numero più semplice — un tratto orizzontale' },
  '二': { zh:'两根竹棍', en:'Two bamboo sticks', it:'Due bastoncini',
          tip_zh:'两横叠放表示二', tip_en:'Two strokes stacked = two', tip_it:'Due tratti sovrapposti' },
  '三': { zh:'三根竹棍', en:'Three bamboo sticks', it:'Tre bastoncini',
          tip_zh:'三横叠放表示三', tip_en:'Three strokes stacked = three', tip_it:'Tre tratti sovrapposti' },
  '日': { zh:'太阳和中间的光芒', en:'Sun with a bright centre mark', it:'Sole con segno centrale',
          tip_zh:'甲骨文日字像太阳，中间一点是阳光', tip_en:'Oracle bone 日 looks exactly like the sun — circle with a central dot of light', tip_it:'L\'osso oracolare 日 assomiglia al sole' },
  '月': { zh:'月牙和月相标记', en:'Crescent moon with phase marks', it:'Luna crescente con segni di fase',
          tip_zh:'像弯弯的月亮，两横是月亮上的阴影', tip_en:'Looks like a crescent — the two strokes show the moon\'s shadow', tip_it:'Assomiglia a una mezzaluna' },
  '山': { zh:'三座山峰，中间最高', en:'Three peaks, the centre tallest', it:'Tre cime, la centrale più alta',
          tip_zh:'三个山峰，就像真实的山脉轮廓', tip_en:'Three mountain peaks — exactly what a mountain range looks like from afar', tip_it:'Tre cime di montagna — come un profilo montuoso reale' },
  '水': { zh:'中间水流和两侧水滴', en:'Central stream with splashing drops', it:'Corso d\'acqua con gocce',
          tip_zh:'像河流，中间是主流，两边是水花', tip_en:'Looks like a river — the centre is the main current, the sides are splashing drops', tip_it:'Come un fiume con le onde laterali' },
  '火': { zh:'向上升腾的三根火苗', en:'Three upward flames rising', it:'Tre fiamme che salgono',
          tip_zh:'甲骨文火字就是三根火焰', tip_en:'Oracle bone 火 is literally three flames leaping upward', tip_it:'Tre fiamme che salgono verso l\'alto' },
  '木': { zh:'树干、树枝和树根', en:'Trunk above, roots below', it:'Tronco in alto, radici in basso',
          tip_zh:'树干是竖画，上面分叉是枝，下面分叉是根', tip_en:'The vertical stroke is the trunk — branches spread above, roots spread below', tip_it:'Il tratto verticale è il tronco' },
  '人': { zh:'侧面走路的人', en:'A person walking in profile', it:'Una persona che cammina di profilo',
          tip_zh:'像一个侧身行走的人，两笔是身体和腿', tip_en:'Two strokes show a person striding forward — body and leg in profile', tip_it:'Due tratti mostrano una persona che cammina' },
  '休': { zh:'人靠在树上休息', en:'Person leaning against a tree', it:'Persona che si appoggia a un albero',
          tip_zh:'左边是人 人，右边是树 木，人靠树休息', tip_en:'Left: person 人. Right: tree 木. Person leaning on tree = rest!', tip_it:'Sinistra: persona 人. Destra: albero 木. Insieme = riposo!' },
  '明': { zh:'太阳和月亮一起照亮', en:'Sun and moon both shining = bright', it:'Sole e luna insieme = luminoso',
          tip_zh:'日+月=明，两个发光体在一起当然明亮', tip_en:'Sun 日 + Moon 月 = Bright 明 — when both luminaries shine together!', tip_it:'Sole + Luna = Luminoso — quando entrambi brillano!' },
  '森': { zh:'三棵树在一起是森林', en:'Three trees together = forest', it:'Tre alberi insieme = foresta',
          tip_zh:'木+木+木=森，三棵树当然是森林', tip_en:'Tree + Tree + Tree = Forest 森 — more trees, deeper forest', tip_it:'Albero × 3 = Foresta' },
  '林': { zh:'两棵树在一起是树林', en:'Two trees together = grove', it:'Due alberi = boschetto',
          tip_zh:'木+木=林，两棵树是小树林', tip_en:'Tree + Tree = Grove 林 — a small cluster of trees', tip_it:'Due alberi = un piccolo bosco' },
  '好': { zh:'女人抱着孩子', en:'Woman holding a child = good', it:'Donna con bambino = buono',
          tip_zh:'左边是女 女，右边是子 子，母子在一起当然好', tip_en:'Woman 女 + Child 子 = Good 好 — mother and child together is always good', tip_it:'Donna + Bambino = Buono — madre e figlio insieme' },
  '马': { zh:'奔跑的马的全身像', en:'Portrait of a galloping horse', it:'Ritratto di un cavallo al galoppo',
          tip_zh:'甲骨文马字有完整的马头、身体、四条腿和尾巴', tip_en:'Oracle bone 马 is a detailed horse portrait: mane, body, four legs, tail', tip_it:'Il carattere oracle mostra un ritratto dettagliato del cavallo' },
  '龟': { zh:'龟甲上刻着龟字', en:'Turtle drawn on a turtle shell', it:'Tartaruga disegnata sul suo guscio',
          tip_zh:'最有趣：龟字刻在乌龟壳上，是史上最棒的自我指示', tip_en:'Most amazing: the character 龟 was inscribed ON turtle shells — the word IS the thing!', tip_it:'Il carattere 龟 era inciso sulle stesse tartarughe!' },
};

// Map pinyin tone number (1-4) to color — same convention as most Chinese apps
const TONE_COLORS = {
  1: '#D32F2F',   // high/flat — red
  2: '#388E3C',   // rising — green
  3: '#1976D2',   // dip — blue
  4: '#7B1FA2',   // falling — purple
  5: '#757575',   // neutral — grey
  0: '#757575',
};

function toneNumFromPinyin(p) {
  if (!p) return 0;
  // Handle tone marks (ā ē ī ō ū → 1, etc.)
  const diacritics = {
    1: 'āēīōūǖĀĒĪŌŪǕ',
    2: 'áéíóúǘÁÉÍÓÚǗ',
    3: 'ǎěǐǒǔǚǍĚǏǑǓǙ',
    4: 'àèìòùǜÀÈÌÒÙǛ',
  };
  for (const [tone, chars] of Object.entries(diacritics)) {
    for (const ch of chars) {
      if (p.includes(ch)) return parseInt(tone);
    }
  }
  // Fallback: trailing digit (e.g., "ni3")
  const m = p.match(/([1-5])$/);
  return m ? parseInt(m[1]) : 0;
}

export default function MnemonicCard({ character, lang: propLang }) {
  const [expanded, setExpanded] = useState(true);
  const { lang: ctxLang } = useLang();
  const lang = propLang || ctxLang || 'en';

  if (!character) return null;

  const glyph       = character.glyph_modern || character.c || character.character;
  const etymology   = KNOWN_ETYMOLOGY[glyph];
  const pinyin      = character.pinyin;
  const toneNum     = toneNumFromPinyin(pinyin);
  const toneColor   = TONE_COLORS[toneNum] || TONE_COLORS[0];

  // ── Image source priority: illustration_url > mnemonic_image_url > mnemonic_svg ──
  const illustrationUrl = character.illustration_url
                        || character.mnemonic_image_url
                        || character.image_url
                        || null;
  const mnemonicSvg     = character.mnemonic_svg;
  const oracleSvg       = character.svg_jiaguwen;

  // ── Meaning in current language with fallback chain ──
  const meaning = lang === 'zh' ? (character.meaning_zh || character.meaning_en || character.meaning_it)
                : lang === 'it' ? (character.meaning_it || character.meaning_en || character.meaning_zh)
                :                 (character.meaning_en || character.meaning_zh || character.meaning_it);

  // ── Story in current language with fallback chain ──
  // 1. Long narrative (mnemonic_story_*) if DB has it
  // 2. Short DB mnemonic (mnemonic_zh/en/it) — 28 chars have these populated
  // 3. Built-in KNOWN_ETYMOLOGY tip for the ~15 seed characters
  const story = lang === 'zh'
    ? (character.mnemonic_story_zh || character.mnemonic_zh || etymology?.tip_zh)
    : lang === 'it'
      ? (character.mnemonic_story_it || character.mnemonic_it || etymology?.tip_it)
      : (character.mnemonic_story_en || character.mnemonic_en || etymology?.tip_en);

  const visualLabel = lang === 'zh' ? etymology?.zh
                    : lang === 'it' ? etymology?.it
                    :                 etymology?.en;

  const hasIllustration = !!(illustrationUrl || mnemonicSvg);
  const hasOracle       = !!oracleSvg;

  // Localized labels
  const L = {
    title:   lang==='zh' ? '字源图解' : lang==='it' ? 'Origine & Memoria' : 'Origin & Memory',
    oracle:  lang==='zh' ? '甲骨文'   : 'ORACLE',
    illus:   lang==='zh' ? '图解'     : lang==='it' ? 'ILLUSTRAZIONE' : 'ILLUSTRATION',
    modern:  lang==='zh' ? '现代字'   : lang==='it' ? 'MODERNO' : 'MODERN',
    empty:   lang==='zh' ? '暂无插图 — 请通过管理面板添加'
                         : lang==='it' ? 'Nessuna illustrazione — aggiungila dal pannello admin'
                         : 'No illustration yet — add one via the Admin Panel',
    evolve:  lang==='zh' ? '演变'     : lang==='it' ? 'Evoluzione' : 'Evolution',
    evolvedTo: lang==='zh' ? '演变为' : lang==='it' ? 'evoluto in' : 'evolved to',
  };

  return (
    <div style={{ width:'100%', maxWidth:320, margin:'0 auto' }}>
      {/* Accordion header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width:'100%', padding:'10px 14px', display:'flex', alignItems:'center',
          justifyContent:'space-between', background:'var(--parchment)',
          border:'0.5px solid var(--border)', borderRadius: expanded ? '12px 12px 0 0' : '12px',
          cursor:'pointer', fontFamily:'var(--font-sans)' }}
      >
        <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>
          {L.title} · Origin &amp; Memory
        </span>
        <span style={{ fontSize:14, color:'var(--text-3)',
          transform: expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
      </button>

      {expanded && (
        <div style={{ border:'0.5px solid var(--border)', borderTop:'none',
          borderRadius:'0 0 12px 12px', background:'var(--card)', overflow:'hidden' }}>

          {/* ── Pinyin + Meaning header ── */}
          {(pinyin || meaning) && (
            <div style={{ padding:'10px 14px', borderBottom:'0.5px solid var(--border)',
              background:'#fffdf7', display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
              {pinyin && (
                <span style={{ fontSize:16, fontWeight:600, color:toneColor,
                  fontFamily:'var(--font-sans)', letterSpacing:0.3 }}>
                  {pinyin}
                </span>
              )}
              {meaning && (
                <span style={{ fontSize:13, color:'var(--text-2)', fontStyle:'italic', flex:1 }}>
                  {meaning}
                </span>
              )}
            </div>
          )}

          {/* ── Triple panel: oracle → illustration → modern ── */}
          <div style={{ display:'grid',
            gridTemplateColumns:
              hasOracle && hasIllustration ? '1fr auto 1fr 1fr'
              : hasOracle ? '1fr 1fr'
              : hasIllustration ? '1fr 1fr'
              : '1fr',
            gap:0, borderBottom: (hasOracle || hasIllustration) ? '0.5px solid var(--border)' : 'none',
            alignItems:'stretch' }}>

            {/* Panel 1: Oracle bone SVG */}
            {hasOracle && (
              <div style={{ padding:'12px 8px', textAlign:'center',
                borderRight:'0.5px solid var(--border)', background:'#fdf6e3' }}>
                <div style={{ fontSize:9, color:'var(--text-3)', marginBottom:6,
                  letterSpacing:'0.08em' }}>{L.oracle}</div>
                <div style={{ width:64, height:64, margin:'0 auto',
                  display:'flex', alignItems:'center', justifyContent:'center' }}
                  dangerouslySetInnerHTML={{ __html:
                    oracleSvg.replace('<svg ', '<svg width="60" height="60" ') }}
                />
              </div>
            )}

            {/* Arrow (only if both oracle AND illustration exist) */}
            {hasOracle && hasIllustration && (
              <div style={{ display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                padding:'12px 4px', background:'#fdf6e3',
                borderRight:'0.5px solid var(--border)', minWidth:48 }}>
                <div style={{ fontSize:22, color:'#c89090' }}>→</div>
                {visualLabel && (
                  <div style={{ fontSize:9, color:'var(--text-3)', marginTop:4,
                    textAlign:'center', lineHeight:1.3 }}>
                    {visualLabel}
                  </div>
                )}
              </div>
            )}

            {/* Panel 2: Illustration (img or svg) */}
            {hasIllustration && (
              <div style={{ padding:'12px 8px', textAlign:'center', background:'#f8f4ff' }}>
                <div style={{ fontSize:9, color:'var(--text-3)', marginBottom:6,
                  letterSpacing:'0.08em' }}>{L.illus}</div>
                <div style={{ width:64, height:64, margin:'0 auto',
                  borderRadius:10, overflow:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#fff' }}>
                  {illustrationUrl
                    ? <img src={illustrationUrl} alt={glyph}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <div dangerouslySetInnerHTML={{ __html:
                        mnemonicSvg.replace('<svg ', '<svg width="60" height="60" ') }}/>
                  }
                </div>
              </div>
            )}

            {/* Panel 3: Modern character (always shown if panel is wider than 1 col) */}
            {(hasOracle || hasIllustration) && (
              <div style={{ padding:'12px 8px', textAlign:'center',
                borderLeft:'0.5px solid var(--border)' }}>
                <div style={{ fontSize:9, color:'var(--text-3)', marginBottom:6,
                  letterSpacing:'0.08em' }}>{L.modern}</div>
                <div style={{ fontSize:48, fontFamily:"'STKaiti','KaiTi',serif",
                  color:'#1a0a05', lineHeight:1 }}>{glyph}</div>
              </div>
            )}
          </div>

          {/* ── Mnemonic story ── */}
          {story && (
            <div style={{ padding:'12px 14px',
              borderBottom: '0.5px solid var(--border)',
              background:'#fffdf7' }}>
              <div style={{ fontSize:12, color:'#8B4513', lineHeight:1.7, fontStyle:'italic' }}>
                {story}
              </div>
            </div>
          )}

          {/* ── Empty state (only if really nothing — no image, no svg, no story) ── */}
          {!hasIllustration && !hasOracle && !story && (
            <div style={{ padding:'16px', textAlign:'center',
              color:'var(--text-3)', fontSize:12, lineHeight:1.6 }}>
              <div style={{ fontSize:32, marginBottom:6, opacity:0.4 }}>🖼️</div>
              {L.empty}
            </div>
          )}

          {/* ── Evolution strip ── */}
          {character.evolution && (() => {
            try {
              const evo = typeof character.evolution === 'string'
                ? JSON.parse(character.evolution) : character.evolution;
              const stages = ['jiaguwen','jinwen','lishu','kaishu'].filter(s => evo[s]);
              if (!stages.length) return null;
              return (
                <div style={{ padding:'10px 14px', display:'flex',
                  gap:4, alignItems:'center', overflow:'hidden', flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>{L.evolve}</span>
                  {stages.map((s,i) => (
                    <span key={s} style={{ display:'flex', alignItems:'center', gap:3 }}>
                      {i > 0 && <span style={{ fontSize:10, color:'var(--text-3)' }}>→</span>}
                      <span style={{ fontSize:13, fontFamily:"'STKaiti','KaiTi',serif",
                        color:'var(--text-2)' }}>{glyph}</span>
                      <span style={{ fontSize:8, color:'var(--text-3)' }}>
                        {{jiaguwen:'甲',jinwen:'金',lishu:'隶',kaishu:'楷'}[s]}
                      </span>
                    </span>
                  ))}
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}
    </div>
  );
}
