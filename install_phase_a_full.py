# install_phase_a_full.py
# Phase A combined: auth foundation + tier-based module gating + super_admin UI
#
# Run from clf-platform root:
#   python install_phase_a_full.py
#
# THREE SECTIONS, run them in this order:
#   1. SQL migration (you copy/paste into Supabase manually, file written here)
#   2. Code files (this script writes them all)
#   3. App.jsx patches (this script applies them)
#
# Idempotent. Safe to re-run.

import pathlib, sys, re

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run this from the clf-platform root (no src/App.jsx)")
    sys.exit(1)

# ============================================================
# SQL MIGRATION (write to file, user runs in Supabase)
# ============================================================
SQL = '''-- =================================================================
-- Phase A: tier system + module gating
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent. Safe to re-run.
-- =================================================================

-- 1. Tier table
CREATE TABLE IF NOT EXISTS clf_tiers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  label_zh             text NOT NULL,
  label_en             text NOT NULL,
  label_it             text,
  description          text,
  expires_after_days   int,
  is_default           boolean NOT NULL DEFAULT false,
  sort_order           int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. Module catalog
CREATE TABLE IF NOT EXISTS clf_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  label_zh    text NOT NULL,
  label_en    text NOT NULL,
  label_it    text,
  description text,
  route       text NOT NULL,
  icon        text,
  color       text,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Tier <-> module allowlist join
CREATE TABLE IF NOT EXISTS clf_tier_modules (
  tier_id    uuid REFERENCES clf_tiers(id)   ON DELETE CASCADE,
  module_id  uuid REFERENCES clf_modules(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, module_id)
);

-- 4. Add tier_id to clf_user_profiles (NULL = no tier yet, treated as free)
DO $$ BEGIN
  ALTER TABLE clf_user_profiles ADD COLUMN tier_id uuid REFERENCES clf_tiers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS clf_user_profiles_tier_idx ON clf_user_profiles(tier_id);

-- 5. Seed 4 tiers (idempotent via UPSERT on slug)
INSERT INTO clf_tiers (slug, label_zh, label_en, label_it, description, expires_after_days, is_default, sort_order)
VALUES
  ('free',     '\u514d\u8d39\u7248',     'Free',                 'Gratuito',          'Limited free modules',                  NULL, true,  1),
  ('premium',  '\u9ad8\u7ea7\u7248',     'Premium',              'Premium',           'All community modules',                 NULL, false, 2),
  ('school',   '\u6821\u56ed\u7248',     'School-affiliated',    'Affiliato Scuola',  'Tied to a school enrollment',           NULL, false, 3),
  ('trial',    '\u8bd5\u7528\u7248',     'Trial',                'Prova',             'Premium for 14 days',                   14,   false, 4)
ON CONFLICT (slug) DO UPDATE
  SET label_zh           = EXCLUDED.label_zh,
      label_en           = EXCLUDED.label_en,
      label_it           = EXCLUDED.label_it,
      description        = EXCLUDED.description,
      expires_after_days = EXCLUDED.expires_after_days,
      sort_order         = EXCLUDED.sort_order;

-- 6. Seed CLF community modules (idempotent via UPSERT on slug)
-- Routes match what CLFHome.jsx already shows. Add more later via super_admin UI.
INSERT INTO clf_modules (slug, label_zh, label_en, label_it, description, route, icon, color, sort_order)
VALUES
  ('characters', '\u6c49\u5b57',         'Characters', 'Caratteri',  '\u8ba4\u8bc6\u6c49\u5b57\uff0c\u5b66\u4e60\u7b14\u987a',      '/community/characters', '\u5b57', '#E53935', 1),
  ('pinyin',     '\u62fc\u97f3',         'Pinyin',     'Pinyin',     '\u62fc\u97f3\u53d1\u97f3\u4e0e\u8f93\u5165',              '/community/pinyin',     '\u97f3', '#1565C0', 2),
  ('words',      '\u8bcd\u8bed',         'Vocabulary', 'Vocabolario','\u6309\u4e3b\u9898\u5b66\u8bcd\u6c47',                       '/community/words',      '\u8bcd', '#1565C0', 3),
  ('grammar',    '\u8bed\u6cd5',         'Grammar',    'Grammatica', '\u8bed\u6cd5\u89c4\u5219\u4e0e\u7ec3\u4e60',                  '/community/grammar',    '\u6cd5', '#6A1B9A', 4),
  ('idioms',     '\u6210\u8bed',         'Idioms',     'Proverbi',   '\u6210\u8bed\u6545\u4e8b\u4e0e\u7ec3\u4e60',                  '/community/idioms',     '\u6210', '#8B4513', 5),
  ('poems',      '\u8bd7\u6b4c',         'Poetry',     'Poesia',     '\u53e4\u5178\u8bd7\u6b4c\u9605\u8bfb',                        '/community/poems',      '\u8bd7', '#C8972A', 6),
  ('stories',    '\u6545\u4e8b',         'Stories',    'Storie',     '\u5206\u7ea7\u9605\u8bfb\u6545\u4e8b',                        '/community/stories',    '\u6545', '#2E7D32', 7),
  ('dialogue',   '\u573a\u666f\u5bf9\u8bdd', 'Scene Dialogue', 'Dialogo', '\u4e0e AI \u8fdb\u884c\u573a\u666f\u5bf9\u8bdd',          '/community/dialogue',   '\u8bdd', '#1D9E75', 8),
  ('storyhub',   '\u6545\u4e8b\u6c47',   'Story Hub',  'Storie',     'AI \u751f\u6210\u6545\u4e8b\u4e0e\u95ee\u7b54',                '/community/storyhub',   '\u6c47', '#534AB7', 9)
ON CONFLICT (slug) DO UPDATE
  SET label_zh    = EXCLUDED.label_zh,
      label_en    = EXCLUDED.label_en,
      label_it    = EXCLUDED.label_it,
      description = EXCLUDED.description,
      route       = EXCLUDED.route,
      icon        = EXCLUDED.icon,
      color       = EXCLUDED.color,
      sort_order  = EXCLUDED.sort_order;

-- 7. Default allowlist: free = characters + pinyin only; premium/school/trial = ALL
WITH free_tier AS (SELECT id FROM clf_tiers WHERE slug = 'free'),
     basic_modules AS (SELECT id FROM clf_modules WHERE slug IN ('characters', 'pinyin'))
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT free_tier.id, basic_modules.id FROM free_tier, basic_modules
ON CONFLICT DO NOTHING;

WITH full_tiers AS (SELECT id FROM clf_tiers WHERE slug IN ('premium', 'school', 'trial')),
     all_modules AS (SELECT id FROM clf_modules WHERE is_active = true)
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT full_tiers.id, all_modules.id FROM full_tiers, all_modules
ON CONFLICT DO NOTHING;

-- 8. RLS
ALTER TABLE clf_tiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_tier_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read tiers"   ON clf_tiers;
CREATE POLICY "anyone read tiers"   ON clf_tiers        FOR SELECT USING (true);

DROP POLICY IF EXISTS "anyone read modules" ON clf_modules;
CREATE POLICY "anyone read modules" ON clf_modules      FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "anyone read links"   ON clf_tier_modules;
CREATE POLICY "anyone read links"   ON clf_tier_modules FOR SELECT USING (true);

DROP POLICY IF EXISTS "super_admin write tiers" ON clf_tiers;
CREATE POLICY "super_admin write tiers"
  ON clf_tiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write modules" ON clf_modules;
CREATE POLICY "super_admin write modules"
  ON clf_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write links" ON clf_tier_modules;
CREATE POLICY "super_admin write links"
  ON clf_tier_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Sanity check
SELECT 'tiers'   AS what, count(*) FROM clf_tiers
UNION ALL SELECT 'modules',     count(*) FROM clf_modules
UNION ALL SELECT 'tier_links',  count(*) FROM clf_tier_modules
UNION ALL SELECT 'free_modules',count(*) FROM clf_tier_modules WHERE tier_id = (SELECT id FROM clf_tiers WHERE slug = 'free');
'''

