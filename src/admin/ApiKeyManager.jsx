// src/admin/ApiKeyManager.jsx
// Admin panel for managing API keys — stored in Netlify env vars via UI
// Keys are stored in localStorage for admin session (never sent to users)

import { useState, useEffect } from 'react';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    icon: '🤖',
    url: 'https://console.anthropic.com/keys',
    placeholder: 'sk-ant-...',
    supports: ['text', 'image-description'],
    color: '#E65100',
  },
  {
    id: 'openai',
    name: 'OpenAI (DALL-E + GPT)',
    icon: '⚡',
    url: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    supports: ['text', 'image-generation'],
    color: '#1565C0',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek (Text only)',
    icon: '🔍',
    url: 'https://platform.deepseek.com/api_keys',
    placeholder: 'sk-...',
    supports: ['text'],
    color: '#6A1B9A',
  },
  {
    id: 'stability',
    name: 'Stability AI (Images)',
    icon: '🎨',
    url: 'https://platform.stability.ai/account/keys',
    placeholder: 'sk-...',
    supports: ['image-generation'],
    color: '#2E7D32',
  },
  {
    id: 'ideogram',
    name: 'Ideogram (Images)',
    icon: '🖼️',
    url: 'https://ideogram.ai/manage-api',
    placeholder: 'ideogram-...',
    supports: ['image-generation'],
    color: '#C62828',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    url: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
    supports: ['text'],
    color: '#0277BD',
  },
  {
    id: 'voyage',
    name: 'Voyage AI (Embeddings)',
    icon: '🧭',
    url: 'https://dash.voyageai.com/api-keys',
    placeholder: 'pa-...',
    supports: ['embedding'],
    color: '#5D4037',
  },
];

export default function ApiKeyManager() {
  const [keys,    setKeys]    = useState({});
  const [saved,   setSaved]   = useState({});
  const [visible, setVisible] = useState({});
  const [status,  setStatus]  = useState('');

  useEffect(() => {
    const stored = {};
    PROVIDERS.forEach(p => {
      const k = localStorage.getItem(`admin_key_${p.id}`);
      if (k) stored[p.id] = k;
    });
    setKeys(stored);
    setSaved({ ...stored });
  }, []);

  function save(providerId) {
    const val = keys[providerId] || '';
    if (val.trim()) {
      localStorage.setItem(`admin_key_${providerId}`, val.trim());
    } else {
      localStorage.removeItem(`admin_key_${providerId}`);
    }
    setSaved(s => ({ ...s, [providerId]: val.trim() }));
    setStatus(`✅ ${PROVIDERS.find(p=>p.id===providerId)?.name} key saved.`);
    setTimeout(() => setStatus(''), 2000);
  }

  function getKeyForGateway(providerId) {
    return localStorage.getItem(`admin_key_${providerId}`) || '';
  }

  // Export for use by other components
  window._getAdminKey = getKeyForGateway;

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:6 }}>
        🔑 API Keys
      </div>
      <div style={{ fontSize:12, color:V.text3, marginBottom:16, lineHeight:1.6 }}>
        Keys are stored locally in your browser — never sent to students.
        These override the Netlify environment variables for admin use.
      </div>

      {status && (
        <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:12,
          background:'#E8F5E9', color:V.green, fontSize:13 }}>
          {status}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {PROVIDERS.map(p => {
          const val    = keys[p.id] || '';
          const isSaved = saved[p.id] === val && val.length > 0;
          const isVis  = visible[p.id];

          return (
            <div key={p.id} style={{ background:V.card, border:`1px solid ${V.border}`,
              borderRadius:12, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:18 }}>{p.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:V.text }}>
                    {p.name}
                  </div>
                  <div style={{ display:'flex', gap:4, marginTop:2, flexWrap:'wrap' }}>
                    {p.supports.map(s => (
                      <span key={s} style={{ fontSize:10, padding:'1px 6px',
                        borderRadius:10, background:p.color+'22', color:p.color }}>
                        {s === 'text' ? '✍️ Text'
                          : s === 'image-generation' ? '🎨 Images'
                          : s === 'image-description' ? '📝 image-description'
                          : s === 'embedding' ? '🧭 Embeddings'
                          : '📝 '+s}
                      </span>
                    ))}
                  </div>
                </div>
                <a href={p.url} target="_blank" rel="noreferrer"
                  style={{ fontSize:11, color:'#1565C0', textDecoration:'none' }}>
                  Get key ↗
                </a>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1, position:'relative' }}>
                  <input
                    type={isVis ? 'text' : 'password'}
                    value={val}
                    onChange={e => setKeys(k => ({ ...k, [p.id]: e.target.value }))}
                    placeholder={p.placeholder}
                    style={{ width:'100%', padding:'8px 36px 8px 10px',
                      fontSize:12, borderRadius:8, boxSizing:'border-box',
                      border:`1.5px solid ${isSaved ? V.green : V.border}`,
                      background: isSaved ? '#F1F8E9' : '#fff',
                      fontFamily:'monospace' }}/>
                  <span
                    onClick={() => setVisible(v => ({ ...v, [p.id]: !v[p.id] }))}
                    style={{ position:'absolute', right:8, top:'50%',
                      transform:'translateY(-50%)', cursor:'pointer',
                      fontSize:14, color:V.text3 }}>
                    {isVis ? '🙈' : '👁'}
                  </span>
                </div>
                <button onClick={() => save(p.id)}
                  style={{ padding:'8px 16px', borderRadius:8, cursor:'pointer',
                    border:'none', fontSize:12, fontWeight:500,
                    background: isSaved ? V.green : V.verm,
                    color:'#fff' }}>
                  {isSaved ? '✓' : 'Save'}
                </button>
                {val && (
                  <button onClick={() => {
                    setKeys(k => ({ ...k, [p.id]: '' }));
                    localStorage.removeItem(`admin_key_${p.id}`);
                    setSaved(s => ({ ...s, [p.id]: '' }));
                  }} style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer',
                    border:`1px solid ${V.border}`, background:'#fff',
                    fontSize:12, color:'#c0392b' }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:16, padding:'12px 14px', background:'#FFF8E1',
        borderRadius:10, border:'1px solid #FFE082', fontSize:12,
        color:'#795548', lineHeight:1.7 }}>
        💡 <strong>Image generation:</strong> OpenAI (DALL-E 3) and Stability AI both work well.
        Ideogram is best for text-in-image.<br/>
        💡 <strong>Text generation:</strong> Claude is best quality. DeepSeek is faster/cheaper.<br/>
        💡 Keys here are only used in admin — students never see them.
      </div>
    </div>
  );
}
