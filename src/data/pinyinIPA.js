// src/data/pinyinIPA.js
// Complete IPA data for all Mandarin Chinese initials and finals
// Sources: ISO 7098, Duanmu (2007), Wikipedia Mandarin phonology

export const INITIAL_IPA = {
  b:  { ipa:'p',    ssml:'p',       desc:'不送气双唇塞音', en:'unaspirated p, like spy' },
  p:  { ipa:'pʰ',   ssml:'pʰ',      desc:'送气双唇塞音',   en:'aspirated p, like pie' },
  m:  { ipa:'m',    ssml:'m',       desc:'双唇鼻音',       en:'bilabial nasal, like man' },
  f:  { ipa:'f',    ssml:'f',       desc:'唇齿擦音',       en:'labiodental fricative, like fan' },
  d:  { ipa:'t',    ssml:'t',       desc:'不送气舌尖塞音', en:'unaspirated t, like sty' },
  t:  { ipa:'tʰ',   ssml:'tʰ',      desc:'送气舌尖塞音',   en:'aspirated t, like tie' },
  n:  { ipa:'n',    ssml:'n',       desc:'舌尖鼻音',       en:'alveolar nasal, like now' },
  l:  { ipa:'l',    ssml:'l',       desc:'舌尖侧音',       en:'lateral approximant, like lay' },
  g:  { ipa:'k',    ssml:'k',       desc:'不送气舌根塞音', en:'unaspirated k, like sky' },
  k:  { ipa:'kʰ',   ssml:'kʰ',      desc:'送气舌根塞音',   en:'aspirated k, like kite' },
  h:  { ipa:'x',    ssml:'x',       desc:'舌根擦音',       en:'velar fricative, like Bach' },
  j:  { ipa:'t͡ɕ',   ssml:'tɕ',      desc:'不送气龈腭塞擦音', en:'palatal affricate, like jeep' },
  q:  { ipa:'t͡ɕʰ',  ssml:'tɕʰ',     desc:'送气龈腭塞擦音', en:'aspirated palatal affricate' },
  x:  { ipa:'ɕ',    ssml:'ɕ',       desc:'龈腭擦音',       en:'palatal fricative, like she (fronted)' },
  zh: { ipa:'ʈ͡ʂ',   ssml:'ʈʂ',      desc:'不送气卷舌塞擦音', en:'retroflex affricate, like church' },
  ch: { ipa:'ʈ͡ʂʰ',  ssml:'ʈʂʰ',     desc:'送气卷舌塞擦音', en:'aspirated retroflex affricate' },
  sh: { ipa:'ʂ',    ssml:'ʂ',       desc:'卷舌擦音',       en:'retroflex fricative, like shore' },
  r:  { ipa:'ɻ',    ssml:'ɻ',       desc:'卷舌近音',       en:'retroflex approximant, like run' },
  z:  { ipa:'t͡s',   ssml:'ts',      desc:'不送气舌尖塞擦音', en:'unaspirated ts, like cats' },
  c:  { ipa:'t͡sʰ',  ssml:'tsʰ',     desc:'送气舌尖塞擦音', en:'aspirated ts' },
  s:  { ipa:'s',    ssml:'s',       desc:'舌尖擦音',       en:'alveolar fricative, like sun' },
  y:  { ipa:'j',    ssml:'j',       desc:'硬腭近音',       en:'palatal glide, like yes' },
  w:  { ipa:'w',    ssml:'w',       desc:'唇软腭近音',     en:'labiovelar glide, like wet' },
};

export const FINAL_IPA = {
  // Single finals
  a:   { ipa:'a',    ssml:'a',    desc:'低元音',         en:'open central vowel, like father' },
  o:   { ipa:'o',    ssml:'o',    desc:'中后圆唇元音',   en:'back mid rounded, like more' },
  e:   { ipa:'ɤ',    ssml:'ɤ',    desc:'中后非圆唇元音', en:'back mid unrounded' },
  i:   { ipa:'i',    ssml:'i',    desc:'前高元音',       en:'high front vowel, like see' },
  u:   { ipa:'u',    ssml:'u',    desc:'后高圆唇元音',   en:'high back rounded, like too' },
  ü:   { ipa:'y',    ssml:'y',    desc:'前高圆唇元音',   en:'high front rounded, like French tu' },
  // Compound finals
  ai:  { ipa:'aɪ̯',   ssml:'aɪ',   desc:'前低二合元音',   en:'diphthong, like eye' },
  ei:  { ipa:'eɪ̯',   ssml:'eɪ',   desc:'前中二合元音',   en:'diphthong, like way' },
  ui:  { ipa:'weɪ̯',  ssml:'weɪ',  desc:'圆唇二合元音',   en:'diphthong, like way (rounded onset)' },
  ao:  { ipa:'ɑʊ̯',   ssml:'ɑʊ',   desc:'后低二合元音',   en:'diphthong, like cow' },
  ou:  { ipa:'oʊ̯',   ssml:'oʊ',   desc:'后中二合元音',   en:'diphthong, like go' },
  iu:  { ipa:'joʊ̯',  ssml:'joʊ',  desc:'腭化二合元音',   en:'diphthong' },
  ie:  { ipa:'jɛ',   ssml:'jɛ',   desc:'腭化前中元音',   en:'palatal + mid front vowel' },
  üe:  { ipa:'ɥɛ',   ssml:'ɥɛ',   desc:'圆唇腭化元音',   en:'rounded palatal + mid front' },
  er:  { ipa:'ɑɻ',   ssml:'ɑɻ',   desc:'儿化低元音',     en:'rhotacized low vowel, like are' },
  // Nasal finals
  an:  { ipa:'an',   ssml:'an',   desc:'前鼻低元音',     en:'low vowel + alveolar nasal' },
  en:  { ipa:'ən',   ssml:'ən',   desc:'前鼻中元音',     en:'schwa + alveolar nasal' },
  in:  { ipa:'in',   ssml:'in',   desc:'前鼻高元音',     en:'high front + alveolar nasal' },
  un:  { ipa:'wən',  ssml:'wən',  desc:'圆唇前鼻元音',   en:'rounded + schwa + nasal' },
  ün:  { ipa:'yn',   ssml:'yn',   desc:'圆唇腭化前鼻',   en:'rounded front + alveolar nasal' },
  ang: { ipa:'ɑŋ',   ssml:'ɑŋ',   desc:'后鼻低元音',     en:'low vowel + velar nasal' },
  eng: { ipa:'əŋ',   ssml:'əŋ',   desc:'后鼻中元音',     en:'schwa + velar nasal' },
  ing: { ipa:'iŋ',   ssml:'iŋ',   desc:'后鼻高元音',     en:'high front + velar nasal' },
  ong: { ipa:'ʊŋ',   ssml:'ʊŋ',   desc:'后鼻圆唇元音',   en:'near-high back rounded + velar nasal' },
};
