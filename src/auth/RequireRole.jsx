import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';

export default function RequireRole({ allow, children }) {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) window.location.replace('/login');
  }, [loading, user]);
  if (loading || !user) return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>···</div>;
  if (!allow.includes(user.role)) {
    return (
      <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex',
        alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
        <div>
          <div style={{ fontSize:48, marginBottom:12 }}>🚫</div>
          <div style={{ fontSize:18, color:'#8B4513', marginBottom:6 }}>
            权限不足 · Access denied
          </div>
          <a href="/" style={{ color:'#c41e3a', border:'1px solid #c41e3a',
            borderRadius:6, padding:'6px 14px', textDecoration:'none', fontSize:13 }}>← Home</a>
        </div>
      </div>
    );
  }
  return children;
}
