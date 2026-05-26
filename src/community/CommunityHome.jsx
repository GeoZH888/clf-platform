// src/community/CommunityHome.jsx
// LIGHT THEME + 5 cards (教学/社区/HSK/游戏/非遗) with mutual-exclusive inline expand.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import PersonalDashboard from './dashboard/PersonalDashboard';
import { supabase } from '../school/services/supabase';
import { MODULES, ALWAYS_ON } from '../config/modules';
import { usePhone } from '../hooks/useMediaQuery';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ROLE_HOME = {
  super_admin:   '/admin',
  school_master: '/school-master',
  teacher:       '/teacher',
  student:       '/student',
  parent:        '/parent',
};
const ROLE_LABEL = {
  super_admin:   '管理后台',
  school_master: '校长面板',
  teacher:       '教师工作台',
  student:       '学生面板',
  parent:        '家长面板',
};
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
  hsk:     '/learn?module=hsk',
  riddles: '/learn?module=riddles',
  scenario:'/learn?module=scenario',
  story:   '/learn?module=story',
  // Non-learning links — leave as before until those routes are built
  lessons:'/lessons',
  chat:'/chat', voice:'/voice', homework:'/homework', shop:'/shop', parents:'/parents',
};

const HSK_LEVELS = [
  { level: 1, words: '150', desc: '入门' },
  { level: 2, words: '300', desc: '基础' },
  { level: 3, words: '600', desc: '进阶' },
  { level: 4, words: '1200', desc: '中级' },
  { level: 5, words: '2500', desc: '高级' },
  { level: 6, words: '5000', desc: '精通' },
];

const FEIYI = [
  { slug:'folklore',  zh:'民俗故事', en:'Folklore',  it:'Folclore',
    desc_zh:'传统民间传说',  desc_en:'Folk tales',          desc_it:'Racconti popolari',
    icon:'俗', color:'#a0522d' },
  { slug:'opera',     zh:'传统戏曲', en:'Opera',     it:'Opera',
    desc_zh:'昆曲、京剧、各地戏种', desc_en:'Kunqu, Beijing opera', desc_it:'Kunqu, opera di Pechino',
    icon:'戏', color:'#c41e3a' },
  { slug:'crafts',    zh:'民间工艺', en:'Crafts',    it:'Artigianato',
    desc_zh:'剪纸、刺绣、陶瓷', desc_en:'Paper-cutting, embroidery', desc_it:'Carta tagliata, ricamo',
    icon:'工', color:'#8b4513' },
  { slug:'festivals', zh:'节庆文化', en:'Festivals', it:'Feste',
    desc_zh:'传统节日与仪式', desc_en:'Festivals & rituals', desc_it:'Feste e rituali',
    icon:'庆', color:'#d4a017' },
];

function DoorCard({ emoji, title, subtitle, desc, features, color, bgGrad, textColor, accentColor, onClick, isOpen, compact }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick(); }}
      style={{
        background: bgGrad, border: `2.5px solid ${color}`, borderRadius: 22,
        padding: compact ? '20px 18px 16px' : '24px 20px 20px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        transform: pressed ? 'scale(0.97)' : hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        boxShadow: isOpen
          ? `0 0 0 4px ${color}40, 0 16px 40px ${color}30`
          : hovered
            ? `0 16px 40px ${color}30, 0 4px 12px ${color}20`
            : `0 4px 16px ${color}15`,
        position: 'relative', overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: compact ? 90 : 110, opacity: 0.06,
        lineHeight: 1, color, pointerEvents: 'none', userSelect: 'none', fontFamily: 'serif' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: compact ? 44 : 50, height: compact ? 44 : 50, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 22 : 26,
          border: `1.5px solid ${color}30`, flexShrink: 0 }}>{emoji}</div>
        <div>
          <div style={{ fontSize: compact ? 20 : 24, fontWeight: 900, color: textColor, lineHeight: 1.1,
            fontFamily: "'STKaiti','KaiTi','FangSong',serif" }}>{title}</div>
          <div style={{ fontSize: 11, color: accentColor, marginTop: 2, fontWeight: 600 }}>
            {subtitle}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: textColor, lineHeight: 1.6, marginBottom: 10,
        opacity: 0.8, borderLeft: `3px solid ${color}40`, paddingLeft: 8 }}>{desc}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {features.slice(0, 4).map((f, i) => (
          <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 16,
            background: `${color}12`, color: textColor, border: `1px solid ${color}25`,
            fontWeight: 500 }}>{f}</span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: accentColor, opacity: 0.7 }}>
          {isOpen ? '点击收起 ↑' : '点击进入 →'}
        </span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 16, fontWeight: 700,
          transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(90deg)' : hovered ? 'scale(1.15)' : 'none',
          boxShadow: `0 4px 12px ${color}50` }}>›</div>
      </div>
    </button>
  );
}

