# install_phase_a_full_v2.py
# Phase A combined + public /intangible-heritage section
#
# v2 changes vs v1:
#   * Adds src/heritage/HeritageApp.jsx -- public, no AuthProvider wrap
#   * Adds /intangible-heritage routing branch in App.jsx
#   * Adds 'heritage' module to clf_modules SQL seed (visible to all tiers)
#   * Updates MainEntrance \u975e\u9057 button to navigate to /intangible-heritage
#
# Run from clf-platform root:
#   python install_phase_a_full_v2.py
#
# Idempotent. Safe to re-run.
#
# To rename the URL later: change HERITAGE_PATH constant below + redeploy.

import pathlib, sys, re

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root (no src/App.jsx)")
    sys.exit(1)

# Change this constant to rename the heritage URL.
# Currently /intangible-heritage. To switch to /feiyi, /heritage, or
# /non-heritage, edit this single line and re-run.
HERITAGE_PATH      = "/feiyi"
HERITAGE_BASENAME  = HERITAGE_PATH.lstrip('/')           # "intangible-heritage"
HERITAGE_FLAG_NAME = "IS_INTANGIBLE_HERITAGE"            # ASCII PowerShell-safe

# ============================================================
# SQL MIGRATION
# ============================================================
SQL = f'''-- ===================================================================
-- Phase A v2: tier system + module gating + public heritage module
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent. Safe to re-run.
-- ===================================================================

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
  is_public   boolean NOT NULL DEFAULT false,  -- TRUE = visible without login or tier
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- v2 migration: add is_public column if existing install
DO $$ BEGIN
  ALTER TABLE clf_modules ADD COLUMN is_public boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Tier <-> module allowlist
CREATE TABLE IF NOT EXISTS clf_tier_modules (
  tier_id    uuid REFERENCES clf_tiers(id)   ON DELETE CASCADE,
  module_id  uuid REFERENCES clf_modules(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, module_id)
);

-- 4. Add tier_id to user profiles
DO $$ BEGIN
  ALTER TABLE clf_user_profiles ADD COLUMN tier_id uuid REFERENCES clf_tiers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS clf_user_profiles_tier_idx ON clf_user_profiles(tier_id);

-- 5. Seed 4 tiers
INSERT INTO clf_tiers (slug, label_zh, label_en, label_it, description, expires_after_days, is_default, sort_order)
VALUES
  ('free',    '\u514d\u8d39\u7248', 'Free',              'Gratuito',         'Limited free modules',     NULL, true,  1),
  ('premium', '\u9ad8\u7ea7\u7248', 'Premium',           'Premium',          'All community modules',    NULL, false, 2),
  ('school',  '\u6821\u56ed\u7248', 'School-affiliated', 'Affiliato Scuola', 'Tied to a school',         NULL, false, 3),
  ('trial',   '\u8bd5\u7528\u7248', 'Trial',             'Prova',            'Premium for 14 days',      14,   false, 4)
ON CONFLICT (slug) DO UPDATE
  SET label_zh = EXCLUDED.label_zh, label_en = EXCLUDED.label_en,
      label_it = EXCLUDED.label_it, description = EXCLUDED.description,
      expires_after_days = EXCLUDED.expires_after_days,
      sort_order = EXCLUDED.sort_order;

-- 6. Seed CLF community modules + heritage (public)
INSERT INTO clf_modules (slug, label_zh, label_en, label_it, description, route, icon, color, is_public, sort_order)
VALUES
  ('characters', '\u6c49\u5b57',         'Characters',         'Caratteri',  '\u8ba4\u8bc6\u6c49\u5b57', '/community/characters', '\u5b57', '#E53935', false, 1),
  ('pinyin',     '\u62fc\u97f3',         'Pinyin',             'Pinyin',     '\u62fc\u97f3\u53d1\u97f3', '/community/pinyin',     '\u97f3', '#1565C0', false, 2),
  ('words',      '\u8bcd\u8bed',         'Vocabulary',         'Vocabolario','\u6309\u4e3b\u9898\u5b66\u8bcd\u6c47', '/community/words',      '\u8bcd', '#1565C0', false, 3),
  ('grammar',    '\u8bed\u6cd5',         'Grammar',            'Grammatica', '\u8bed\u6cd5\u4e0e\u7ec3\u4e60', '/community/grammar',    '\u6cd5', '#6A1B9A', false, 4),
  ('idioms',     '\u6210\u8bed',         'Idioms',             'Proverbi',   '\u6210\u8bed\u6545\u4e8b', '/community/idioms',     '\u6210', '#8B4513', false, 5),
  ('poems',      '\u8bd7\u6b4c',         'Poetry',             'Poesia',     '\u8bd7\u6b4c\u9605\u8bfb', '/community/poems',      '\u8bd7', '#C8972A', false, 6),
  ('stories',    '\u6545\u4e8b',         'Stories',            'Storie',     '\u6545\u4e8b\u9605\u8bfb', '/community/stories',    '\u6545', '#2E7D32', false, 7),
  ('dialogue',   '\u573a\u666f\u5bf9\u8bdd', 'Scene dialogue',  'Dialoghi',   '\u4e0eAI\u5bf9\u8bdd',     '/community/dialogue',   '\u8bdd', '#1D9E75', false, 8),
  ('storyhub',   '\u6545\u4e8b\u6c47',   'Story hub',          'Storie',     'AI \u751f\u6210\u6545\u4e8b', '/community/storyhub',   '\u6c47', '#534AB7', false, 9),
  ('heritage',   '\u975e\u9057',         'Intangible heritage','Patrimonio', '\u4e2d\u534e\u975e\u7269\u8d28\u6587\u5316\u9057\u4ea7', '{HERITAGE_PATH}', '\u9057', '#a0522d', true, 10)
ON CONFLICT (slug) DO UPDATE
  SET label_zh = EXCLUDED.label_zh, label_en = EXCLUDED.label_en,
      label_it = EXCLUDED.label_it, description = EXCLUDED.description,
      route = EXCLUDED.route, icon = EXCLUDED.icon, color = EXCLUDED.color,
      is_public = EXCLUDED.is_public,
      sort_order = EXCLUDED.sort_order;

-- 7. Tier defaults (free = characters+pinyin only; premium/school/trial = all NON-public modules)
WITH free_tier AS (SELECT id FROM clf_tiers WHERE slug = 'free'),
     basic AS (SELECT id FROM clf_modules WHERE slug IN ('characters', 'pinyin'))
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT free_tier.id, basic.id FROM free_tier, basic
ON CONFLICT DO NOTHING;

WITH full_tiers AS (SELECT id FROM clf_tiers WHERE slug IN ('premium','school','trial')),
     all_mods AS (SELECT id FROM clf_modules WHERE is_active = true AND is_public = false)
INSERT INTO clf_tier_modules (tier_id, module_id)
SELECT full_tiers.id, all_mods.id FROM full_tiers, all_mods
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
CREATE POLICY "super_admin write tiers" ON clf_tiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write modules" ON clf_modules;
CREATE POLICY "super_admin write modules" ON clf_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "super_admin write links" ON clf_tier_modules;
CREATE POLICY "super_admin write links" ON clf_tier_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM clf_user_profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Sanity
SELECT 'tiers'         AS what, count(*) FROM clf_tiers
UNION ALL SELECT 'modules',     count(*) FROM clf_modules
UNION ALL SELECT 'public_mods', count(*) FROM clf_modules WHERE is_public = true
UNION ALL SELECT 'free_links',  count(*) FROM clf_tier_modules WHERE tier_id = (SELECT id FROM clf_tiers WHERE slug='free');
'''

