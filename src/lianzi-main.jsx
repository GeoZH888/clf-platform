// src/lianzi-main.jsx
// Entry point for the standalone 练字 mobile bundle (Capacitor on iOS/Android,
// and a web preview at /index-lianzi.html). Does NOT mount AdminApp, login,
// community, or any other learning module — just the 练字 sub-tree.

import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import LianziApp from './lianzi/LianziApp.jsx';

document.title = '练字';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding:'2rem', textAlign:'center', color:'#c0392b' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
        <div style={{ fontSize:14 }}>{this.state.error.message}</div>
        <button onClick={()=>window.location.reload()}
          style={{ marginTop:16, padding:'8px 20px', cursor:'pointer', borderRadius:8,
            border:'none', background:'#8B4513', color:'#fdf6e3' }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LianziApp/>
    </ErrorBoundary>
  </StrictMode>
);
