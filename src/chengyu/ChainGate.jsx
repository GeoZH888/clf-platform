// src/chengyu/ChainGate.jsx
//
// 成语接龙 as its own tile.
//
// The game itself (ChengyuChain, ~296 lines) was only reachable by opening 成语
// and finding it inside — so it gets a door of its own. All this does is load
// the idioms the game needs, which ChengyuApp otherwise does on its behalf.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import ChengyuChain from './ChengyuChain.jsx';

export default function ChainGate({ onBack }) {
  const { lang } = useLang();
  const [idioms, setIdioms] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('clf_chengyu')
        .select('*')
        .limit(500);
      if (error) console.error('[ChainGate] clf_chengyu query failed:', error);
      setIdioms(data || []);
    })();
  }, []);

  if (idioms === null) {
    return (
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
        justifyContent:'center', background:'var(--bg)', color:'var(--text2)', fontSize:14 }}>
        加载中…
      </div>
    );
  }

  return <ChengyuChain idioms={idioms} lang={lang} onBack={onBack} />;
}
