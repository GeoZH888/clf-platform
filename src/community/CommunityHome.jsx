// src/community/CommunityHome.jsx
// Public home for 中文世界 (allinone site). 社区 is the only pillar now — the
// page header drops straight into the module grid, no DoorCard step. Signed-in
// users get a 我的 button in the header that toggles the PersonalDashboard
// inline below the grid.
// 教学 → david-zhongwen.net (separate site).  HSK → hsk-levelup.netlify.app.
// 非遗 → feiyipedia.ci-world.com.  游戏 is a 社区 tile (riddles).
import React, { useEffect, useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { useLanguage } from '../school/contexts/LanguageContext';
import PersonalDashboard from './dashboard/PersonalDashboard';
import { supabase } from '../school/services/supabase';
import { MODULES, ALWAYS_ON, STANDARD_BUNDLE, moduleLabel } from '../config/modules';
import { usePhone } from '../hooks/useMediaQuery';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Tile palette — keyed by module category. Soft tints harmonize with the cream
// page background; the accent is used for label + border + hover glow so each
// tile reads instantly as 学习 / 文化 / 练习 without needing a legend.
const CATEGORY_PALETTE = {
  learning: { tint: '#ecfdf5', accent: '#0d9488', soft: '#a7f3d0' }, // teal — study
  games:    { tint: '#ffe4e6', accent: '#be123c', soft: '#fecdd3' }, // rose — play
  cultural: { tint: '#fef3c7', accent: '#b45309', soft: '#fcd34d' }, // amber — heritage
  practice: { tint: '#ede9fe', accent: '#6d28d9', soft: '#c4b5fd' }, // violet — conversation
  core:     { tint: '#dbeafe', accent: '#1d4ed8', soft: '#93c5fd' }, // blue — nav
  future:   { tint: '#f3f4f6', accent: '#6b7280', soft: '#d1d5db' }, // gray — placeholder
};
const paletteFor = (cat) => CATEGORY_PALETTE[cat] || CATEGORY_PALETTE.core;

// Section order for 分组 layout. Anything with a category not listed here still
// renders, in a trailing group — so a new category can't silently vanish.
const CATEGORY_ORDER = ['learning', 'games', 'cultural', 'practice'];
const CATEGORY_ICON  = { learning:'📚', games:'🎮', cultural:'🎋', practice:'💬' };

// Layout preference. Kept in localStorage rather than clf_user_profiles: it needs
// to work for signed-out visitors too, and adding a profile column would mean a
// migration that must be run before this deploys. Trade-off is that the choice
// does not follow a user across devices.
const LAYOUT_KEY = 'clf_module_layout';
function loadLayout() {
  const v = localStorage.getItem(LAYOUT_KEY);
  return v === 'flat' || v === 'grouped' ? v : 'grouped';
}

const ROUTES = {
  home:'/', profile:'/profile', progress:'/progress',
  // Learning modules — deep-link into UserApp via /learn?module=X.
  // App.jsx mounts <UserApp/> on /learn and reads the ?module param to set
  // the initial screen. Keep these in sync with App.jsx's UserApp screens.
  lianzi:  '/learn?module=lianzi',
  words:   '/learn?module=words',
  pinyin:  '/learn?module=pinyin',
  chengyu: '/learn?module=chengyu',
  poetry:  '/learn?module=poetry',
  grammar: '/learn?module=grammar',
  riddles: '/learn?module=riddles',
  radicals:'/learn?module=radicals',
  compose: '/learn?module=compose',
  radicalmatch:'/learn?module=radicalmatch',
  pinyinmatch: '/learn?module=pinyinmatch',
  dictation:  '/learn?module=dictation',
  completion: '/learn?module=completion',
  chain:      '/learn?module=chain',
  scenario:'/learn?module=scenario',
  story:   '/learn?module=story',
  // A built app that no tile pointed at until now — it has its own route
  // rather than living inside UserApp.
  knowledge:'/knowledge-map',
  // Separate products on their own domains — see `external` in modules.js.
  feiyi:'https://feiyipedia.ci-world.com',
  hsk:'https://hsk-levelup.netlify.app',
  hanzi:'https://hanzi.ci-world.com',
  // Moved off 問骨 onto its own deployment. The old /classics path is gone
  // from that site, so this would 404 if left pointing there.
  sishuwujing:'https://sishu-wujing.netlify.app',
  // Non-learning links — leave as before until those routes are built
  lessons:'/lessons',
  // 语音评测 is a UserApp screen like the other learning modules, not a route
  // of its own — /voice was never served and would have 404'd.
  voice:'/learn?module=voice',
  chat:'/chat', homework:'/homework', shop:'/shop', parents:'/parents',
};

// Home-only string bundle. We don't add these to LanguageContext because they
// don't fit the existing namespaces (nav/dashboard/admin/...) and they'd grow
// that file unnecessarily. Reference like `tr(L, 'visitor')`.
const HOME_STRINGS = {
  site_title:  { zh: '中文世界',           en: 'Chinese World',        it: 'Mondo Cinese' },
  visitor:     { zh: '欢迎访客 · Visitor', en: 'Welcome, visitor',     it: 'Benvenuto, visitatore' },
  visitor_tag: { zh: '访客',               en: 'visitor',              it: 'visitatore' },
  modules:     { zh: '可用模块',           en: 'Modules',              it: 'Moduli' },
  // Layout switcher + 分组 section headings.
  lay_grouped: { zh: '分组',               en: 'Grouped',              it: 'Gruppi' },
  lay_flat:    { zh: '平铺',               en: 'All icons',            it: 'Tutte' },
  cat_learning:{ zh: '学习',               en: 'Learning',             it: 'Studio' },
  cat_games:   { zh: '游戏',               en: 'Games',                it: 'Giochi' },
  cat_cultural:{ zh: '文化',               en: 'Culture',              it: 'Cultura' },
  cat_practice:{ zh: '练习',               en: 'Practice',             it: 'Pratica' },
  my_records:  { zh: '我的',               en: 'My',                   it: 'Personale' },
  my_panel:    { zh: '我的学习记录',       en: 'My learning records',  it: 'I miei progressi' },
  login:       { zh: '登录',               en: 'Log in',               it: 'Accedi' },
  logout:      { zh: '退出',               en: 'Log out',              it: 'Esci' },
  empty:       { zh: '还没有开启任何模块。请联系管理员分配。',
                 en: 'No modules enabled yet. Please contact admin.',
                 it: 'Nessun modulo attivo. Contatta l\'admin.' },
  // Role labels — keyed by user.role enum.
  super_admin:    { zh: '超级管理员', en: 'Super admin',    it: 'Super admin' },
  admin:          { zh: '管理员',     en: 'Admin',          it: 'Admin' },
  school_master:  { zh: '校长',       en: 'Principal',      it: 'Direttore' },
  teacher:        { zh: '教师',       en: 'Teacher',        it: 'Insegnante' },
  student:        { zh: '学生',       en: 'Student',        it: 'Studente' },
  parent:         { zh: '家长',       en: 'Parent',         it: 'Genitore' },
};
function tr(L, key) {
  const code = L === 'en' || L === 'it' || L === 'zh' ? L : 'zh';
  return HOME_STRINGS[key]?.[code] ?? HOME_STRINGS[key]?.zh ?? key;
}
// Section heading for a category. Unknown categories fall back to their raw id
// rather than showing a missing translation key.
function catLabel(L, cat) {
  return HOME_STRINGS[`cat_${cat}`] ? tr(L, `cat_${cat}`) : cat;
}

export default function CommunityHome() {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const isPhone = usePhone();
  const [allowedIds, setAllowedIds] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [institution, setInstitution] = useState(null);
  const [moduleOrder, setModuleOrder] = useState(null);  // custom drag order (array of ids)
  const [layout, setLayout] = useState(loadLayout);      // 'grouped' | 'flat'

  function chooseLayout(next) {
    setLayout(next);
    try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* private mode */ }
  }

  // Drag sensors: mouse needs an 8px move before dragging (so taps still click);
  // touch needs a 220ms long-press (so scroll/tap still work, drag is deliberate).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  useEffect(() => {
    // Anonymous visitor: show the standard module bundle, no profile lookup.
    if (!user?.id) {
      setAllowedIds(STANDARD_BUNDLE);
      return;
    }
    (async () => {
      if (user.role === 'super_admin') {
        setAllowedIds(MODULES.map(m => m.id));
        // super_admin still gets a saved order if present
        try {
          const { data: p } = await supabase
            .from('clf_user_profiles')
            .select('module_order')
            .eq('user_id', user.id)
            .maybeSingle();
          if (p?.module_order && Array.isArray(p.module_order)) setModuleOrder(p.module_order);
        } catch { /* ignore */ }
        return;
      }
      try {
        const { data: profileData } = await supabase
          .from('clf_user_profiles')
          .select('institution_name, institution_logo_url, module_order')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profileData) {
          setInstitution({
            name: profileData.institution_name,
            logo: profileData.institution_logo_url,
          });
          if (profileData.module_order && Array.isArray(profileData.module_order)) {
            setModuleOrder(profileData.module_order);
          }
        }
        const { data } = await supabase
          .from('clf_user_modules')
          .select('module_id, available, selected')
          .eq('user_id', user.id);
        const overrides = {};
        // A module is enabled iff BOTH admin made it available AND user kept
        // it selected. Either being explicitly false hides the module.
        // Treat null/undefined as the column's DB default (true).
        (data || []).forEach(r => {
          const available = r.available !== false;
          const selected  = r.selected  !== false;
          overrides[r.module_id] = available && selected;
        });
        const allowed = MODULES.filter(m => {
          if (!m.gateable) return true;
          if (m.id in overrides) return overrides[m.id];
          return m.defaultEnabled;
        }).map(m => m.id);
        setAllowedIds(allowed);
      } catch (e) {
        console.warn('[CommunityHome]', e);
        setAllowedIds(ALWAYS_ON);
      }
    })();
  }, [user?.id, user?.role]);

  const myRole = user?.role;

  // Learner tiles only. Staff-facing entries (the teacher results portal) live
  // in the same registry so they are declared once, but this is the community
  // grid — a superadmin browsing it should still see the learner's app, not a
  // mixture of both. Their own tools are in /admin and the teaching panels.
  const visibleModules = allowedIds
    ? MODULES.filter(m =>
        allowedIds.includes(m.id) &&
        m.category !== 'future' &&
        (m.audience || 'learner') === 'learner')
    : [];
  // Pillar-based filtering
  const communityModules = visibleModules.filter(m =>
    m.pillar === 'community' || m.pillar === 'home' || m.pillar === 'profile' || m.pillar === 'progress'
  );

  // ── Draggable community tiles ──────────────────────────────────────
  // The tiles shown in the 可用模块 grid (excludes home/profile/progress).
  const baseTiles = communityModules.filter(
    m => !['home', 'profile', 'progress', 'lessons', 'homework'].includes(m.id)
  );
  // Apply the user's saved drag order; any modules not yet in the saved
  // order (e.g. newly enabled) are appended at the end in default order.
  const orderedTiles = (() => {
    if (!moduleOrder) return baseTiles;
    const byId = Object.fromEntries(baseTiles.map(m => [m.id, m]));
    const inOrder = moduleOrder.map(id => byId[id]).filter(Boolean);
    const seen = new Set(moduleOrder);
    const rest = baseTiles.filter(m => !seen.has(m.id));
    return [...inOrder, ...rest];
  })();

  // Persist a new order to clf_user_profiles.module_order for this user.
  async function saveOrder(ids) {
    setModuleOrder(ids);  // optimistic
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('clf_user_profiles')
        .update({ module_order: ids })
        .eq('user_id', user.id);
      if (error) console.warn('[CommunityHome] saveOrder failed:', error);
    } catch (e) {
      console.warn('[CommunityHome] saveOrder error:', e);
    }
  }

  // Tiles bucketed into sections for the 分组 layout. Categories outside
  // CATEGORY_ORDER still render, in a trailing group, so nothing can go missing.
  const groups = (() => {
    const byCat = {};
    orderedTiles.forEach(m => { (byCat[m.category] = byCat[m.category] || []).push(m); });
    const known = CATEGORY_ORDER.filter(c => byCat[c]?.length);
    const extra = Object.keys(byCat).filter(c => !CATEGORY_ORDER.includes(c));
    return [...known, ...extra].map(cat => ({ cat, mods: byCat[cat] }));
  })();

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedTiles.map(m => m.id);
    const from = ids.indexOf(active.id);
    const to   = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    // In 分组 the grid is sorted into sections, so dragging across sections would
    // save an order the view can't show. Only reordering within a section counts.
    if (layout === 'grouped') {
      const byId = Object.fromEntries(orderedTiles.map(m => [m.id, m]));
      if (byId[active.id]?.category !== byId[over.id]?.category) return;
    }
    saveOrder(arrayMove(ids, from, to));
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <header style={{
        padding: isPhone ? '12px 16px' : '18px 24px',
        paddingTop: `calc(${isPhone ? 12 : 18}px + var(--safe-top))`,
        background: 'linear-gradient(90deg, #c41e3a 0%, #8b0000 100%)',
        color: '#fff5e6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10,
      }}>
        {/* min-width:0 lets the flex child shrink so the logout button always fits */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 10 : 14, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isPhone ? 19 : 22, fontWeight: 700,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 4 }}>{tr(language, 'site_title')}</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user
                ? `${user.name || user.email} · ${HOME_STRINGS[myRole] ? tr(language, myRole) : (myRole || tr(language, 'visitor_tag'))}`
                : tr(language, 'visitor')}
            </div>
          </div>
          {institution && (institution.name || institution.logo) && (
            <>
              <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {institution.logo && (
                  <img src={institution.logo} alt=""
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{
                      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                      objectFit: 'cover', background: '#fff',
                    }}/>
                )}
                {institution.name && (
                  <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.95,
                    fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {institution.name}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {user && (
            <button onClick={() => setShowDashboard(v => !v)} style={{
              background: showDashboard ? '#fff5e6' : 'rgba(255,255,255,0.15)',
              color: showDashboard ? '#c41e3a' : '#fff5e6',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '8px 12px', borderRadius: 20,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>🌸</span><span>{tr(language, 'my_records')}</span>
            </button>
          )}
          {user ? (
            <button onClick={logout} style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '8px 14px', borderRadius: 20,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>{tr(language, 'logout')}</button>
          ) : (
            <a href="/login" style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '8px 14px', borderRadius: 20,
              textDecoration: 'none', fontSize: 12, fontWeight: 600,
            }}>{tr(language, 'login')}</a>
          )}
        </div>
      </header>

      <main className="app-container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <section style={{ marginTop: 32 }}>
          {allowedIds === null ? (
            <Loading/>
          ) : communityModules.length === 0 ? (
            <Empty msg={tr(language, 'empty')}/>
          ) : (
            <>
              <LayoutSwitch layout={layout} onChange={chooseLayout} language={language}/>
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}>
                {layout === 'flat' ? (
                  <SortableContext items={orderedTiles.map(m => m.id)}
                    strategy={rectSortingStrategy}>
                    <TileGrid>
                      {orderedTiles.map(m => (
                        <SortableModuleTile key={m.id} mod={m} language={language}/>
                      ))}
                    </TileGrid>
                  </SortableContext>
                ) : (
                  groups.map(g => (
                    <ExpandedSection key={g.cat}
                      color={paletteFor(g.cat).accent}
                      label={`${CATEGORY_ICON[g.cat] || '·'} ${catLabel(language, g.cat)}`}>
                      {/* One SortableContext per section keeps drags inside it. */}
                      <SortableContext items={g.mods.map(m => m.id)}
                        strategy={rectSortingStrategy}>
                        <TileGrid>
                          {g.mods.map(m => (
                            <SortableModuleTile key={m.id} mod={m} language={language}/>
                          ))}
                        </TileGrid>
                      </SortableContext>
                    </ExpandedSection>
                  ))
                )}
              </DndContext>
            </>
          )}
        </section>

        {showDashboard && user && (
          <div style={{
            marginTop: 32,
            padding: 20,
            background: '#fdf2f8',
            border: '1px solid #fbcfe8',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#831843',
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: 2,
            }}>
              <span>🌸</span><span>{tr(language, 'my_panel')}</span>
            </div>
            <PersonalDashboard user={user}/>
          </div>
        )}
      </main>
    </div>
  );
}

