// src/pinyin/MouthDiagram.jsx
// Cross-section mouth diagrams for pinyin sounds

const MOUTH_TYPES = {
  // 双唇音 bilabial — lips pressed together
  bilabial: {
    label: '双唇音', labelEn: 'Both lips closed',
    desc: '上下嘴唇合拢', descEn: 'Press lips together',
    sounds: ['b','p','m'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        {/* Head outline */}
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        {/* Upper lip */}
        <path d="M30 50 Q45 44 60 46 Q75 44 90 50" fill="none" stroke="#E57373" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Lower lip */}
        <path d="M30 50 Q45 56 60 54 Q75 56 90 50" fill="none" stroke="#E57373" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Lips closed — filled */}
        <path d="M30 50 Q45 44 60 46 Q75 44 90 50 Q75 56 60 54 Q45 56 30 50Z" fill="#EF9A9A" opacity="0.6"/>
        {/* Teeth hint — none visible (closed) */}
        {/* Tongue — resting flat */}
        <path d="M38 62 Q60 58 82 62" fill="none" stroke="#FF8A65" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        {/* Nose */}
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 唇齿音 labiodental — upper teeth on lower lip
  labiodental: {
    label: '唇齿音', labelEn: 'Upper teeth + lower lip',
    desc: '上齿轻触下唇', descEn: 'Upper teeth touch lower lip',
    sounds: ['f'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        {/* Upper teeth */}
        <rect x="42" y="46" width="6" height="7" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="50" y="46" width="6" height="7" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="58" y="46" width="6" height="7" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="66" y="46" width="6" height="7" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        {/* Upper lip */}
        <path d="M30 46 Q45 40 60 42 Q75 40 90 46" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Lower lip touching teeth */}
        <path d="M38 54 Q60 58 82 54" fill="#EF9A9A" stroke="#E57373" strokeWidth="2" strokeLinecap="round"/>
        {/* Arrow showing teeth→lip */}
        <path d="M60 43 L60 52" stroke="#1565C0" strokeWidth="1" strokeDasharray="2 2" markerEnd="url(#arr)"/>
        <defs><marker id="arr" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#1565C0"/></marker></defs>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 舌尖前音 alveolar — tongue tip near upper teeth ridge
  alveolar: {
    label: '舌尖音', labelEn: 'Tongue tip up',
    desc: '舌尖抵上齿龈', descEn: 'Tongue tip touches upper ridge',
    sounds: ['d','t','n','l'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        {/* Mouth slightly open */}
        <path d="M32 50 Q46 44 60 46 Q74 44 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 50 Q46 56 60 54 Q74 56 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        {/* Upper teeth */}
        <rect x="44" y="47" width="5" height="5" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="51" y="47" width="5" height="5" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="58" y="47" width="5" height="5" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="65" y="47" width="5" height="5" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        {/* Tongue tip raised to ridge */}
        <path d="M38 62 Q50 58 62 50 Q66 47 65 48" fill="#FF8A65" stroke="#E64A19" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Tongue body */}
        <ellipse cx="50" cy="63" rx="16" ry="6" fill="#FF8A65" opacity="0.7"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 舌根音 velar — back of tongue raised
  velar: {
    label: '舌根音', labelEn: 'Back of tongue raised',
    desc: '舌根抵软腭', descEn: 'Back of tongue to soft palate',
    sounds: ['g','k','h'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        <path d="M32 50 Q46 45 60 47 Q74 45 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 50 Q46 55 60 53 Q74 55 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        {/* Tongue — back raised */}
        <path d="M36 65 Q48 64 58 62 Q68 56 75 52" fill="#FF8A65" stroke="#E64A19" strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="48" cy="66" rx="14" ry="5" fill="#FF8A65" opacity="0.7"/>
        {/* Soft palate */}
        <path d="M72 42 Q78 48 75 52" fill="none" stroke="#CE93D8" strokeWidth="2" strokeLinecap="round"/>
        {/* Arrow */}
        <path d="M70 55 L74 50" stroke="#1565C0" strokeWidth="1" strokeDasharray="2 2"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 舌面音 palatal — tongue body to hard palate (j q x)
  palatal: {
    label: '舌面音', labelEn: 'Tongue body to palate',
    desc: '舌面抵硬腭', descEn: 'Middle tongue to hard palate',
    sounds: ['j','q','x'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        <path d="M32 50 Q46 44 60 46 Q74 44 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 50 Q46 56 60 54 Q74 56 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        {/* Hard palate arch */}
        <path d="M44 38 Q60 28 76 38" fill="none" stroke="#CE93D8" strokeWidth="1.5" strokeDasharray="3 2"/>
        {/* Tongue middle raised */}
        <path d="M36 65 Q48 62 62 54 Q68 50 70 48" fill="#FF8A65" stroke="#E64A19" strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="50" cy="65" rx="16" ry="5" fill="#FF8A65" opacity="0.7"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 翘舌音 retroflex — tongue tip curled back (zh ch sh r)
  retroflex: {
    label: '翘舌音', labelEn: 'Tongue tip curled back',
    desc: '舌尖翘向上腭', descEn: 'Curl tongue tip backward',
    sounds: ['zh','ch','sh','r'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        <path d="M32 50 Q46 44 60 46 Q74 44 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 50 Q46 56 60 54 Q74 56 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        {/* Tongue curled up — retroflex */}
        <path d="M36 66 Q50 64 60 60 Q64 55 62 50 Q62 46 65 48" fill="none" stroke="#E64A19" strokeWidth="2" strokeLinecap="round"/>
        <ellipse cx="48" cy="66" rx="14" ry="5" fill="#FF8A65" opacity="0.7"/>
        {/* Curl indicator */}
        <path d="M60 58 Q64 52 62 48" fill="none" stroke="#FF8A65" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="62" cy="48" r="2.5" fill="#E64A19"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // 平舌音 dental sibilant — tongue tip at lower teeth (z c s)
  dental: {
    label: '平舌音', labelEn: 'Tongue tip flat/low',
    desc: '舌尖抵下齿', descEn: 'Tongue tip stays flat, near lower teeth',
    sounds: ['z','c','s'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        <path d="M32 50 Q46 44 60 46 Q74 44 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 50 Q46 56 60 54 Q74 56 88 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        {/* Lower teeth */}
        <rect x="44" y="52" width="5" height="4" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="51" y="52" width="5" height="4" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="58" y="52" width="5" height="4" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="65" y="52" width="5" height="4" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        {/* Tongue flat, tip at lower teeth */}
        <path d="M40 62 Q52 60 62 57 Q66 56 67 54" fill="#FF8A65" stroke="#E64A19" strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="50" cy="63" rx="14" ry="5" fill="#FF8A65" opacity="0.7"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // Vowels — rounded lips (o, u, ü)
  rounded: {
    label: '圆唇音', labelEn: 'Rounded lips',
    desc: '嘴唇圆拢', descEn: 'Round and pucker lips',
    sounds: ['o','u','ü','ou','iu'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        {/* Rounded small lip opening */}
        <circle cx="60" cy="50" r="8" fill="#E57373" opacity="0.3" stroke="#E57373" strokeWidth="1.5"/>
        <circle cx="60" cy="50" r="4" fill="#c0392b" opacity="0.4"/>
        <path d="M42 50 Q50 43 60 46 Q70 43 78 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M42 50 Q50 57 60 54 Q70 57 78 50" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },

  // Open vowels — wide open mouth (a)
  open: {
    label: '开口音', labelEn: 'Mouth wide open',
    desc: '嘴巴张大', descEn: 'Open mouth wide',
    sounds: ['a','ai','ao','an','ang'],
    svg: (
      <svg viewBox="0 0 120 90" style={{ width:'100%', height:'auto' }}>
        <ellipse cx="60" cy="45" rx="50" ry="40" fill="#FFF3E0" stroke="#FFCC80" strokeWidth="1.5"/>
        {/* Wide open mouth */}
        <path d="M32 48 Q46 42 60 44 Q74 42 88 48" fill="#FFCCBC" stroke="#E57373" strokeWidth="1.5"/>
        <path d="M32 48 Q46 64 60 66 Q74 64 88 48" fill="#c0392b" opacity="0.15" stroke="#E57373" strokeWidth="1.5"/>
        {/* Upper teeth */}
        <rect x="40" y="48" width="5" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="47" y="48" width="5" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="54" y="48" width="5" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="61" y="48" width="5" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        <rect x="68" y="48" width="5" height="6" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.8"/>
        {/* Tongue — flat and low */}
        <path d="M38 62 Q60 66 82 62" fill="#FF8A65" stroke="#E64A19" strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="60" cy="32" rx="8" ry="5" fill="#FFCC80" stroke="#FFB74D" strokeWidth="1"/>
      </svg>
    )
  },
};

// Map each sound to its mouth type
// Map mouth types to articulation diagram IDs
const MOUTH_TO_ART = {
  bilabial:    'art_bilabial',
  labiodental: 'art_labiodental',
  alveolar:    'art_alveolar',
  velar:       'art_velar',
  palatal:     'art_palatal',
  retroflex:   'art_retroflex',
  dental:      'art_dental',
  rounded:     'art_round_ou',
  open:        'art_open_a',
};

export function getMouthType(sound) {
  for (const [key, val] of Object.entries(MOUTH_TYPES)) {
    if (val.sounds.includes(sound)) return { key, ...val };
  }
  return null;
}

export default function MouthDiagram({ sound, lang='zh', pandaIcons={}, artDiagrams={} }) {
  const type = getMouthType(sound);
  if (!type) return null;

  // Prefer articulation diagram, then panda mouth, then SVG
  const artId    = MOUTH_TO_ART[type.key];
  const artUrl   = artId ? artDiagrams[artId] : null;
  const pandaId  = MOUTH_TO_PANDA[type.key];
  const pandaUrl = pandaId ? pandaIcons[pandaId] : null;
  const imageUrl = artUrl || pandaUrl;

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'10px',
      border:'1px solid #e0e0e0', textAlign:'center', maxWidth:220 }}>
      {imageUrl ? (
        <img src={imageUrl} alt={type.label}
          style={{ width:'100%', maxHeight:140, objectFit:'contain',
            display:'block', margin:'0 auto' }}/>
      ) : (
        <div style={{ width:120, margin:'0 auto' }}>{type.svg}</div>
      )}
      <div style={{ fontSize:12, fontWeight:500, color:'#1a0a05', marginTop:6 }}>
        {type.label}
      </div>
      <div style={{ fontSize:10, color:'#666', marginTop:2, lineHeight:1.5 }}>
        {lang==='zh' ? type.desc : type.descEn}
      </div>
      {!imageUrl && (
        <div style={{ fontSize:9, color:'#bbb', marginTop:4 }}>
          在口型图工作室生成后显示
        </div>
      )}
    </div>
  );
}
