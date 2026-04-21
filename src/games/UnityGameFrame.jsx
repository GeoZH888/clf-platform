// src/games/UnityGameFrame.jsx
// Embeds a Unity WebGL game in an iframe with bidirectional postMessage bridge.
//
// ── How it works ─────────────────────────────────────────────────────────────
// 1. Host your Unity WebGL build in /public/unity-games/{gameId}/index.html
// 2. React → Unity: iframe.contentWindow.postMessage({type:'INIT_CONTENT', data:{...}}, '*')
// 3. Unity → React: Application.ExternalEval("window.parent.postMessage(JSON.stringify({type:'SCORE',score:100}), '*')")
//
// In Unity, add this to a jslib file:
//   mergeInto(LibraryManager.library, {
//     PostToReact: function(jsonStr) {
//       window.parent.postMessage(JSON.parse(Pointer_stringify(jsonStr)), '*');
//     }
//   });
// Then call PostToReact("{\"type\":\"SCORE\",\"score\":100}") from C#
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

export default function UnityGameFrame({
  gameId,           // e.g. 'stroke-order' — matches /public/unity-games/{gameId}/
  gameUrl,          // optional override URL (for externally hosted games)
  title = 'Game',
  initContent,      // optional {words:[], characters:[]} sent to Unity on load
  onScore,          // callback (score, data) => void
  onBack,
  lang = 'zh',
}) {
  const iframeRef   = useRef(null);
  const [loaded,    setLoaded]    = useState(false);
  const [score,     setScore]     = useState(null);
  const [progress,  setProgress]  = useState(0); // Unity loading 0-100
  const [msg,       setMsg]       = useState('');
  const t = (zh, en) => lang === 'zh' ? zh : en;

  const url = gameUrl || `/unity-games/${gameId}/index.html`;

  // ── Listen for messages FROM Unity ──────────────────────────────────────────
  useEffect(() => {
    function handleMessage(e) {
      // Accept from same origin or the game URL
      let data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data?.type) return;

      switch (data.type) {
        case 'UNITY_LOADED':
          setLoaded(true);
          setProgress(100);
          // Send vocabulary/content to Unity once it signals ready
          if (initContent) {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'INIT_CONTENT',
              lang,
              ...initContent,
            }, '*');
          }
          break;

        case 'UNITY_PROGRESS':
          setProgress(Math.round((data.progress || 0) * 100));
          break;

        case 'SCORE':
        case 'GAME_OVER': {
          const pts = data.score || 0;
          setScore(pts);
          setMsg(data.message || '');
          // Save to jgw_points
          const token = localStorage.getItem(TOKEN_KEY);
          if (token && pts > 0) {
            supabase.from('jgw_points').insert({
              device_token: token,
              module:  'games',
              action:  `unity_${gameId}`,
              points:  pts,
            }).then(() => {});
          }
          onScore?.(pts, data);
          break;
        }

        case 'LEVEL_UP':
          setMsg(`🎉 ${t('升级了！','Level up!')} ${data.level}`);
          break;

        case 'REQUEST_WORDS':
          // Unity asking for more vocabulary
          iframeRef.current?.contentWindow?.postMessage({
            type: 'WORD_BATCH',
            words: initContent?.words || [],
          }, '*');
          break;

        default:
          console.log('[Unity→React]', data);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [gameId, initContent, lang, onScore]);

  // ── Send message TO Unity ────────────────────────────────────────────────────
  function sendToUnity(msg) {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }

  return (
    <div style={{ position:'relative', width:'100%', height:'100dvh',
      background:'#000', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
        background:'#1a0a05', zIndex:10, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'#fdf6e3', flex:1 }}>{title}</div>
        {score !== null && (
          <div style={{ fontSize:13, color:'#F57F17', fontWeight:700 }}>⭐ {score}</div>
        )}
      </div>

      {/* Loading overlay */}
      {!loaded && (
        <div style={{ position:'absolute', inset:0, top:44, background:'#1a0a05',
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:16, zIndex:5 }}>
          <div style={{ fontSize:48 }}>🎮</div>
          <div style={{ fontSize:14, color:'#fdf6e3' }}>{t('加载游戏…','Loading game…')}</div>
          <div style={{ width:200, height:6, background:'#333', borderRadius:3 }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#F57F17',
              borderRadius:3, transition:'width 0.3s' }}/>
          </div>
          <div style={{ fontSize:12, color:'#a07850' }}>{progress}%</div>
        </div>
      )}

      {/* Feedback message */}
      {msg && (
        <div style={{ position:'absolute', top:54, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.8)', color:'#fdf6e3', padding:'8px 16px',
          borderRadius:20, fontSize:13, fontWeight:600, zIndex:20,
          pointerEvents:'none', whiteSpace:'nowrap' }}>
          {msg}
        </div>
      )}

      {/* Unity iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        title={title}
        allow="fullscreen; microphone"
        style={{ flex:1, border:'none', width:'100%',
          opacity: loaded ? 1 : 0, transition:'opacity 0.3s' }}
        onLoad={() => {
          // Fallback: if Unity doesn't post UNITY_LOADED, mark as loaded after 5s
          setTimeout(() => setLoaded(true), 5000);
        }}
      />
    </div>
  );
}