(ROOT / "supabase_migrations").mkdir(parents=True, exist_ok=True)
sql_path = ROOT / "supabase_migrations" / "phase_a_tiers.sql"
sql_path.write_text(SQL, encoding="utf-8")
print(f"  wrote  supabase_migrations/phase_a_tiers.sql")

# ============================================================
# CODE FILES
# ============================================================
files = {}

# ---- Auth ----
files["src/auth/RoleRedirect.jsx"] = '''import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';

const ROLE_HOME = {
  super_admin:    '/admin',
  school_master:  '/school-master',
  teacher:        '/teacher',
  student:        '/student',
  parent:         '/parent',
};

export default function RoleRedirect() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.replace('/login'); return; }
    const dest = ROLE_HOME[user.role] || '/community';
    window.location.replace(dest);
  }, [loading, user]);

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#fdf6e3', color:'#8B4513', fontSize:14 }}>
      \u8df3\u8f6c\u4e2d\u2026 Redirecting\u2026
    </div>
  );
}
'''

files["src/auth/RoleRedirectGate.jsx"] = '''import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RoleRedirect from './RoleRedirect';

export default function RoleRedirectGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RoleRedirect />
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

files["src/auth/RequireRole.jsx"] = '''import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';

export default function RequireRole({ allow, children }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) window.location.replace('/login');
  }, [loading, user]);

  if (loading || !user) {
    return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>\u00b7\u00b7\u00b7</div>;
  }
  if (!allow.includes(user.role)) {
    return (
      <div style={{ minHeight:'100dvh', background:'#fdf6e3',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:24, textAlign:'center' }}>
        <div>
          <div style={{ fontSize:48, marginBottom:12 }}>\U0001F6AB</div>
          <div style={{ fontSize:18, color:'#8B4513', marginBottom:6 }}>
            \u6743\u9650\u4e0d\u8db3 \u00B7 Access denied
          </div>
          <div style={{ fontSize:12, color:'#a07850', marginBottom:18 }}>
            Role <code>{user.role}</code> can't access this.
          </div>
          <a href="/" style={{ color:'#c41e3a', border:'1px solid #c41e3a',
            borderRadius:6, padding:'6px 14px', textDecoration:'none', fontSize:13 }}>
            \u2190 Go home
          </a>
        </div>
      </div>
    );
  }
  return children;
}
'''

files["src/auth/LoginGate.jsx"] = '''import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import LoginPage from '../school/pages/LoginPage';

function PostLoginRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) window.location.replace('/role-redirect');
  }, [loading, user, navigate]);
  return <LoginPage />;
}

export default function LoginGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/login">
          <Routes>
            <Route path="/*" element={<PostLoginRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- useUserTier hook ----
files["src/auth/useUserTier.js"] = '''import { useEffect, useState } from 'react';
import { supabase } from '../school/services/supabase';
import { useAuth } from '../school/contexts/AuthContext';

export function useUserTier() {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        let tierId = user?.tier_id || user?.profile?.tier_id;

        if (!tierId) {
          const { data: freeTier } = await supabase
            .from('clf_tiers').select('id, slug, label_zh, label_en, label_it')
            .eq('slug', 'free').maybeSingle();
          if (freeTier) tierId = freeTier.id;
          if (!cancelled) setTier(freeTier);
        } else {
          const { data: t } = await supabase
            .from('clf_tiers').select('*').eq('id', tierId).maybeSingle();
          if (!cancelled) setTier(t);
        }

        if (tierId) {
          const { data: links } = await supabase
            .from('clf_tier_modules').select('module_id').eq('tier_id', tierId);
          const moduleIds = (links || []).map(l => l.module_id);

          if (moduleIds.length) {
            const { data: mods } = await supabase
              .from('clf_modules').select('*')
              .in('id', moduleIds).eq('is_active', true)
              .order('sort_order');
            if (!cancelled) setModules(mods || []);
          } else {
            if (!cancelled) setModules([]);
          }
        }
      } catch (e) {
        console.warn('[useUserTier]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user]);

  return { tier, modules, loading };
}
'''

# ---- Community page ----
files["src/community/CommunityApp.jsx"] = '''import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import { useUserTier } from '../auth/useUserTier';

function CommunityHome() {
  const { user, loading: authLoading } = useAuth();
  const { tier, modules, loading } = useUserTier();
  const [lang, setLang] = React.useState('zh');

  if (authLoading || loading) {
    return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>\u00b7\u00b7\u00b7</div>;
  }

  const t = (zh, en, it) => lang === 'en' ? en : lang === 'it' ? it : zh;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>
      <header style={{ background:'#c41e3a', color:'#fff', padding:'18px 20px',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, fontFamily:"'STKaiti','KaiTi',serif",
            letterSpacing:2 }}>{t('\u793e\u533a','Community','Comunit\u00e0')}</div>
          <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>
            {tier ? (lang==='zh' ? tier.label_zh : lang==='it' ? (tier.label_it||tier.label_en) : tier.label_en) : ''}
            {user ? ' \u00B7 ' + (user.name || user.email) : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {['zh','en','it'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer',
              background: lang===l?'#fff':'transparent',
              color: lang===l?'#c41e3a':'#fff',
              border:'1px solid rgba(255,255,255,0.4)',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>

      <div style={{ padding:'24px 16px', maxWidth:960, margin:'0 auto' }}>
        <div style={{ fontSize:14, color:'#8B4513', marginBottom:12 }}>
          {t('\u53ef\u7528\u6a21\u5757','Available modules','Moduli disponibili')}
        </div>

        {modules.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:12, padding:32, textAlign:'center',
            border:'1px dashed #e8d5b0', color:'#a07850' }}>
            {t('\u60a8\u7684\u7b49\u7ea7\u6682\u65e0\u6a21\u5757\u3002\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u3002',
               'No modules in your tier yet. Contact your admin.',
               'Nessun modulo disponibile per il tuo livello. Contatta l\u2019amministratore.')}
          </div>
        ) : (
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14 }}>
            {modules.map(m => (
              <button key={m.id} onClick={() => window.location.href = m.route} style={{
                background:'#fff', border:`1.5px solid ${m.color || '#c41e3a'}33`,
                borderRadius:14, padding:'16px 14px', cursor:'pointer',
                textAlign:'left', transition:'transform 0.15s',
              }}>
                <div style={{
                  width:44, height:44, borderRadius:12,
                  background: (m.color||'#c41e3a') + '15',
                  color: m.color || '#c41e3a',
                  fontSize:24, fontWeight:700,
                  fontFamily:"'STKaiti','KaiTi',serif",
                  display:'flex', alignItems:'center', justifyContent:'center',
                  marginBottom:10,
                }}>{m.icon || (lang==='zh'?m.label_zh.charAt(0):m.label_en.charAt(0))}</div>
                <div style={{ fontSize:15, fontWeight:600, color:'#1a0a05' }}>
                  {lang==='zh' ? m.label_zh : lang==='it' ? (m.label_it||m.label_en) : m.label_en}
                </div>
                {m.description && (
                  <div style={{ fontSize:11, color:'#a07850', marginTop:4 }}>
                    {m.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/community">
          <Routes>
            <Route path="/*" element={<CommunityHome />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- Tier admin page (standalone, mounted at /tiers-admin) ----
files["src/tiers-admin/TiersAdminApp.jsx"] = '''import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import { supabase } from '../school/services/supabase';
import RequireRole from '../auth/RequireRole';

function TiersAdmin() {
  const { user } = useAuth();
  const [tiers, setTiers]     = useState([]);
  const [modules, setModules] = useState([]);
  const [links, setLinks]     = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const [saving, setSaving]   = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const [t, m, l] = await Promise.all([
        supabase.from('clf_tiers').select('*').order('sort_order'),
        supabase.from('clf_modules').select('*').order('sort_order'),
        supabase.from('clf_tier_modules').select('*'),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      if (l.error) throw l.error;

      const linkMap = {};
      for (const link of l.data) {
        linkMap[link.tier_id] ||= new Set();
        linkMap[link.tier_id].add(link.module_id);
      }
      setTiers(t.data || []);
      setModules(m.data || []);
      setLinks(linkMap);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (tierId, moduleId) => {
    const cellKey = `${tierId}:${moduleId}`;
    setSaving(cellKey);
    try {
      const has = links[tierId]?.has(moduleId);
      if (has) {
        await supabase.from('clf_tier_modules').delete()
          .match({ tier_id: tierId, module_id: moduleId });
      } else {
        await supabase.from('clf_tier_modules').insert({ tier_id: tierId, module_id: moduleId });
      }
      setLinks(prev => {
        const next = { ...prev };
        next[tierId] = new Set(prev[tierId] || []);
        if (has) next[tierId].delete(moduleId);
        else     next[tierId].add(moduleId);
        return next;
      });
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>\u00b7\u00b7\u00b7</div>;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', padding:'24px 16px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:20, color:'#c41e3a', margin:0 }}>
            \u7b49\u7ea7\u4e0e\u6a21\u5757 \u00B7 Tier &amp; Module Matrix
          </h2>
          <a href="/admin" style={{ fontSize:13, color:'#c41e3a',
            border:'1px solid #c41e3a', borderRadius:6, padding:'5px 12px',
            textDecoration:'none' }}>\u2190 Admin</a>
        </div>

        {err && <div style={{ background:'#fee', padding:10, borderRadius:6,
          color:'#c00', marginBottom:14 }}>{err}</div>}

        <div style={{ background:'#fff', borderRadius:12, overflow:'auto',
          border:'1px solid #e8d5b0' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#fdf6e3' }}>
                <th style={th}>\u6a21\u5757 / Module</th>
                {tiers.map(t => (
                  <th key={t.id} style={th}>
                    <div>{t.label_zh}</div>
                    <div style={{ fontSize:11, color:'#a07850', fontWeight:400 }}>
                      {t.label_en}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(m => (
                <tr key={m.id}>
                  <td style={td}>
                    <div style={{ fontWeight:500 }}>{m.label_zh}</div>
                    <div style={{ fontSize:11, color:'#a07850' }}>{m.label_en} \u00B7 {m.slug}</div>
                  </td>
                  {tiers.map(t => {
                    const has = links[t.id]?.has(m.id);
                    const k   = `${t.id}:${m.id}`;
                    return (
                      <td key={t.id} style={{ ...td, textAlign:'center' }}>
                        <button onClick={() => toggle(t.id, m.id)}
                          disabled={saving === k}
                          style={{
                            width:32, height:32, borderRadius:6,
                            background: has ? '#10b981' : '#fff',
                            border: has ? 'none' : '1px solid #e8d5b0',
                            color: has ? '#fff' : '#a07850',
                            cursor: saving === k ? 'wait' : 'pointer',
                            fontSize:14,
                          }}>
                          {has ? '\u2713' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop:16, fontSize:11, color:'#a07850' }}>
          \u70b9\u51fb\u5355\u5143\u683c\u5207\u6362\u5141\u8bb8\u00B7 Click any cell to toggle access.
          \u589e\u52a0\u6a21\u5757\u9700\u5728 Supabase \u624b\u52a8\u63d2\u5165 clf_modules \u8868\u3002
        </div>
      </div>
    </div>
  );
}

const th = { padding:'12px 14px', textAlign:'left', fontSize:13, fontWeight:600,
  color:'#3d3d3a', borderBottom:'1px solid #e8d5b0' };
const td = { padding:'10px 14px', fontSize:13, borderBottom:'1px solid #f5e8c8',
  color:'#3d3d3a' };

export default function TiersAdminApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/tiers-admin">
          <Routes>
            <Route path="/*" element={
              <RequireRole allow={['super_admin']}>
                <TiersAdmin />
              </RequireRole>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- Role app placeholders (4 of them) ----
def role_app_template(role_name, basename, role_label_zh, role_label_en, allow_roles):
    return f'''import React from 'react';
import {{ BrowserRouter, Routes, Route }} from 'react-router-dom';
import {{ AuthProvider, useAuth }} from '../school/contexts/AuthContext';
import {{ LanguageProvider }} from '../school/contexts/LanguageContext';
import RequireRole from '../auth/RequireRole';

function {role_name}Placeholder() {{
  const {{ user, logout }} = useAuth();
  return (
    <div style={{{{
      minHeight:'100dvh', background:'#fdf6e3', padding:40,
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:16, textAlign:'center',
    }}}}>
      <div style={{{{ fontSize:60 }}}}>\U0001F44B</div>
      <div style={{{{ fontSize:28, fontWeight:700, color:'#c41e3a',
        fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}}}>
        {role_label_zh}
      </div>
      <div style={{{{ fontSize:14, color:'#a07850' }}}}>
        {role_label_en} \u00B7 Welcome, {{user?.name || user?.email}}
      </div>
      <div style={{{{ fontSize:12, color:'#a07850', marginTop:8 }}}}>
        Role: <code>{{user?.role}}</code> \u00B7 Phase B builds the real dashboard here.
      </div>
      <div style={{{{ display:'flex', gap:10, marginTop:16 }}}}>
        <a href="/" style={{{{ padding:'8px 16px', borderRadius:8,
          background:'#fff', color:'#c41e3a', border:'1px solid #c41e3a',
          textDecoration:'none', fontSize:13 }}}}>\u2190 Home</a>
        <button onClick={{logout}} style={{{{ padding:'8px 16px', borderRadius:8,
          background:'#c41e3a', color:'#fff', border:'none',
          cursor:'pointer', fontSize:13 }}}}>Logout</button>
      </div>
    </div>
  );
}}

export default function {role_name}App() {{
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter basename="/{basename}">
          <Routes>
            <Route path="/*" element={{
              <RequireRole allow={{{allow_roles!r}}}>
                <{role_name}Placeholder />
              </RequireRole>
            }} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}}
'''

files["src/teacher/TeacherApp.jsx"] = role_app_template(
    "Teacher", "teacher",
    "\u6559\u5e08\u5de5\u4f5c\u53f0", "Teacher Workspace",
    ["super_admin", "teacher"])
files["src/school-master/SchoolMasterApp.jsx"] = role_app_template(
    "SchoolMaster", "school-master",
    "\u6821\u957f\u4e2d\u5fc3", "School Master",
    ["super_admin", "school_master"])
files["src/student/StudentApp.jsx"] = role_app_template(
    "Student", "student",
    "\u5b66\u4e60\u4e2d\u5fc3", "Student",
    ["super_admin", "school_master", "teacher", "student"])
files["src/parent/ParentApp.jsx"] = role_app_template(
    "Parent", "parent",
    "\u5bb6\u957f\u4e2d\u5fc3", "Parent",
    ["super_admin", "school_master", "teacher", "parent"])

# ---- Write all files ----
print(f"\n=== Writing {len(files)} code files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  wrote  {rel}")

# Sanity: Chinese chars survived
sample = (ROOT / "src/community/CommunityApp.jsx").read_text(encoding="utf-8")
assert "\u793e\u533a" in sample, "Chinese chars corrupted in CommunityApp!"
print("  OK -- Chinese chars preserved")

# ============================================================
# Patch src/App.jsx
# ============================================================
print("\n=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")
orig = src

new_imports = """import LoginGate         from './auth/LoginGate.jsx';
import RoleRedirectGate from './auth/RoleRedirectGate.jsx';
import CommunityApp     from './community/CommunityApp.jsx';
import TiersAdminApp    from './tiers-admin/TiersAdminApp.jsx';
import TeacherApp       from './teacher/TeacherApp.jsx';
import SchoolMasterApp  from './school-master/SchoolMasterApp.jsx';
import StudentApp       from './student/StudentApp.jsx';
import ParentApp        from './parent/ParentApp.jsx';
"""

if "from './auth/LoginGate.jsx'" not in src:
    kechuang_marker = "import KechuangApp from './kechuang/KechuangApp.jsx';"
    if kechuang_marker in src:
        src = src.replace(kechuang_marker, kechuang_marker + "\n" + new_imports.rstrip())
        print("  added 8 new imports")
    else:
        print("  WARN: KechuangApp import not found")
else:
    print("  imports already present")

new_flags = """const IS_LOGIN          = window.location.pathname.startsWith('/login');
const IS_ROLE_REDIRECT  = window.location.pathname.startsWith('/role-redirect');
const IS_COMMUNITY      = window.location.pathname.startsWith('/community');
const IS_TIERS_ADMIN    = window.location.pathname.startsWith('/tiers-admin');
const IS_TEACHER        = window.location.pathname.startsWith('/teacher');
const IS_SCHOOL_MASTER  = window.location.pathname.startsWith('/school-master');
const IS_STUDENT        = window.location.pathname.startsWith('/student');
const IS_PARENT         = window.location.pathname.startsWith('/parent');"""

if "IS_LOGIN" not in src:
    kf = "const IS_KECHUANG = window.location.pathname.startsWith('/kechuang');"
    if kf in src:
        src = src.replace(kf, kf + "\n" + new_flags)
        print("  added 8 IS_* flags")
    else:
        print("  WARN: IS_KECHUANG not found")
else:
    print("  IS_LOGIN already present")

# Strip any leftover IS_SCHOOL flag from earlier installer runs
src = re.sub(r"\nconst IS_SCHOOL\s*=\s*window\.location\.pathname\.startsWith\('/school'\);\s*", "\n", src)

# Insert new routing branches BEFORE the IS_KECHUANG branch
old_kechuang = ": IS_KECHUANG ? <LanguageProvider><KechuangApp/></LanguageProvider>"

# IMPORTANT: order matters. /school-master must come before /school detection
# (we don't have IS_SCHOOL anymore, so this is fine)
# But /tiers-admin must come before /admin if we had any. AdminApp is mounted
# differently (we don't touch IS_ADMIN), so we just need our new branches in order.
new_branches = (
    ": IS_LOGIN          ? <LoginGate/>\n        "
    ": IS_ROLE_REDIRECT  ? <RoleRedirectGate/>\n        "
    ": IS_COMMUNITY      ? <CommunityApp/>\n        "
    ": IS_TIERS_ADMIN    ? <TiersAdminApp/>\n        "
    ": IS_TEACHER        ? <TeacherApp/>\n        "
    ": IS_SCHOOL_MASTER  ? <SchoolMasterApp/>\n        "
    ": IS_STUDENT        ? <StudentApp/>\n        "
    ": IS_PARENT         ? <ParentApp/>\n        "
)

if old_kechuang in src and "<TeacherApp/>" not in src:
    src = src.replace(old_kechuang, new_branches + old_kechuang)
    print("  added 8 routing branches")
else:
    print("  routing branches already present or kechuang branch missing")

# Strip leftover SchoolApp branch + import if present
src = re.sub(r":\s*IS_SCHOOL\s*\?\s*<SchoolApp\s*/>\s*\n\s*", "", src)
src = re.sub(r"import SchoolApp\s+from\s+'\./school/SchoolApp\.jsx';\s*\n", "", src)

if src != orig:
    app.write_text(src, encoding="utf-8")
    print("  App.jsx written")
else:
    print("  no changes")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = app.read_text(encoding="utf-8")
markers = ["IS_LOGIN", "IS_COMMUNITY", "IS_TEACHER", "IS_TIERS_ADMIN",
           "<LoginGate/>", "<CommunityApp/>", "<TeacherApp/>", "<TiersAdminApp/>"]
for m in markers:
    n = sum(1 for line in final.split("\n") if m in line)
    print(f"  [{'OK' if n else 'MISSING'}] {m}: {n}")

if "<SchoolApp" in final or "IS_SCHOOL " in final:
    print("  WARN: leftover SchoolApp/IS_SCHOOL still in App.jsx")
else:
    print("  OK -- school namespace cleaned up")

# ============================================================
# DONE
# ============================================================
print("\n=== DONE ===")
print()
print("Routing:")
print("  /              -> CLF home")
print("  /login         -> David-Chinese login")
print("  /role-redirect -> dispatch by role")
print("  /admin         -> existing AdminApp (super_admin)")
print("  /tiers-admin   -> NEW: tier matrix UI (super_admin)")
print("  /teacher /school-master /student /parent -> placeholders")
print("  /community     -> tier-filtered module grid (no-role users)")
print()
print("NEXT STEPS:")
print()
print("  1. Run SQL migration:")
print("     Open Supabase SQL editor for yqcojudvvjntaajnrilr")
print("     Paste contents of supabase_migrations/phase_a_tiers.sql")
print("     Sanity should print: tiers=4, modules=9, tier_links=etc")
print()
print("  2. Test locally:")
print("     npm run dev")
print("     Open http://localhost:5174/login")
print("     Log in -> bounces to /role-redirect -> your role's panel")
print("     If you have no role, you land on /community (filtered)")
print("     /tiers-admin shows the matrix (super_admin only)")
print()
print("  3. When working, deploy:")
print("     npm run build")
print("     netlify deploy --prod --dir dist --no-build")
