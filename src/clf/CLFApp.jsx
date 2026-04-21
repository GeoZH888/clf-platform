// src/clf/CLFApp.jsx
// Heritage Chinese Learning Platform — main router
// Uses clf_* tables. Runs alongside existing jgw_* app.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import CLFHome       from './CLFHome.jsx';
import CLFProfile    from './components/CLFProfile.jsx';
import CharactersModule from './modules/CharactersModule.jsx';

const TOKEN_KEY = 'clf_learner_token';

function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, t); }
  return t;
}

export default function CLFApp() {
  const [screen,  setScreen]  = useState('home');
  const [module,  setModule]  = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load or create learner profile
  useEffect(() => {
    const token = getToken();
    supabase.from('clf_learner_profiles')
      .select('*').eq('device_token', token).maybeSingle()
      .then(({ data }) => {
        if (data) { setProfile(data); setLoading(false); }
        else {
          // First visit — show profile setup
          setScreen('profile_setup');
          setLoading(false);
        }
      });
  }, []);

  function onProfileSaved(p) {
    setProfile(p);
    setScreen('home');
  }

  function goHome() { setScreen('home'); setModule(null); }

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#fdf6e3' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🐼</div>
        <div style={{ fontSize:14, color:'#8B4513' }}>大卫学中文…</div>
      </div>
    </div>
  );

  if (screen === 'profile_setup') return (
    <CLFProfile token={getToken()} onSaved={onProfileSaved}/>
  );

  if (screen === 'characters') return (
    <CharactersModule profile={profile} onBack={goHome}/>
  );

  return (
    <CLFHome
      profile={profile}
      onSelect={mod => { setModule(mod); setScreen(mod); }}
      onEditProfile={() => setScreen('profile_setup')}
    />
  );
}
