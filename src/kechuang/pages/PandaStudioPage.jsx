// src/pages/PandaStudioPage.jsx
import PandaStudio, { PandaLogo } from '../components/PandaStudio';

export default function PandaStudioPage() {
  return (
    <div>
      <div className="content-header" style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          background:'linear-gradient(135deg,#1a0a05,#4a1a08)',
          borderRadius:12, padding:'8px 10px', display:'flex', alignItems:'center',
        }}>
          <PandaLogo size={32}/>
        </div>
        <div>
          <h1 style={{ margin:0 }}>Panda Studio</h1>
          <p style={{ margin:0, color:'var(--text-muted)', fontSize:13 }}>
            大卫学中文 · 吉祥物资产生成与管理
          </p>
        </div>
      </div>
      <PandaStudio />
    </div>
  );
}
