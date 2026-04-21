/**
 * src/components/CustomCharInput.jsx
 * Let user type any Chinese character and practice tracing it.
 * If not in DB, saves it automatically.
 */
import { useState } from 'react';
import { useCustomCharacter } from '../hooks/useJiaguwen.js';

export default function CustomCharInput({ onSelect }) {
  const [input, setInput]   = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaning, setMeaning] = useState('');
  const [step, setStep]     = useState(1); // 1=enter char, 2=add details
  const { saveCustom, saving, saved } = useCustomCharacter();

  const handleChar = (e) => {
    // Only accept single Chinese character
    const val = e.target.value;
    const last = val[val.length - 1];
    if (last && /[\u4e00-\u9fff]/.test(last)) setInput(last);
  };

  const handleGo = async () => {
    if (!input) return;
    const result = await saveCustom(input, pinyin, meaning);
    onSelect({
      c: input,
      glyph_modern: input,
      p: pinyin,
      pinyin,
      m: meaning || input,
      meaning_en: meaning || input,
      isCustom: true,
      isNew: result === 'created',
    });
    setInput(''); setPinyin(''); setMeaning(''); setStep(1);
  };

  return (
    <div style={{
      width:'100%', maxWidth:320, margin:'0 auto',
      background:'var(--color-background-primary)',
      border:'0.5px solid var(--color-border-tertiary)',
      borderRadius:12, padding:'12px 14px',
    }}>
      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', letterSpacing:'0.06em', marginBottom:10 }}>
        自定义练习 · Practice any character
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom: step===2 ? 10 : 0 }}>
        <input
          type="text"
          value={input}
          onChange={handleChar}
          placeholder="输入一个汉字"
          maxLength={2}
          style={{
            flex:1, fontSize:28, textAlign:'center', padding:'8px',
            fontFamily:"'STKaiti','KaiTi',serif",
            borderRadius:8,
          }}
        />
        {input && step === 1 && (
          <button
            onClick={() => setStep(2)}
            style={{
              padding:'8px 14px', fontSize:13, cursor:'pointer',
              border:'0.5px solid var(--color-border-secondary)',
              borderRadius:8, background:'var(--color-background-secondary)',
              color:'var(--color-text-primary)', fontFamily:'var(--font-sans)',
            }}
          >
            下一步 →
          </button>
        )}
      </div>

      {step === 2 && input && (
        <>
          <input
            type="text"
            value={pinyin}
            onChange={e => setPinyin(e.target.value)}
            placeholder="拼音 Pinyin (e.g. hàn)"
            style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8, marginBottom:8 }}
          />
          <input
            type="text"
            value={meaning}
            onChange={e => setMeaning(e.target.value)}
            placeholder="含义 Meaning (optional)"
            style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8, marginBottom:10 }}
          />
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex:1, padding:'8px', fontSize:13, cursor:'pointer',
                border:'0.5px solid var(--color-border-secondary)',
                borderRadius:8, background:'var(--color-background-secondary)',
                color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)',
              }}
            >
              ← 返回
            </button>
            <button
              onClick={handleGo}
              disabled={saving}
              style={{
                flex:2, padding:'8px', fontSize:13, cursor:'pointer',
                border:'none', borderRadius:8,
                background:'#8B4513', color:'#fdf6e3',
                fontFamily:'var(--font-sans)', fontWeight:500,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '保存中…' : `开始练习 ${input}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
