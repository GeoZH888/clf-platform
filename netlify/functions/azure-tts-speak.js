// netlify/functions/azure-tts-speak.js
// Server-side Azure TTS using SSML <phoneme alphabet="ipa"> tags.
// This produces the EXACT phonetic sound of each initial/final,
// completely bypassing Chinese character pronunciation ambiguity.
//
// POST body: { text, phonemeIpa, rate }
// Response:  { audioBase64, visemes, durationMs }

const VOICE = 'zh-CN-XiaoxiaoNeural';

// ── IPA → SSML phoneme string ─────────────────────────────────────────────────
// Azure TTS uses 'ipa' alphabet in <phoneme> tags.
// For initials we append a short neutral vowel so the consonant is audible.
const IPA_SSML = {
  // Initials — consonant + minimal vowel for audibility
  b:'pə', p:'pʰə', m:'mə', f:'fə',
  d:'tə', t:'tʰə', n:'nə', l:'lə',
  g:'kə', k:'kʰə', h:'xə',
  j:'tɕi', q:'tɕʰi', x:'ɕi',
  zh:'ʈʂɨ', ch:'ʈʂʰɨ', sh:'ʂɨ', r:'ɻɨ',
  z:'tsɨ', c:'tsʰɨ', s:'sɨ',
  y:'ji', w:'wu',
  // Finals — standalone vowel sounds
  a:'a', o:'o', e:'ɤ', i:'i', u:'u', ü:'y',
  ai:'aɪ', ei:'eɪ', ui:'weɪ', ao:'ɑʊ', ou:'oʊ', iu:'joʊ',
  ie:'jɛ', üe:'ɥɛ', er:'ɑɻ',
  an:'an', en:'ən', in:'in', un:'wən', ün:'yn',
  ang:'ɑŋ', eng:'əŋ', ing:'iŋ', ong:'ʊŋ',
};

// ── Viseme sequences per phoneme ──────────────────────────────────────────────
const PHONEME_VISEMES = {
  b:[0,2,2,1,0],    p:[0,2,2,1,0],    m:[0,2,12,12,0],  f:[0,6,6,13,0],
  d:[0,3,3,15,0],   t:[0,3,3,15,0],   n:[0,3,3,12,0],   l:[0,3,3,12,0],
  g:[0,9,9,15,0],   k:[0,9,9,15,0],   h:[0,9,9,12,0],
  j:[0,5,5,15,0],   q:[0,5,5,15,0],   x:[0,5,5,15,0],
  zh:[0,4,4,4,15,0],ch:[0,4,4,4,15,0],sh:[0,4,4,12,0],  r:[0,4,4,12,0],
  z:[0,7,7,15,0],   c:[0,7,7,15,0],   s:[0,7,7,12,0],
  y:[0,10,15,15,0], w:[0,11,11,13,0],
  a:[0,16,16,1,1,0],o:[0,13,13,13,0], e:[0,1,1,1,0],
  i:[0,15,15,15,0], u:[0,11,11,11,0], ü:[0,10,15,15,0],
  ai:[0,16,16,18,18,0],ei:[0,15,15,18,18,0],ui:[0,11,11,15,15,0],
  ao:[0,16,16,19,19,0],ou:[0,13,13,17,17,0],iu:[0,11,11,15,15,0],
  ie:[0,15,15,1,1,0],üe:[0,10,10,15,15,0], er:[0,1,1,4,4,0],
  an:[0,16,16,3,3,0], en:[0,1,1,3,3,0],  in:[0,15,15,3,3,0],
  un:[0,11,11,3,3,0], ün:[0,10,10,3,3,0],
  ang:[0,16,16,9,9,0],eng:[0,1,1,9,9,0],ing:[0,15,15,9,9,0],ong:[0,11,11,9,9,0],
};