(ROOT / "supabase_migrations").mkdir(parents=True, exist_ok=True)
(ROOT / "supabase_migrations" / "phase_a_tiers.sql").write_text(SQL, encoding="utf-8")
print("  wrote  supabase_migrations/phase_a_tiers.sql")

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
    window.location.replace(ROLE_HOME[user.role] || '/community');
  }, [loading, user]);
  return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>Redirecting\u2026</div>;
}
'''

files["src/auth/RoleRedirectGate.jsx"] = '''import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RoleRedirect from './RoleRedirect';

export default function RoleRedirectGate() {
  return (
    <LanguageProvider><AuthProvider><RoleRedirect /></AuthProvider></LanguageProvider>
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
  if (loading || !user) return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>\u00b7\u00b7\u00b7</div>;
  if (!allow.includes(user.role)) {
    return (
      <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex',
        alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
        <div>
          <div style={{ fontSize:48, marginBottom:12 }}>\U0001F6AB</div>
          <div style={{ fontSize:18, color:'#8B4513', marginBottom:6 }}>
            \u6743\u9650\u4e0d\u8db3 \u00B7 Access denied
          </div>
          <a href="/" style={{ color:'#c41e3a', border:'1px solid #c41e3a',
            borderRadius:6, padding:'6px 14px', textDecoration:'none', fontSize:13 }}>\u2190 Home</a>
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
          <Routes><Route path="/*" element={<PostLoginRedirect />} /></Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

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
            .from('clf_tiers').select('*').eq('slug', 'free').maybeSingle();
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

# ---- Community module grid ----
files["src/community/CommunityApp.jsx"] = '''import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import { useUserTier } from '../auth/useUserTier';

function CommunityHome() {
  const { user, loading: authLoading } = useAuth();
  const { tier, modules, loading } = useUserTier();
  const [lang, setLang] = React.useState('zh');
  if (authLoading || loading) return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>\u00b7\u00b7\u00b7</div>;
  const t = (zh, en, it) => lang==='en' ? en : lang==='it' ? it : zh;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>
      <header style={{ background:'#c41e3a', color:'#fff', padding:'18px 20px',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700,
            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}>
            {t('\u793e\u533a','Community','Comunit\u00e0')}
          </div>
          <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>
            {tier ? (lang==='zh'?tier.label_zh:lang==='it'?(tier.label_it||tier.label_en):tier.label_en) : ''}
            {user ? ' \u00B7 '+(user.name || user.email) : ''}
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
            {t('\u60a8\u7684\u7b49\u7ea7\u6682\u65e0\u6a21\u5757\u3002',
               'No modules in your tier yet.',
               'Nessun modulo disponibile.')}
          </div>
        ) : (
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14 }}>
            {modules.map(m => (
              <button key={m.id} onClick={() => window.location.href = m.route} style={{
                background:'#fff', border:`1.5px solid ${m.color||'#c41e3a'}33`,
                borderRadius:14, padding:'16px 14px', cursor:'pointer', textAlign:'left',
              }}>
                <div style={{
                  width:44, height:44, borderRadius:12,
                  background:(m.color||'#c41e3a')+'15', color: m.color||'#c41e3a',
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
          <Routes><Route path="/*" element={<CommunityHome />} /></Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- HERITAGE: PUBLIC, no AuthProvider ----
files["src/heritage/HeritageApp.jsx"] = f'''import React from 'react';
import {{ BrowserRouter, Routes, Route }} from 'react-router-dom';
import {{ LanguageProvider }} from '../school/contexts/LanguageContext';

const CATEGORIES = [
  {{ slug:'folklore',  label_zh:'\u6c11\u4fd7\u6545\u4e8b', label_en:'Folklore',  label_it:'Folclore',    icon:'\u4fd7', color:'#a0522d',
    desc_zh:'\u4f20\u7edf\u6c11\u95f4\u4f20\u8bf4', desc_en:'Folk legends', desc_it:'Leggende popolari' }},
  {{ slug:'opera',     label_zh:'\u4f20\u7edf\u620f\u66f2', label_en:'Opera',     label_it:'Opera',       icon:'\u620f', color:'#c41e3a',
    desc_zh:'\u6606\u66f2\u3001\u4eac\u5267\u3001\u5404\u5730\u620f\u79cd', desc_en:'Kunqu, Beijing opera, regional opera', desc_it:'Kunqu, opera di Pechino' }},
  {{ slug:'crafts',    label_zh:'\u6c11\u95f4\u5de5\u827a', label_en:'Crafts',    label_it:'Artigianato', icon:'\u5de5', color:'#8b4513',
    desc_zh:'\u9ed8\u753b\u3001\u5256\u7ea2\u3001\u5256\u5236', desc_en:'Embroidery, paper-cutting, pottery', desc_it:'Ricamo, taglio carta, ceramica' }},
  {{ slug:'festivals', label_zh:'\u8282\u5e86\u6587\u5316', label_en:'Festivals', label_it:'Feste',       icon:'\u5e86', color:'#d4a017',
    desc_zh:'\u4f20\u7edf\u8282\u65e5\u4e0e\u4eea\u5f0f', desc_en:'Traditional festivals and rituals', desc_it:'Feste e rituali tradizionali' }},
];

function HeritageHome() {{
  const [lang, setLang] = React.useState('zh');
  const t = (zh, en, it) => lang==='en' ? en : lang==='it' ? it : zh;

  return (
    <div style={{{{
      minHeight:'100dvh',
      background:'linear-gradient(160deg, #fef9ee 0%, #fdf6e3 50%, #fde9c8 100%)',
    }}}}>
      <header style={{{{
        background:'#a0522d', color:'#fff', padding:'24px 20px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}}}>
        <div>
          <div style={{{{ fontSize:24, fontWeight:700,
            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:3 }}}}>
            \u975e\u9057
          </div>
          <div style={{{{ fontSize:12, opacity:0.9, marginTop:4 }}}}>
            {{t('\u4e2d\u534e\u975e\u7269\u8d28\u6587\u5316\u9057\u4ea7',
                'Chinese Intangible Cultural Heritage',
                'Patrimonio Culturale Immateriale Cinese')}}
          </div>
        </div>
        <div style={{{{ display:'flex', gap:6, alignItems:'center' }}}}>
          {{['zh','en','it'].map(l => (
            <button key={{l}} onClick={{() => setLang(l)}} style={{{{
              padding:'4px 10px', borderRadius:6, fontSize:12, cursor:'pointer',
              background: lang===l?'#fff':'transparent',
              color: lang===l?'#a0522d':'#fff',
              border:'1px solid rgba(255,255,255,0.4)',
            }}}}>{{l.toUpperCase()}}</button>
          ))}}
          <a href="/" style={{{{
            marginLeft:8, padding:'5px 12px', borderRadius:6,
            background:'transparent', color:'#fff',
            border:'1px solid rgba(255,255,255,0.4)',
            textDecoration:'none', fontSize:12,
          }}}}>{{t('\u9996\u9875','Home','Home')}}</a>
        </div>
      </header>

      <div style={{{{ maxWidth:960, margin:'0 auto', padding:'32px 20px' }}}}>
        <div style={{{{
          background:'rgba(255,255,255,0.7)', backdropFilter:'blur(8px)',
          borderRadius:16, padding:'20px 24px', marginBottom:24,
          border:'1px solid #e8d5b0',
        }}}}>
          <div style={{{{ fontSize:14, lineHeight:1.8, color:'#3d2410' }}}}>
            {{t(
              '\u975e\u7269\u8d28\u6587\u5316\u9057\u4ea7\u662f\u4eba\u7c7b\u53e3\u53e3\u76f8\u4f20\u3001\u4ee3\u4ee3\u76f8\u627f\u7684\u751f\u6d3b\u667a\u6167\u4e0e\u827a\u672f\u5f62\u5f0f\u3002\u8fd9\u91cc\u6536\u96c6\u4e2d\u534e\u4f20\u7edf\u6587\u5316\u4e2d\u7684\u591a\u4e2a\u4e3b\u9898\uff0c\u4f9b\u6240\u6709\u4eba\u81ea\u7531\u6d4f\u89c8\u5b66\u4e60\u3002',
              'Intangible cultural heritage is the living wisdom and art forms passed down through generations. This section gathers themes from Chinese traditional culture, freely accessible to all.',
              'Il patrimonio culturale immateriale comprende la saggezza viva e le forme artistiche tramandate di generazione in generazione. Questa sezione raccoglie temi della cultura tradizionale cinese, liberamente accessibili a tutti.'
            )}}
          </div>
        </div>

        <div style={{{{ display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:16 }}}}>
          {{CATEGORIES.map(c => (
            <div key={{c.slug}} style={{{{
              background:'#fff', borderRadius:14, padding:20,
              border:`1.5px solid ${{c.color}}33`,
              boxShadow:`0 2px 8px ${{c.color}}10`,
            }}}}>
              <div style={{{{
                width:52, height:52, borderRadius:14,
                background: c.color+'18', color: c.color,
                fontSize:28, fontWeight:700,
                fontFamily:"'STKaiti','KaiTi',serif",
                display:'flex', alignItems:'center', justifyContent:'center',
                marginBottom:12,
              }}}}>{{c.icon}}</div>
              <div style={{{{ fontSize:17, fontWeight:600, color:'#3d2410',
                fontFamily:"'STKaiti','KaiTi',serif" }}}}>
                {{lang==='zh'?c.label_zh:lang==='it'?c.label_it:c.label_en}}
              </div>
              <div style={{{{ fontSize:12, color:'#73522d', marginTop:6, lineHeight:1.6 }}}}>
                {{lang==='zh'?c.desc_zh:lang==='it'?c.desc_it:c.desc_en}}
              </div>
              <div style={{{{ fontSize:11, color:'#a0522d', marginTop:14,
                fontStyle:'italic' }}}}>
                {{t('\u5185\u5bb9\u5efa\u8bbe\u4e2d\u00b7\u00b7\u00b7','Content coming soon\u00b7\u00b7\u00b7','In arrivo\u00b7\u00b7\u00b7')}}
              </div>
            </div>
          ))}}
        </div>

        <div style={{{{
          marginTop:36, textAlign:'center', fontSize:12, color:'#a0522d',
          padding:'20px 0',
        }}}}>
          {{t(
            '\u516c\u76ca\u8d44\u6e90\u00b7\u514d\u8d39\u5f00\u653e\u00b7\u65e0\u9700\u6ce8\u518c',
            'Public resource \u00B7 Free access \u00B7 No login required',
            'Risorsa pubblica \u00B7 Accesso libero \u00B7 Nessuna registrazione'
          )}}
        </div>
      </div>
    </div>
  );
}}

export default function HeritageApp() {{
  return (
    <LanguageProvider>
      <BrowserRouter basename="{HERITAGE_PATH}">
        <Routes><Route path="/*" element={{<HeritageHome />}} /></Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}}
'''

# ---- TiersAdminApp ----
files["src/tiers-admin/TiersAdminApp.jsx"] = '''import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import { supabase } from '../school/services/supabase';
import RequireRole from '../auth/RequireRole';

function TiersAdmin() {
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
      setTiers(t.data || []); setModules(m.data || []); setLinks(linkMap);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (tierId, moduleId, isPublic) => {
    if (isPublic) return;
    const k = `${tierId}:${moduleId}`;
    setSaving(k);
    try {
      const has = links[tierId]?.has(moduleId);
      if (has) {
        await supabase.from('clf_tier_modules').delete().match({ tier_id: tierId, module_id: moduleId });
      } else {
        await supabase.from('clf_tier_modules').insert({ tier_id: tierId, module_id: moduleId });
      }
      setLinks(prev => {
        const next = { ...prev };
        next[tierId] = new Set(prev[tierId] || []);
        if (has) next[tierId].delete(moduleId); else next[tierId].add(moduleId);
        return next;
      });
    } catch (e) { alert('Save failed: '+e.message); } finally { setSaving(null); }
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
                    <div style={{ fontSize:11, color:'#a07850', fontWeight:400 }}>{t.label_en}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(m => (
                <tr key={m.id}>
                  <td style={td}>
                    <div style={{ fontWeight:500 }}>
                      {m.label_zh}
                      {m.is_public && <span style={{
                        marginLeft:8, fontSize:10, padding:'2px 6px',
                        background:'#a0522d', color:'#fff', borderRadius:4,
                      }}>PUBLIC</span>}
                    </div>
                    <div style={{ fontSize:11, color:'#a07850' }}>{m.label_en} \u00B7 {m.slug}</div>
                  </td>
                  {tiers.map(t => {
                    const has = m.is_public || links[t.id]?.has(m.id);
                    const k   = `${t.id}:${m.id}`;
                    return (
                      <td key={t.id} style={{ ...td, textAlign:'center' }}>
                        <button onClick={() => toggle(t.id, m.id, m.is_public)}
                          disabled={saving === k || m.is_public}
                          title={m.is_public ? 'Public modules are visible to all tiers' : ''}
                          style={{
                            width:32, height:32, borderRadius:6,
                            background: has ? (m.is_public?'#a0522d':'#10b981') : '#fff',
                            border: has ? 'none' : '1px solid #e8d5b0',
                            color: has ? '#fff' : '#a07850',
                            cursor: m.is_public?'default':saving===k?'wait':'pointer',
                            fontSize:14,
                          }}>{has ? '\u2713' : ''}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:16, fontSize:11, color:'#a07850' }}>
          \u70b9\u51fb\u5355\u5143\u683c\u5207\u6362\u5141\u8bb8\u00B7 Click any cell to toggle.
          \u516c\u5f00\u6a21\u5757\u5bf9\u6240\u6709\u7528\u6237\u53ef\u89c1\u00B7 PUBLIC modules visible to all.
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
              <RequireRole allow={['super_admin']}><TiersAdmin /></RequireRole>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
'''

# ---- Role placeholders ----
def role_app(role_name, basename, label_zh, label_en, allow_roles):
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
        fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}}}>{label_zh}</div>
      <div style={{{{ fontSize:14, color:'#a07850' }}}}>
        {label_en} \u00B7 {{user?.name || user?.email}}
      </div>
      <div style={{{{ fontSize:12, color:'#a07850', marginTop:8 }}}}>
        Role: <code>{{user?.role}}</code> \u00B7 Phase B builds the dashboard here.
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
          <Routes><Route path="/*" element={{
            <RequireRole allow={{{allow_roles!r}}}><{role_name}Placeholder /></RequireRole>
          }} /></Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}}
'''

files["src/teacher/TeacherApp.jsx"] = role_app(
    "Teacher", "teacher", "\u6559\u5e08\u5de5\u4f5c\u53f0", "Teacher Workspace",
    ["super_admin", "teacher"])
files["src/school-master/SchoolMasterApp.jsx"] = role_app(
    "SchoolMaster", "school-master", "\u6821\u957f\u4e2d\u5fc3", "School Master",
    ["super_admin", "school_master"])
files["src/student/StudentApp.jsx"] = role_app(
    "Student", "student", "\u5b66\u4e60\u4e2d\u5fc3", "Student",
    ["super_admin", "school_master", "teacher", "student"])
files["src/parent/ParentApp.jsx"] = role_app(
    "Parent", "parent", "\u5bb6\u957f\u4e2d\u5fc3", "Parent",
    ["super_admin", "school_master", "teacher", "parent"])

# ---- Write all ----
print(f"\n=== Writing {len(files)} code files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  wrote  {rel}")

assert "\u975e\u9057" in (ROOT / "src/heritage/HeritageApp.jsx").read_text(encoding="utf-8")
print("  OK -- Chinese chars preserved")

# ============================================================
# Patch App.jsx
# ============================================================
print("\n=== Patching src/App.jsx ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")
orig = src

new_imports = """import LoginGate         from './auth/LoginGate.jsx';
import RoleRedirectGate from './auth/RoleRedirectGate.jsx';
import HeritageApp      from './heritage/HeritageApp.jsx';
import CommunityApp     from './community/CommunityApp.jsx';
import TiersAdminApp    from './tiers-admin/TiersAdminApp.jsx';
import TeacherApp       from './teacher/TeacherApp.jsx';
import SchoolMasterApp  from './school-master/SchoolMasterApp.jsx';
import StudentApp       from './student/StudentApp.jsx';
import ParentApp        from './parent/ParentApp.jsx';
"""

if "from './auth/LoginGate.jsx'" not in src:
    km = "import KechuangApp from './kechuang/KechuangApp.jsx';"
    if km in src:
        src = src.replace(km, km + "\n" + new_imports.rstrip())
        print("  added 9 imports")
    else:
        print("  WARN: KechuangApp import not found")
else:
    if "HeritageApp" not in src:
        # Old installer ran without heritage; add just the heritage import
        src = src.replace(
            "import LoginGate         from './auth/LoginGate.jsx';",
            "import LoginGate         from './auth/LoginGate.jsx';\nimport HeritageApp      from './heritage/HeritageApp.jsx';"
        )
        print("  added HeritageApp import (others already present)")
    else:
        print("  imports already present")

# Flag block
new_flags = f"""const IS_LOGIN          = window.location.pathname.startsWith('/login');
const IS_ROLE_REDIRECT  = window.location.pathname.startsWith('/role-redirect');
const {HERITAGE_FLAG_NAME}      = window.location.pathname.startsWith('{HERITAGE_PATH}');
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
        print(f"  added 9 IS_* flags ({HERITAGE_FLAG_NAME} included)")
else:
    if HERITAGE_FLAG_NAME not in src:
        src = src.replace(
            "const IS_LOGIN          = window.location.pathname.startsWith('/login');",
            f"const IS_LOGIN          = window.location.pathname.startsWith('/login');\nconst {HERITAGE_FLAG_NAME}      = window.location.pathname.startsWith('{HERITAGE_PATH}');"
        )
        print(f"  added {HERITAGE_FLAG_NAME} flag")
    else:
        print("  IS_* flags already present")

# Strip leftovers from previous installer iterations
src = re.sub(r"\nconst IS_SCHOOL\s*=\s*window\.location\.pathname\.startsWith\('/school'\);\s*", "\n", src)
src = re.sub(r"import SchoolApp\s+from\s+'\./school/SchoolApp\.jsx';\s*\n", "", src)
src = re.sub(r":\s*IS_SCHOOL\s*\?\s*<SchoolApp\s*/>\s*\n\s*", "", src)

# Routing branches
ok = ": IS_KECHUANG ? <LanguageProvider><KechuangApp/></LanguageProvider>"
new_branches = (
    ": IS_LOGIN          ? <LoginGate/>\n        "
    ": IS_ROLE_REDIRECT  ? <RoleRedirectGate/>\n        "
    f": {HERITAGE_FLAG_NAME}      ? <HeritageApp/>\n        "
    ": IS_COMMUNITY      ? <CommunityApp/>\n        "
    ": IS_TIERS_ADMIN    ? <TiersAdminApp/>\n        "
    ": IS_TEACHER        ? <TeacherApp/>\n        "
    ": IS_SCHOOL_MASTER  ? <SchoolMasterApp/>\n        "
    ": IS_STUDENT        ? <StudentApp/>\n        "
    ": IS_PARENT         ? <ParentApp/>\n        "
)

if ok in src and "<TeacherApp/>" not in src:
    src = src.replace(ok, new_branches + ok)
    print("  added 9 routing branches")
elif "<HeritageApp/>" not in src and "<TeacherApp/>" in src:
    # Earlier v1 ran without heritage; insert just heritage branch
    src = src.replace(
        ": IS_LOGIN          ? <LoginGate/>",
        ": IS_LOGIN          ? <LoginGate/>\n        "
        f": {HERITAGE_FLAG_NAME}      ? <HeritageApp/>"
    )
    print("  added HeritageApp branch (others already present)")
else:
    print("  routing branches already present")

# ---- Patch MainEntrance.jsx 非遗 button to navigate to /intangible-heritage ----
mainent = ROOT / "src" / "components" / "MainEntrance.jsx"
if mainent.exists():
    me = mainent.read_text(encoding="utf-8")
    me_orig = me
    # The 非遗 card has onClick={() => alert(...)} -- replace with navigation
    me = re.sub(
        r"onClick=\{\(\) => alert\(t\([^)]*\u975e\u9057[^)]*\)\)\}",
        f"onClick={{() => {{ window.location.href = '{HERITAGE_PATH}'; }}}}",
        me
    )
    # Fallback: catch any alert with "Heritage section" text or similar
    if me == me_orig:
        me = re.sub(
            r"onClick=\{\(\) => alert\(t\(\s*['\"][^'\"]*\u975e\u9057[^'\"]*['\"]",
            f"onClick={{() => {{ window.location.href = '{HERITAGE_PATH}'; }} /* alert(t(",
            me
        )
    # Also try matching by Heritage / 非遗 / Patrimonio in the alert
    if me == me_orig:
        # Find the 非遗 DoorCard and patch its onClick
        me = re.sub(
            r"(emoji=\"\U0001F3EE\"[\s\S]*?onClick=\{)\(\) => alert\([^}]*\}\)\}",
            r"\1() => { window.location.href = '" + HERITAGE_PATH + "'; }}",
            me
        )

    if me != me_orig:
        mainent.write_text(me, encoding="utf-8")
        print(f"  patched MainEntrance.jsx \u975e\u9057 button -> {HERITAGE_PATH}")
    else:
        print(f"  WARN: couldn't auto-patch MainEntrance.jsx \u975e\u9057 button -- patch manually:")
        print(f"        change onClick on the \u975e\u9057 DoorCard to:")
        print(f"          onClick={{() => {{ window.location.href = '{HERITAGE_PATH}'; }}}}")

if src != orig:
    app.write_text(src, encoding="utf-8")
    print("  App.jsx written")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = app.read_text(encoding="utf-8")
markers = ["IS_LOGIN", HERITAGE_FLAG_NAME, "IS_COMMUNITY", "IS_TEACHER",
           "<LoginGate/>", "<HeritageApp/>", "<CommunityApp/>", "<TeacherApp/>"]
for m in markers:
    n = sum(1 for line in final.split("\n") if m in line)
    print(f"  [{'OK' if n else 'MISSING'}] {m}: {n}")

if "<SchoolApp" in final or re.search(r"const IS_SCHOOL\s*=", final):
    print("  WARN: leftover SchoolApp / IS_SCHOOL still in App.jsx")

# ============================================================
# DONE
# ============================================================
print("\n=== DONE ===")
print()
print("Routing:")
print(f"  {HERITAGE_PATH}  -> public, no login (HeritageApp)")
print("  /              -> CLF home")
print("  /login         -> David-Chinese login")
print("  /role-redirect -> dispatch by role")
print("  /admin         -> existing AdminApp")
print("  /tiers-admin   -> matrix UI (super_admin)")
print("  /community     -> tier-filtered modules")
print("  /teacher /school-master /student /parent -> placeholders")
print()
print("NEXT STEPS:")
print()
print("  1. Run SQL in Supabase:")
print("       Open SQL editor for yqcojudvvjntaajnrilr")
print("       Paste supabase_migrations/phase_a_tiers.sql")
print("       Sanity should show: tiers=4, modules=10, public_mods=1")
print()
print("  2. Local test:")
print("       npm run dev")
print(f"       /                    -> CLF entrance (\u975e\u9057 button -> {HERITAGE_PATH})")
print(f"       {HERITAGE_PATH}  -> public page (no login required)")
print("       /login                -> David-Chinese login")
print("       (log in) -> role redirect -> your panel")
print("       /tiers-admin          -> matrix UI (need super_admin)")
print()
print("  3. Deploy:")
print("       npm run build")
print("       netlify deploy --prod --dir dist --no-build")