export default function CommunityHome() {
  const { user, logout } = useAuth();
  const isPhone = usePhone();
  const [allowedIds, setAllowedIds] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [feiyiLang, setFeiyiLang] = useState('zh');
  const [moduleOrder, setModuleOrder] = useState(null);  // custom drag order (array of ids)

  // Drag sensors: mouse needs an 8px move before dragging (so taps still click);
  // touch needs a 220ms long-press (so scroll/tap still work, drag is deliberate).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!user?.id) return;
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
  const schoolUrl = ROLE_HOME[myRole];
  const schoolLabel = ROLE_LABEL[myRole];

  const visibleModules = allowedIds
    ? MODULES.filter(m => allowedIds.includes(m.id) && m.category !== 'future')
    : [];
  // Pillar-based filtering
  const communityModules = visibleModules.filter(m =>
    m.pillar === 'community' || m.pillar === 'home' || m.pillar === 'profile' || m.pillar === 'progress'
  );

  // ── Draggable community tiles ──────────────────────────────────────
  // The tiles shown in the 可用模块 grid (excludes home/profile/progress).
  const baseTiles = communityModules.filter(
    m => !['home', 'profile', 'progress'].includes(m.id)
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

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedTiles.map(m => m.id);
    const from = ids.indexOf(active.id);
    const to   = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    saveOrder(arrayMove(ids, from, to));
  }

  const toggleSection = (s) => setOpenSection(prev => prev === s ? null : s);

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
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 4 }}>大卫学中文</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || user?.email} · {myRole || 'visitor'}
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
        <button onClick={logout} style={{
          background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '8px 14px', borderRadius: 20, flexShrink: 0,
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>退出</button>
      </header>

      <div className="app-container" style={{
        display: 'flex', alignItems: 'center', gap: 14,
        paddingTop: 24,
      }}>
        <div style={{ flex: 1, height: 1,
          background: 'linear-gradient(to right, transparent, rgba(196,30,58,0.4))' }}/>
        <div style={{ fontSize: 13, color: '#c41e3a', fontWeight: 700, letterSpacing: 4 }}>
          选择入口
        </div>
        <div style={{ flex: 1, height: 1,
          background: 'linear-gradient(to left, transparent, rgba(196,30,58,0.4))' }}/>
      </div>

      <main className="app-container" style={{ paddingTop: 20, paddingBottom: 40 }}>
        <div style={{ display: 'grid', gap: isPhone ? 12 : 14, marginTop: 20,
          gridTemplateColumns: isPhone
            ? 'repeat(auto-fit, minmax(150px, 1fr))'
            : 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {schoolUrl && (
            <DoorCard
              emoji="🏫"
              title="教学"
              subtitle={schoolLabel}
              desc={"进入你的专属面板。根据你的角色，查看班级、布置作业、查看成绩。"}
              features={['班级', '作业', '课程', '沟通']}
              color="#c41e3a"
              bgGrad="linear-gradient(135deg, #fff5f0 0%, #ffe8e0 100%)"
              textColor="#1a0a05" accentColor="#8b0a18"
              isOpen={false} compact
              onClick={() => window.location.href = schoolUrl}
            />
          )}
          <DoorCard
            emoji="🌐"
            title="社区"
            subtitle="Community"
            desc={"中文学习社区。汉字、拼音、词汇、成语…按节奏学习。"}
            features={baseTiles.length > 0
              ? baseTiles.slice(0, 4).map(m => m.label)
              : ['学习']}
            color="#3b82f6"
            bgGrad="linear-gradient(135deg, #f0f6ff 0%, #e3f0ff 100%)"
            textColor="#1a0a05" accentColor="#1d4ed8"
            isOpen={openSection === 'community'} compact
            onClick={() => toggleSection('community')}
          />
          <DoorCard
            emoji="🎯"
            title="HSK"
            subtitle="水平考试"
            desc={"HSK 1-6 级中文水平考试。词汇、语法、听力、阅读全方位准备。"}
            features={['HSK1', 'HSK2', 'HSK3', 'HSK4+']}
            color="#9333ea"
            bgGrad="linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)"
            textColor="#1a0a05" accentColor="#7e22ce"
            isOpen={openSection === 'hsk'} compact
            onClick={() => toggleSection('hsk')}
          />
          <DoorCard
            emoji="🏮"
            title="非遗"
            subtitle="Heritage"
            desc={"中华非物质文化遗产。戏曲、民俗、工艺、节庆—传统之美。"}
            features={['戏曲', '民俗', '工艺', '节庆']}
            color="#d97706"
            bgGrad="linear-gradient(135deg, #fff8ed 0%, #fdebc7 100%)"
            textColor="#1a0a05" accentColor="#92400e"
            isOpen={openSection === 'feiyi'} compact
            onClick={() => toggleSection('feiyi')}
          />
          <DoorCard
            emoji="🌸"
            title="我的"
            subtitle="My Records"
            desc={"个人学习记录。掌握进度、最近活动、待复习内容。"}
            features={['进度', '记录', '复习', '统计']}
            color="#ec4899"
            bgGrad="linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)"
            textColor="#1a0a05" accentColor="#9d174d"
            isOpen={openSection === 'mine'} compact
            onClick={() => toggleSection('mine')}
          />
        </div>

        {openSection === 'community' && (
          <ExpandedSection color="#3b82f6" label="可用模块">
            {allowedIds === null ? (
              <Loading/>
            ) : communityModules.length === 0 ? (
              <Empty/>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}>
                <SortableContext items={orderedTiles.map(m => m.id)}
                  strategy={rectSortingStrategy}>
                  <TileGrid>
                    {orderedTiles.map(m => (
                      <SortableModuleTile key={m.id} mod={m} hoverColor="#3b82f6"/>
                    ))}
                  </TileGrid>
                </SortableContext>
              </DndContext>
            )}
          </ExpandedSection>
        )}

        {openSection === 'hsk' && (
          <ExpandedSection color="#9333ea" label="HSK 等级">
            <TileGrid>
              {HSK_LEVELS.map(lv => (
                <button key={lv.level}
                  onClick={() => alert(`HSK${lv.level} · 内容建设中…`)}
                  style={{
                    background: '#fff',
                    border: '1.5px solid #e8d5b0',
                    borderRadius: 14, padding: '16px 10px',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#9333ea';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(147,51,234,0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = '#e8d5b0';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                  }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#9333ea15', border: '1.5px solid #9333ea40',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: 14, fontWeight: 800, color: '#9333ea',
                    fontFamily: "'STKaiti','KaiTi',serif",
                  }}>
                    HSK{lv.level}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0a05',
                    fontFamily: "'STKaiti','KaiTi',serif", marginBottom: 2 }}>
                    {lv.desc}
                  </div>
                  <div style={{ fontSize: 10, color: '#8b6f47' }}>
                    {lv.words} 词
                  </div>
                </button>
              ))}
            </TileGrid>
          </ExpandedSection>
        )}


        {openSection === 'feiyi' && (
          <ExpandedSection color="#d97706"
            label={feiyiLang === 'zh' ? '主题' : feiyiLang === 'en' ? 'Themes' : 'Temi'}
            extras={
              <div style={{ display: 'flex', gap: 4 }}>
                {['zh', 'en', 'it'].map(l => (
                  <button key={l} onClick={() => setFeiyiLang(l)} style={{
                    padding: '4px 10px', borderRadius: 10,
                    background: feiyiLang === l ? '#d97706' : '#fff',
                    color: feiyiLang === l ? '#fff' : '#92400e',
                    border: `1px solid ${feiyiLang === l ? '#d97706' : '#e8d5b0'}`,
                    cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase',
                  }}>{l}</button>
                ))}
              </div>
            }>
            <TileGrid>
              {FEIYI.map(c => <FeiyiTile key={c.slug} cat={c} lang={feiyiLang}/>)}
            </TileGrid>
          </ExpandedSection>
        )}

        {openSection === 'mine' && (
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
              <span>🌸</span><span>我的学习记录</span>
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

function TileGrid({ children }) {
  const isPhone = usePhone();
  return (
    <div style={{
      display: 'grid',
      // Phones: 2-up tiles (140px min fits two columns at ~360px wide).
      // Larger screens: roomy auto-fill at 180px.
      gridTemplateColumns: isPhone
        ? 'repeat(auto-fill, minmax(140px, 1fr))'
        : 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: isPhone ? 12 : 18,
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

function ModuleTile({ mod, hoverColor = '#c41e3a' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => window.location.href = ROUTES[mod.id] || '/'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? hoverColor : '#e8d5b0'}`,
        borderRadius: 16, padding: '28px 16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? `0 10px 24px ${hoverColor}33`
          : '0 2px 6px rgba(0,0,0,0.04)',
        textAlign: 'center', color: '#1a0a05',
      }}>
      <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>{mod.icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>
        {mod.label}
      </div>
    </button>
  );
}

// Sortable version of ModuleTile — drag to reorder, tap to open.
// dnd-kit's PointerSensor (8px) / TouchSensor (220ms) ensure a quick tap
// does NOT start a drag, so navigation still works on click.
function SortableModuleTile({ mod, hoverColor = '#3b82f6' }) {
  const [hovered, setHovered] = useState(false);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={() => { if (!isDragging) window.location.href = ROUTES[mod.id] || '/'; }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          background: '#fff',
          border: `1.5px solid ${isDragging ? hoverColor : hovered ? hoverColor : '#e8d5b0'}`,
          borderRadius: 16, padding: '28px 16px',
          cursor: isDragging ? 'grabbing' : 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          transform: isDragging ? 'scale(1.06)' : hovered ? 'translateY(-3px)' : 'none',
          boxShadow: isDragging
            ? `0 16px 36px ${hoverColor}55`
            : hovered ? `0 10px 24px ${hoverColor}33` : '0 2px 6px rgba(0,0,0,0.04)',
          textAlign: 'center', color: '#1a0a05',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}>
        <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1,
          pointerEvents: 'none' }}>{mod.icon}</div>
        <div style={{ fontSize: 28, fontWeight: 700, pointerEvents: 'none',
          fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>
          {mod.label}
        </div>
      </button>
    </div>
  );
}

function FeiyiTile({ cat, lang }) {
  const [hovered, setHovered] = useState(false);
  const label = cat[lang] || cat.zh;
  const desc = cat[`desc_${lang}`] || cat.desc_zh;
  return (
    <button
      onClick={() => { window.location.href = `/feiyi/${cat.slug}`; }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? cat.color : '#e8d5b0'}`,
        borderRadius: 14, padding: '16px 12px',
        cursor: 'pointer', textAlign: 'center', color: '#1a0a05',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 10px 24px ${cat.color}30` : '0 2px 6px rgba(0,0,0,0.04)',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${cat.color}15`,
        border: `1.5px solid ${cat.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: cat.color,
        fontFamily: "'STKaiti','KaiTi',serif",
        margin: '0 auto 8px',
      }}>
        {cat.icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: '#8b6f47', lineHeight: 1.4 }}>
        {desc}
      </div>
    </button>
  );
}