// ── Fallback: char→phoneme for example word button ───────────────────────────
const CHAR_PHONEME = {
  '波':'b','坡':'p','摸':'m','佛':'f','得':'d','特':'t','讷':'n','勒':'l',
  '哥':'g','科':'k','喝':'h','鸡':'j','期':'q','希':'x',
  '知':'zh','吃':'ch','师':'sh','日':'r','资':'z','次':'c','思':'s',
  '一':'i','五':'u','啊':'a','哦':'o','鹅':'e','乌':'u','鱼':'ü',
  '爱':'ai','诶':'ei','位':'ui','奥':'ao','欧':'ou','牛':'iu',
  '叶':'ie','月':'üe','耳':'er',
  '安':'an','恩':'en','音':'in','云':'un','晕':'ün',
  '昂':'ang','灯':'eng','鹰':'ing','红':'ong',
  '爸':'b','爬':'p','妈':'m','飞':'f','大':'d','他':'t','你':'n','来':'l',
  '个':'g','看':'k','好':'h','家':'j','去':'q','小':'x',
  '这':'zh','是':'sh','热':'r','在':'z','草':'c','三':'s','我':'w',
  '衣':'i','喔':'o','二':'er','嗯':'eng','灯':'eng',
};

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors, body:'' };
  if (event.httpMethod !== 'POST')   return { statusCode:405, headers:cors, body:'Method not allowed' };

  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'eastasia';
  if (!key) return { statusCode:500, headers:cors,
    body: JSON.stringify({ error:'AZURE_SPEECH_KEY not set' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode:400, headers:cors, body: JSON.stringify({ error:'Invalid JSON' }) }; }

  const { text='', phonemeKey='', rate='0.75' } = body;
  if (!text && !phonemeKey) return { statusCode:400, headers:cors,
    body: JSON.stringify({ error:'text or phonemeKey required' }) };

  // ── Build SSML ──────────────────────────────────────────────────────────────
  // If phonemeKey is provided (e.g. 'd'), use IPA phoneme tag for exact sound.
  // If only text is provided (example word), speak the character directly.
  let ssml;
  const ipaStr = phonemeKey ? IPA_SSML[phonemeKey] : null;

  if (ipaStr) {
    // Exact IPA pronunciation — no character ambiguity
    ssml = `<speak version="1.0"
      xmlns="http://www.w3.org/2001/10/synthesis"
      xmlns:mstts="http://www.w3.org/2001/mstts"
      xml:lang="zh-CN">
      <voice name="${VOICE}">
        <prosody rate="${rate}">
          <phoneme alphabet="ipa" ph="${ipaStr}">x</phoneme>
        </prosody>
      </voice>
    </speak>`;
  } else {
    // Example word — speak character directly at slightly faster rate
    ssml = `<speak version="1.0"
      xmlns="http://www.w3.org/2001/10/synthesis"
      xml:lang="zh-CN">
      <voice name="${VOICE}">
        <prosody rate="0.85">${text}</prosody>
      </voice>
    </speak>`;
  }

  try {
    const res = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          'User-Agent': 'miaohong-learner',
        },
        body: ssml,
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode:res.status, headers:cors,
        body: JSON.stringify({ error:errText }) };
    }

    const audioBuffer = await res.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const durationMs  = Math.max(600, Math.round((audioBuffer.byteLength / 4000) * 1000));

    // Viseme sequence — use phonemeKey if available, else derive from char
    const pKey = phonemeKey || CHAR_PHONEME[text] || null;
    const visemeIds = pKey ? (PHONEME_VISEMES[pKey] || [0,1,0]) : [0,1,0];
    const activeMs  = durationMs * 0.9;
    const step      = visemeIds.length > 1 ? activeMs / (visemeIds.length - 1) : activeMs;
    const visemes   = visemeIds.map((id, i) => ({ id, offsetMs: Math.round(i * step) }));

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, visemes, durationMs }),
    };

  } catch (err) {
    return { statusCode:500, headers:cors,
      body: JSON.stringify({ error: err.message }) };
  }
};
