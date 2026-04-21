// src/components/PWAInstallCard.jsx
// Prominent install card shown on first visit after QR scan
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);
const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent);

export default function PWAInstallCard({ lang = 'zh' }) {
  const [show,      setShow]      = useState(false);
  const [prompt,    setPrompt]    = useState(null);
  const [step,      setStep]      = useState('main'); // main | ios | wechat
  const [pandaUrl,  setPandaUrl]  = useState(null);

  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem('install_dismissed')) return;

    // Load RANDOM panda from Supabase
    supabase.from('jgw_panda_assets').select('image_url')
      .then(({ data }) => {
        if (data?.length) {
          const pick = data[Math.floor(Math.random() * data.length)];
          if (pick?.image_url) setPandaUrl(pick.image_url);
        }
      });

    const handler = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    const timer = setTimeout(() => setShow(true), 2000);
    return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  function dismiss() {
    sessionStorage.setItem('install_dismissed', '1');
    setShow(false);
  }

  async function install() {
    if (prompt) {
      // Android Chrome — native install
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setShow(false);
      setPrompt(null);
    } else if (isWeChat()) {
      setStep('wechat');
    } else if (isIOS()) {
      setStep('ios');
    } else {
      // Desktop or other — show manual instructions
      setStep('ios');
    }
  }

  if (!show) return null;

  const V = { verm:'#8B4513', bg:'#fdf6e3', border:'#e8d5b0', text:'#1a0a05', text3:'#a07850' };

  // WeChat — must open in external browser first (WeChat limitation)
  if (step === 'wechat') return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
      zIndex:9999, display:'flex', alignItems:'flex-end' }}
      onClick={dismiss}>
      <div style={{ width:'100%', background:'#fff', borderRadius:'20px 20px 0 0',
        padding:'24px 20px 44px' }} onClick={e=>e.stopPropagation()}>

        {/* Arrow pointing to top-right ··· button */}
        <div style={{ position:'absolute', top:16, right:20, textAlign:'center' }}>
          <div style={{ fontSize:28 }}>☝️</div>
          <div style={{ fontSize:11, color:'#666', marginTop:2 }}>点这里</div>
        </div>

        <div style={{ fontSize:17, fontWeight:600, color:'#1a0a05', marginBottom:16 }}>
          在浏览器中安装
        </div>
        <div style={{ background:'#f5f5f5', borderRadius:12, padding:'14px 16px',
          fontSize:14, color:'#333', lineHeight:2.4 }}>
          <div>1️⃣ 点右上角 <strong style={{color:'#8B4513'}}>···</strong></div>
          <div>2️⃣ 选 <strong style={{color:'#8B4513'}}>在浏览器中打开</strong></div>
          <div>3️⃣ 点 <strong style={{color:'#8B4513'}}>📲 安装</strong> 即可</div>
        </div>
        <button onClick={dismiss}
          style={{ width:'100%', marginTop:16, padding:14, borderRadius:12,
            border:'none', background:'#eee', fontSize:14, cursor:'pointer', color:'#333' }}>
          好的
        </button>
      </div>
    </div>
  );

  // iOS Safari instructions
  if (step === 'ios') return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
      zIndex:9999, display:'flex', alignItems:'flex-end' }}
      onClick={dismiss}>
      <div style={{ width:'100%', background:'#fff', borderRadius:'20px 20px 0 0',
        padding:'24px 20px 40px' }} onClick={e=>e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:500, color:V.text }}>
            {isIOS() ? '添加到 iPhone 主屏幕' : t('安装应用','Install App','Installa App')}
          </div>
        </div>
        <div style={{ background:'#f5f5f5', borderRadius:12, padding:14,
          fontSize:13, color:'#333', lineHeight:2.2 }}>
          {isIOS() ? <>
            <div>1️⃣ 点击底部 <strong>分享按钮</strong> 📤</div>
            <div>2️⃣ 滚动找到 <strong>「添加到主屏幕」</strong></div>
            <div>3️⃣ 点击右上角 <strong>「添加」</strong></div>
            <div>4️⃣ 桌面出现 🐼 大卫学中文 图标</div>
          </> : <>
            <div>1️⃣ {t('点击浏览器菜单','Click browser menu','Menu browser')}</div>
            <div>2️⃣ {t('选择「安装应用」','Select "Install app"','Seleziona "Installa"')}</div>
            <div>3️⃣ {t('点击「安装」确认','Tap "Install" to confirm','Tocca "Installa"')}</div>
          </>}
        </div>
        {/* Arrow pointing to share button on iOS */}
        {isIOS() && (
          <div style={{ position:'absolute', bottom:150, left:'50%',
            transform:'translateX(-50%)', textAlign:'center' }}>
            <div style={{ fontSize:32, animation:'bounce 1s infinite' }}>👇</div>
            <div style={{ fontSize:11, color:'#666', marginTop:4 }}>分享按钮在这里</div>
          </div>
        )}
        <button onClick={dismiss} style={{ width:'100%', marginTop:16, padding:14,
          borderRadius:12, border:'none', background:'#eee', fontSize:14, cursor:'pointer' }}>
          {t('我知道了','Got it','Capito')}
        </button>
      </div>
    </div>
  );

  // Main install card
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px' }}
      onClick={dismiss}>
      <div style={{ background:V.bg, borderRadius:24, padding:'28px 24px',
        width:'100%', maxWidth:340, textAlign:'center',
        boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}
        onClick={e=>e.stopPropagation()}>

        {/* Panda */}
        {pandaUrl
          ? <img src={pandaUrl} alt="panda"
              style={{ width:100, height:100, objectFit:'contain', marginBottom:8 }}/>
          : <div style={{ fontSize:64, marginBottom:8 }}>🐼</div>}

        {/* Title */}
        <div style={{ fontSize:22, fontWeight:500, color:V.text, marginBottom:4,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          大卫学中文
        </div>
        <div style={{ fontSize:12, color:V.text3, marginBottom:20 }}>
          {t('安装到手机，下次一键打开',
             'Install on your phone for quick access',
             'Installa sul telefono')}
        </div>

        {/* Benefits — only 2 */}
        <div style={{ background:'#fff', borderRadius:14, padding:'12px 16px',
          marginBottom:20, textAlign:'left' }}>
          {[
            ['⚡', t('一键打开，无需每次扫码','One tap — no QR scan needed','Un tocco, nessun QR')],
            ['📶', t('随时学习，离线也可用','Learn anytime, works offline','Funziona offline')],
          ].map(([icon, text]) => (
            <div key={text} style={{ display:'flex', gap:10, alignItems:'center',
              fontSize:13, color:'#333', padding:'6px 0' }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        {/* Install button */}
        <button
          onTouchStart={install} onClick={install}
          style={{ width:'100%', padding:'15px', borderRadius:14, border:'none',
            background: V.verm, color:'#fdf6e3', fontSize:16, fontWeight:600,
            cursor:'pointer', marginBottom:10,
            WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
          {prompt
            ? t('📲 立即安装','📲 Install Now','📲 Installa Ora')
            : isIOS()
              ? t('📲 添加到主屏幕','📲 Add to Home Screen','📲 Aggiungi alla Home')
              : t('📲 安装应用','📲 Install App','📲 Installa App')}
        </button>

        <button onClick={dismiss}
          style={{ width:'100%', padding:10, borderRadius:12, border:'none',
            background:'transparent', color:V.text3, fontSize:13, cursor:'pointer' }}>
          {t('以后再说','Maybe later','Più tardi')}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%,100% { transform:translateY(0); }
          50% { transform:translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
