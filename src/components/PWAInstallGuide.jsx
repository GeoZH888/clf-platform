// src/components/PWAInstallGuide.jsx
// Shows PWA install instructions after first successful scan

import { useState, useEffect } from 'react';

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/MicroMessenger|WeChat/i.test(ua)) return 'wechat';
  if (/iPhone|iPad/i.test(ua)) return 'ios';
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) return 'android-chrome';
  return 'other';
}

export default function PWAInstallGuide({ onDismiss }) {
  const browser = detectBrowser();
  const [step, setStep] = useState(0);

  const guides = {
    wechat: {
      title: '添加到主屏幕',
      subtitle: 'Add to Home Screen',
      steps: [
        { icon: '···', text: '点击右上角 ··· 按钮', en: 'Tap ··· in top-right corner' },
        { icon: '📲', text: '选择"添加到桌面"', en: 'Select "Add to Home Screen"' },
        { icon: '✅', text: '点击"添加"确认', en: 'Tap "Add" to confirm' },
      ],
      note: '添加后直接从桌面打开，无需再扫码',
    },
    ios: {
      title: '添加到主屏幕',
      subtitle: 'Add to Home Screen (iPhone/iPad)',
      steps: [
        { icon: '🔗', text: '用 Safari 打开此页面', en: 'Open this page in Safari' },
        { icon: '⬆️', text: '点击底部分享按钮', en: 'Tap the Share button at bottom' },
        { icon: '➕', text: '选择"添加到主屏幕"', en: 'Tap "Add to Home Screen"' },
        { icon: '✅', text: '点击"添加"确认', en: 'Tap "Add" to confirm' },
      ],
      note: '只在 Safari 中才能安装到桌面',
    },
    'android-chrome': {
      title: '安装应用',
      subtitle: 'Install App (Android Chrome)',
      steps: [
        { icon: '⋮', text: '点击右上角菜单', en: 'Tap ⋮ menu in top-right' },
        { icon: '📲', text: '选择"添加到主屏幕"', en: 'Select "Add to Home Screen"' },
        { icon: '✅', text: '点击"安装"确认', en: 'Tap "Install" to confirm' },
      ],
      note: '安装后可离线使用',
    },
    other: {
      title: '添加到桌面',
      subtitle: 'Add to Home Screen',
      steps: [
        { icon: '⋮', text: '点击浏览器菜单', en: 'Tap browser menu' },
        { icon: '📲', text: '选择"添加到主屏幕"', en: 'Select "Add to Home Screen"' },
      ],
      note: '建议使用 Chrome 或 Safari',
    },
  };

  const guide = guides[browser];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
      zIndex:999, padding:'0' }}
      onClick={onDismiss}>

      <div style={{ background:'#fdf6e3', width:'100%', maxWidth:480,
        borderRadius:'20px 20px 0 0', padding:'24px 20px 40px',
        fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}
        onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div style={{ width:40, height:4, background:'#ddd', borderRadius:2,
          margin:'0 auto 20px' }}/>

        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:32, marginBottom:6 }}>📲</div>
          <div style={{ fontSize:20, fontWeight:500, color:'#1a0a05' }}>
            {guide.title}
          </div>
          <div style={{ fontSize:12, color:'#a07850', marginTop:4 }}>
            {guide.subtitle}
          </div>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          {guide.steps.map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'10px 14px', borderRadius:12,
              background: step === i ? '#8B4513' : '#f5ede0',
              cursor:'pointer', transition:'all 0.2s' }}
              onClick={() => setStep(i)}>
              <div style={{ fontSize:20, minWidth:32, textAlign:'center' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:14, color: step===i ? '#fdf6e3' : '#1a0a05' }}>
                  {i+1}. {s.text}
                </div>
                <div style={{ fontSize:11, color: step===i ? '#f5c4a0' : '#a07850', marginTop:2 }}>
                  {s.en}
                </div>
              </div>
            </div>
          ))}
        </div>

        {guide.note && (
          <div style={{ fontSize:11, color:'#a07850', textAlign:'center',
            padding:'8px 12px', background:'#f0e8d8', borderRadius:10, marginBottom:16 }}>
            💡 {guide.note}
          </div>
        )}

        {/* URL to copy for WeChat */}
        {browser === 'wechat' && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'#a07850', marginBottom:6, textAlign:'center' }}>
              或复制链接在浏览器打开:
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, padding:'8px 12px', background:'#fff',
                borderRadius:8, border:'1px solid #e8d5b0', fontSize:12,
                color:'#1a0a05', wordBreak:'break-all' }}>
                {window.location.origin}
              </div>
              <button onClick={() => navigator.clipboard?.writeText(window.location.origin)}
                style={{ padding:'8px 14px', borderRadius:8, border:'none',
                  background:'#8B4513', color:'#fdf6e3', fontSize:12, cursor:'pointer' }}>
                复制
              </button>
            </div>
          </div>
        )}

        <button onClick={onDismiss}
          style={{ width:'100%', padding:'12px', borderRadius:12, border:'none',
            background:'#1a0a05', color:'#fdf6e3', fontSize:14, cursor:'pointer',
            fontFamily:'inherit' }}>
          知道了 · Got it
        </button>
      </div>
    </div>
  );
}
