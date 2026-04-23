// src/admin/InvitationCardModal.jsx
// Reusable invitation-card-style modal for displaying QR login credentials.
// Used by DirectCreateUserPanel (after creation) and CreatedUsersListPanel (re-view).
//
// Props:
//   result: { name, username, password, qr_token }
//   hidePassword: bool — when re-viewing existing account, password isn't available
//   onClose: fn

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
const buildQrUrl = (token) => `${BASE_URL}/quick-login?t=${token}`;

export default function InvitationCardModal({ result, hidePassword, onClose }) {
  const hiddenCanvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const url = buildQrUrl(result.qr_token);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320, margin: 1,
      color: { dark: '#2b1810', light: '#fdf6e3' },
    }).then(setQrDataUrl).catch(e => console.warn('QR:', e));
  }, [url]);

  async function downloadPNG() {
    if (!qrDataUrl) return;
    const W = 600, H = 900;
    const canvas = hiddenCanvasRef.current;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#fdf6e3');
    grad.addColorStop(1, '#f5ecd4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Borders
    ctx.strokeStyle = '#8B1A1A';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.strokeStyle = 'rgba(139, 26, 26, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    // Corner ornaments
    ctx.fillStyle = 'rgba(139, 26, 26, 0.7)';
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('❦', 45, 58);
    ctx.fillText('❦', W - 45, 58);
    ctx.fillText('❦', 45, H - 32);
    ctx.fillText('❦', W - 45, H - 32);

    // Logo CN
    ctx.fillStyle = '#8B1A1A';
    ctx.font = 'bold 40px "STKaiti","KaiTi",serif';
    ctx.fillText('大 卫 学 中 文', W / 2, 110);

    // Logo EN
    ctx.fillStyle = '#6b4c2a';
    ctx.font = '14px sans-serif';
    ctx.fillText('DAVID LEARNS CHINESE', W / 2, 135);

    // Divider helper
    const drawDivider = (y, width) => {
      const d = ctx.createLinearGradient(W/2 - width/2, y, W/2 + width/2, y);
      d.addColorStop(0, 'rgba(139,26,26,0)');
      d.addColorStop(0.5, 'rgba(139,26,26,0.5)');
      d.addColorStop(1, 'rgba(139,26,26,0)');
      ctx.fillStyle = d;
      ctx.fillRect(W/2 - width/2, y, width, 1);
    };
    drawDivider(165, 350);

    // Poem
    ctx.fillStyle = '#2b1810';
    ctx.font = '22px "STKaiti","KaiTi",serif';
    ctx.fillText('敬邀君子', W / 2, 210);
    ctx.fillText('共 游 中 文 之 境', W / 2, 245);

    // QR code
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise(resolve => { qrImg.onload = resolve; });
    const qrSize = 260;
    const qrX = (W - qrSize) / 2;
    const qrY = 280;
    ctx.strokeStyle = '#8B1A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Hint
    ctx.fillStyle = '#6b4c2a';
    ctx.font = '16px "STKaiti","KaiTi",serif';
    ctx.fillText('扫 码 启 程', W / 2, qrY + qrSize + 35);

    // Name banner
    const nameY = qrY + qrSize + 75;
    ctx.strokeStyle = '#8B1A1A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W/2 - 100, nameY - 20); ctx.lineTo(W/2 + 100, nameY - 20);
    ctx.moveTo(W/2 - 100, nameY + 10); ctx.lineTo(W/2 + 100, nameY + 10);
    ctx.stroke();
    ctx.fillStyle = '#2b1810';
    ctx.font = '26px "STKaiti","KaiTi",serif';
    ctx.fillText(result.name, W / 2, nameY + 2);

    // Credentials
    const credY = nameY + 60;
    ctx.fillStyle = 'rgba(139, 26, 26, 0.08)';
    ctx.fillRect(W/2 - 170, credY - 20, 340, 50);
    ctx.strokeStyle = 'rgba(139, 26, 26, 0.3)';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(W/2 - 170, credY - 20, 340, 50);
    ctx.setLineDash([]);
    ctx.fillStyle = '#8B1A1A';
    ctx.font = '14px "STKaiti","KaiTi",serif';
    ctx.textAlign = 'right';
    ctx.fillText('账户', W/2 - 80, credY - 2);
    ctx.fillText('密钥', W/2 - 80, credY + 20);
    ctx.fillStyle = '#3b2820';
    ctx.font = '14px ui-monospace,"Courier New",monospace';
    ctx.textAlign = 'left';
    ctx.fillText(result.username, W/2 - 70, credY - 2);
    ctx.fillText(hidePassword ? '（已设置）' : result.password, W/2 - 70, credY + 20);
    ctx.textAlign = 'center';

    drawDivider(credY + 60, 200);

    // Footer
    ctx.fillStyle = '#6b4c2a';
    ctx.font = '11px sans-serif';
    ctx.fillText('佛罗伦萨 · Firenze · MMXXVI', W / 2, credY + 85);

    // Seal
    const sealY = credY + 100;
    ctx.strokeStyle = '#8B1A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(W/2 - 18, sealY, 36, 36);
    ctx.fillStyle = '#8B1A1A';
    ctx.font = '16px "STKaiti","KaiTi",serif';
    ctx.fillText('印', W / 2, sealY + 24);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `invitation_${result.username}.png`;
    a.click();
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 9999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{
        background: 'linear-gradient(135deg, #fdf6e3 0%, #f5ecd4 100%)',
        border: '2px solid #8B1A1A',
        padding: '28px 24px 22px',
        textAlign: 'center',
        maxWidth: 360,
        width: '100%',
        position: 'relative',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        fontFamily: "'Songti SC','Source Han Serif SC',serif",
      }}>
        <div style={{ position: 'absolute', inset: 6,
          border: '1px solid rgba(139, 26, 26, 0.3)', pointerEvents: 'none' }}/>
        <span style={cornerStyle(0, 0)}>❦</span>
        <span style={cornerStyle(0, 1)}>❦</span>
        <span style={cornerStyle(1, 0)}>❦</span>
        <span style={cornerStyle(1, 1)}>❦</span>

        <button onClick={onClose} style={{
          position: 'absolute', top: 8, right: 8,
          background: 'transparent', border: 'none',
          color: '#8B1A1A', fontSize: 18, cursor: 'pointer',
          zIndex: 2,
        }}>✕</button>

        <div style={{ fontSize: 22, color: '#8B1A1A', letterSpacing: 8,
          fontWeight: 600, marginBottom: 2,
          fontFamily: "'STKaiti','KaiTi','Kaiti SC',serif" }}>
          大 卫 学 中 文
        </div>
        <div style={{ fontSize: 9, color: '#6b4c2a', letterSpacing: 2,
          textTransform: 'uppercase', marginBottom: 14 }}>
          David Learns Chinese
        </div>

        <div style={divider}/>

        <div style={{ fontFamily: "'STKaiti','KaiTi',serif",
          fontSize: 14, color: '#2b1810', lineHeight: 1.8,
          margin: '10px 0 14px', letterSpacing: 2 }}>
          <div>敬邀君子</div>
          <div>共 游 中 文 之 境</div>
        </div>

        <div style={{ display: 'inline-block', padding: 8,
          background: '#fdf6e3', border: '1px solid #8B1A1A', margin: '6px 0' }}>
          {qrDataUrl && <img src={qrDataUrl} alt={result.username}
            style={{ width: 180, height: 180, display: 'block' }}/>}
        </div>
        <div style={{ fontSize: 10, color: '#6b4c2a', marginTop: 4,
          letterSpacing: 4, fontFamily: "'STKaiti','KaiTi',serif" }}>
          扫 码 启 程
        </div>

        <div style={{ display: 'inline-block',
          padding: '4px 20px', margin: '14px 0 2px',
          borderTop: '1px solid #8B1A1A', borderBottom: '1px solid #8B1A1A',
          fontSize: 16, color: '#2b1810',
          fontFamily: "'STKaiti','KaiTi',serif",
          letterSpacing: 4 }}>
          {result.name}
        </div>

        <div style={{ fontFamily: 'ui-monospace, monospace',
          fontSize: 10, color: '#3b2820',
          background: 'rgba(139, 26, 26, 0.05)',
          padding: '8px 12px', borderRadius: 3,
          display: 'inline-block', margin: '10px 0 6px',
          border: '1px dashed rgba(139, 26, 26, 0.3)',
          textAlign: 'left' }}>
          <div style={{ margin: '1px 0' }}>
            <span style={credLabel}>账户</span>{result.username}
          </div>
          <div style={{ margin: '1px 0' }}>
            <span style={credLabel}>密钥</span>
            {hidePassword
              ? <span style={{ color: '#999', fontStyle: 'italic' }}>（已设置）</span>
              : result.password}
          </div>
        </div>

        <div style={{ ...divider, width: '40%', marginTop: 10, opacity: 0.3 }}/>
        <div style={{ fontSize: 9, color: '#6b4c2a', letterSpacing: 1 }}>
          佛罗伦萨 · Firenze · MMXXVI<br/>
          <span style={{ display: 'inline-block', marginTop: 4,
            width: 28, height: 28, border: '1.5px solid #8B1A1A',
            color: '#8B1A1A', lineHeight: '24px', fontSize: 11,
            fontFamily: "'STKaiti','KaiTi',serif" }}>
            印
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center',
          marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={downloadPNG} style={invitBtn}>⬇ 下载邀请函</button>
          <button onClick={() => navigator.clipboard?.writeText(url).then(() => alert('链接已复制'))}
            style={invitBtn}>🔗 复制链接</button>
        </div>
      </div>
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }}/>
    </div>
  );
}

const cornerStyle = (row, col) => ({
  position: 'absolute',
  fontSize: 16, color: '#8B1A1A', opacity: 0.7,
  top: row === 0 ? 10 : 'auto', bottom: row === 1 ? 10 : 'auto',
  left: col === 0 ? 12 : 'auto', right: col === 1 ? 12 : 'auto',
});

const divider = {
  width: '60%', margin: '0 auto', height: 1,
  background: 'linear-gradient(to right, transparent, #8B1A1A, transparent)',
  opacity: 0.4, marginBottom: 14,
};

const credLabel = {
  color: '#8B1A1A', fontFamily: "'STKaiti','KaiTi',serif",
  letterSpacing: 2, marginRight: 6, fontSize: 11,
};

const invitBtn = {
  padding: '6px 14px', fontSize: 12,
  background: '#8B1A1A', color: '#fdf6e3',
  border: 'none', borderRadius: 3,
  cursor: 'pointer', fontFamily: "'STKaiti','KaiTi',serif",
  letterSpacing: 1,
};