function ExpandedSection({ color, label, extras, children }) {
  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1,
          background: `linear-gradient(to right, transparent, ${color}66)` }}/>
        <div style={{ fontSize: 13, color: color, fontWeight: 600, letterSpacing: 3 }}>
          {label}
        </div>
        {extras}
        <div style={{ flex: 1, height: 1,
          background: `linear-gradient(to left, transparent, ${color}66)` }}/>
      </div>
      {children}
    </section>
  );
}

// 分组 / 平铺 switch. Sits above the grid; the choice is per-browser (localStorage).
function LayoutSwitch({ layout, onChange, language }) {
  const opts = [
    { id:'grouped', glyph:'▦', label: tr(language, 'lay_grouped') },
    { id:'flat',    glyph:'⠿', label: tr(language, 'lay_flat')    },
  ];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 4 }}>
      <div style={{ fontSize:12, color:'#a07850', letterSpacing:2, flex:1 }}>
        {tr(language, 'modules')}
      </div>
      <div style={{ display:'flex', background:'#fff', border:'1px solid #e7d8bd',
        borderRadius:20, padding:2, gap:2 }}>
        {opts.map(o => {
          const on = layout === o.id;
          return (
            <button key={o.id} onClick={() => onChange(o.id)}
              style={{ display:'flex', alignItems:'center', gap:5,
                background: on ? '#c41e3a' : 'transparent',
                color: on ? '#fff5e6' : '#a07850',
                border:'none', borderRadius:18, padding:'6px 12px',
                fontSize:12, fontWeight:600, cursor:'pointer',
                transition:'background 0.15s, color 0.15s',
                WebkitTapHighlightColor:'transparent' }}>
              <span style={{ fontSize:13 }}>{o.glyph}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TileGrid({ children }) {
  const isPhone = usePhone();
  return (
    <div style={{
      display: 'grid',
      // Phones: 2-up tiles (130px min fits two columns at ~340px wide with gap).
      // Larger screens: roomy auto-fill at 180px.
      gridTemplateColumns: isPhone
        ? 'repeat(auto-fill, minmax(130px, 1fr))'
        : 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: isPhone ? 10 : 18,
    }}>
      {children}
    </div>
  );
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: 40, color: '#a07850', opacity: 0.6 }}>···</div>;
}
function Empty({ msg }) {
  return (
    <div style={{
      textAlign: 'center', padding: 30,
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 12, color: '#a07850', fontSize: 13,
    }}>
      {msg || '还没有开启任何模块。请联系管理员分配。'}
    </div>
  );
}

// Module tile — drag to reorder, tap to open.
// dnd-kit's PointerSensor (8px) / TouchSensor (220ms) ensure a quick tap
// does NOT start a drag, so navigation still works on click.
function SortableModuleTile({ mod, language = 'zh' }) {
  const [hovered, setHovered] = useState(false);
  const isPhone = usePhone();
  const palette = paletteFor(mod.category);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
  };

  const iconSize  = isPhone ? 38 : 48;
  const labelSize = isPhone ? 20 : 28;
  const padV      = isPhone ? 18 : 28;
  const padH      = isPhone ? 10 : 16;
  const iconBoxSz = isPhone ? 56 : 72;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={() => {
          if (isDragging) return;
          const url = ROUTES[mod.id] || '/';
          if (mod.external) {
            // A new tab, not a navigation. Inside the installed app the scope
            // is '/', so sending it to another origin would either eject the
            // learner from the PWA or strand them in an in-app browser with no
            // way back. noopener because the opened page is a different
            // product and has no business reaching window.opener.
            window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = url;
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          background: '#fff',
          border: `1.5px solid ${isDragging || hovered ? palette.accent : palette.soft}`,
          borderRadius: 16,
          padding: `${padV}px ${padH}px`,
          cursor: isDragging ? 'grabbing' : 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s, background 0.2s',
          transform: isDragging ? 'scale(1.06)' : hovered ? 'translateY(-3px)' : 'none',
          boxShadow: isDragging
            ? `0 16px 36px ${palette.accent}55`
            : hovered ? `0 10px 24px ${palette.accent}33` : '0 2px 6px rgba(0,0,0,0.04)',
          textAlign: 'center',
          color: '#1a0a05',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: isPhone ? 8 : 12,
        }}>
        <div style={{
          width: iconBoxSz, height: iconBoxSz, borderRadius: '50%',
          background: palette.tint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: iconSize, lineHeight: 1,
          pointerEvents: 'none',
        }}>{mod.icon}</div>
        {/* 楷书 and its wide tracking suit 四-character Chinese labels; the same
            treatment on "Character Builder" reads as broken spacing, and a long
            English name needs to shrink to survive the tile. */}
        <div style={{
          fontSize: language === 'zh' ? labelSize : Math.round(labelSize * 0.62),
          fontWeight: 700, pointerEvents: 'none',
          fontFamily: language === 'zh'
            ? "'STKaiti','KaiTi',serif"
            : "system-ui, -apple-system, 'Segoe UI', sans-serif",
          letterSpacing: language === 'zh' ? (isPhone ? 1 : 3) : 0,
          color: palette.accent,
          lineHeight: 1.2,
        }}>
          {moduleLabel(mod, language)}
          {/* Leaving the app is worth saying before the tap, not after. */}
          {mod.external && (
            <span style={{
              fontSize: isPhone ? 11 : 13, marginLeft: 4, opacity: 0.55,
              verticalAlign: 'super', letterSpacing: 0,
            }} title="在新标签页打开 · opens in a new tab">↗</span>
          )}
        </div>
      </button>
    </div>
  );
}

