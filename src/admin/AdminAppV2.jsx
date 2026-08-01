// src/admin/AdminAppV2.jsx
// New super_admin shell: sidebar with two collapsible groups.
// Foundation group: accounts / AI config / RAG / module permissions / logs
// Modules group:    by pillar (教学/社区/游戏/future)
//
// Old /admin (AdminApp.jsx) remains untouched. This is at /admin-v2.
import React, { useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { LogOut, Globe, ChevronDown, ChevronRight } from 'lucide-react';

// We'll wrap the existing user management page so accounts tab uses real logic
import AccountsManagement from './v2/AccountsManagement';
import PlatformAnalyticsTab from './v2/PlatformAnalyticsTab';
import GamePillar from './v2/pillars/GamePillar';
import CommunityPillar from './v2/pillars/CommunityPillar';
import AIConfigTab from './AIConfigTab';
import ApiKeyManager from './ApiKeyManager';
import PromptTemplatesTab from './PromptTemplatesTab';
import CorpusTab from './CorpusTab';
import UserModulesButton from './UserModulesButton';
import { supabase } from '../lib/supabase';

// ============================================================
// Tab definitions — grouped
// ============================================================
const FOUNDATION_TABS = [
  { id: 'accounts',    icon: '👥', label: '账户管理',    desc: '用户、角色、学校、班级' },
  { id: 'ai-config',   icon: '🤖', label: 'AI 配置',     desc: '各 AI 提供商 API Key + 默认提供商' },
  { id: 'rag',         icon: '📚', label: 'RAG 管理',    desc: '知识库、文档上传、嵌入、检索（暨南教材等）' },
  { id: 'platform',    icon: '📊', label: '平台分析',    desc: '用户、信号、审计日志' },
];

// 教学 is no longer a pillar here — the teaching system moved to its own
// deployment (github.com/GeoZH888/lingua-school → david-zhongwen.net), which
// carries its own admin at /admin. Both still read one Supabase project, so a
// user created in either place shows up in the other.
const MODULE_TABS = [
  { id: 'pillar-community', icon: '🌐', label: '社区',  desc: '练字、词语、拼音、成语、诗歌、语法、课程等', color: '#3b82f6' },
  { id: 'pillar-game',      icon: '🎮', label: '游戏',  desc: '猜灯谜及其他趣味模块', color: '#10b981' },
  { id: 'pillar-future',    icon: '✨', label: '未来',  desc: '小卖部、家长门户、其他规划中模块', color: '#6b7280' },
];

// Existing tabs from old AdminApp that should be reachable inside new sections
// (we leave a hint; actual wiring comes in next sessions)
const PILLAR_HINTS = {
  'pillar-community': [
    { name: 'CharacterImportWizard', desc: '汉字导入向导' },
    { name: 'CLFWordsAdminTab',      desc: '词语管理' },
    { name: 'PinyinAdminTab',        desc: '拼音管理' },
    { name: 'GrammarAdminTab',       desc: '语法管理' },
    { name: 'ChengyuAdminTab',       desc: '成语管理' },
    { name: 'PoetryAdminTab',        desc: '诗歌管理' },
    { name: 'StoryAdminTab',         desc: '故事会管理' },
    { name: 'ScenarioAdminTab',      desc: '场景对话管理' },
  ],
  'pillar-game':   [{ name: 'RiddleAdminTab', desc: '猜灯谜管理' }],
  'pillar-future': [{ name: '(待建)', desc: '未来模块（小卖部、家长门户等）' }],
};

const FOUNDATION_HINTS = {
  'ai-config':   ['AIConfigTab', 'ApiKeyManager', 'PromptTemplatesTab'],
  'rag':         ['CorpusTab', 'ExtractFromCorpusWizard'],
  'module-perm': ['UserModulesButton'],
  'logs':        ['(待建)'],
};

// ============================================================
// Main component
// ============================================================
export default function AdminAppV2() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('accounts');
  const [foundationOpen, setFoundationOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);

  if (!user) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#a07850' }}>
        请先登录…
      </div>
    );
  }
  if (user.role !== 'super_admin') {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#c41e3a' }}>
        只有超级管理员可访问此页。
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 100%)',
      color: '#1a0a05', display: 'flex',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'linear-gradient(180deg, #8b0000 0%, #c41e3a 100%)',
        position: 'fixed', height: '100vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26 }}>🐼</span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#fff5e6',
                fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3,
              }}>大卫学中文</div>
              <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)' }}>
                超级管理员后台
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)', marginTop: 6 }}>
            {user.name || user.email}
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <GroupHeader
            label="基础设施"
            isOpen={foundationOpen}
            onToggle={() => setFoundationOpen(o => !o)}/>
          {foundationOpen && FOUNDATION_TABS.map(t => (
            <NavButton key={t.id} tab={t} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}/>
          ))}

          <div style={{ height: 8 }}/>

          <GroupHeader
            label="模块内容"
            isOpen={modulesOpen}
            onToggle={() => setModulesOpen(o => !o)}/>
          {modulesOpen && MODULE_TABS.map(t => (
            <NavButton key={t.id} tab={t} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}/>
          ))}
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={() => window.location.href = '/admin'} style={btnSecondary}>
            ↩ 旧后台 /admin
          </button>
          <button onClick={() => window.location.href = '/community'} style={btnSecondary}>
            <Globe size={12}/> 去社区
          </button>
          <button onClick={logout} style={btnDanger}>
            <LogOut size={12}/> 退出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 260, padding: 28, overflow: 'auto' }}>
        <TabContent activeTab={activeTab}/>
      </main>
    </div>
  );
}

function GroupHeader({ label, isOpen, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 8px',
      background: 'transparent', border: 'none',
      color: 'rgba(255,245,230,0.6)',
      cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 3,
      textAlign: 'left',
    }}>
      {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
      {label}
    </button>
  );
}

function NavButton({ tab, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px 8px 18px', borderRadius: 8,
      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
      color: '#fff5e6',
      border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
      cursor: 'pointer', fontSize: 12,
      fontWeight: active ? 700 : 400,
      textAlign: 'left',
    }}>
      <span style={{ fontSize: 14 }}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}

const btnSecondary = {
  padding: '7px 10px', background: 'rgba(255,255,255,0.1)',
  color: '#fff5e6', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 8, cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnDanger = {
  padding: '7px 10px', background: 'rgba(0,0,0,0.2)',
  color: '#fff5e6', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};

// ============================================================
// Tab content
// Tab content
// ============================================================
function TabContent({ activeTab }) {
  const { user } = useAuth();

  // Real accounts tab
  if (activeTab === 'accounts') {
    return (
      <div>
        <SectionHeader icon="👥" title="账户管理" subtitle="Accounts · 用户、角色、学校、班级" color="#c41e3a"/>
        <div style={{
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 12, padding: 16,
        }}>
          <AccountsManagement/>
        </div>
      </div>
    );
  }

  // AI 配置 — 3 sub-tabs
  if (activeTab === 'ai-config') {
    return (
      <div>
        <SectionHeader icon="🤖" title="AI 配置" subtitle="API Keys + 默认提供商 + 提示模板" color="#c41e3a"/>
        <AIConfigSection currentUser={user}/>
      </div>
    );
  }

  // RAG 管理 — wraps CorpusTab
  if (activeTab === 'rag') {
    return (
      <div>
        <SectionHeader icon="📚" title="RAG 管理" subtitle="知识库、文档上传、嵌入、检索（暨南教材等）" color="#c41e3a"/>
        <div style={{
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 12, padding: 16,
        }}>
          <CorpusTab/>
        </div>
      </div>
    );
  }

  // 平台分析 — global metrics + audit log
  if (activeTab === 'platform') {
    return (
      <div>
        <SectionHeader icon="📊" title="平台分析" subtitle="用户、信号、审计日志" color="#c41e3a"/>
        <PlatformAnalyticsTab/>
      </div>
    );
  }

  // 游戏 pillar
  if (activeTab === 'pillar-game') {
    return (
      <div>
        <SectionHeader icon="🎮" title="游戏" subtitle="猜灯谜及其他趣味模块" color="#10b981"/>
        <GamePillar/>
      </div>
    );
  }

  // 社区 pillar
  if (activeTab === 'pillar-community') {
    return (
      <div>
        <SectionHeader icon="🌐" title="社区" subtitle="练字、词语、拼音、成语、诗歌、语法、课程等" color="#3b82f6"/>
        <CommunityPillar/>
      </div>
    );
  }

  // (A 教学 pillar rendering TeacherKnowledgeMap used to sit here. It was
  // already unreachable — it tested activeTab === 'pillar-teaching' while the
  // tab id was 'pillar-school'. The component moved to lingua-school's /admin.)

  // Module pillars
  const moduleTab = MODULE_TABS.find(t => t.id === activeTab);
  if (moduleTab) {
    const hints = PILLAR_HINTS[activeTab] || [];
    return (
      <div>
        <SectionHeader
          icon={moduleTab.icon}
          title={moduleTab.label}
          subtitle={moduleTab.desc}
          color={moduleTab.color}/>
        <PillarPlaceholder hints={hints} color={moduleTab.color}/>
      </div>
    );
  }

  return <div style={{ color: '#a07850' }}>选择左侧标签开始…</div>;
}

// ============================================================
// AI Config section with 3 sub-tabs
// ============================================================
function AIConfigSection({ currentUser }) {
  const [subTab, setSubTab] = useState('providers');
  const tabs = [
    { id: 'providers', label: '默认提供商', icon: '🤖' },
    { id: 'apikeys',   label: 'API Keys',   icon: '🔑' },
    { id: 'prompts',   label: '提示模板',   icon: '📝' },
  ];
  return (
    <div>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: subTab === t.id ? '#c41e3a' : 'transparent',
            color: subTab === t.id ? '#fff' : '#5d4630',
            cursor: 'pointer', fontSize: 13,
            fontWeight: subTab === t.id ? 700 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 16,
      }}>
        {subTab === 'providers' && <AIConfigTab/>}
        {subTab === 'apikeys'   && <ApiKeyManager/>}
        {subTab === 'prompts'   && <PromptTemplatesTab currentUser={currentUser}/>}
      </div>
    </div>
  );
}

// ============================================================
// Module Permissions — list users + show UserModulesButton per row
// ============================================================
function ModulePermissionsSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('clf_user_profiles')
        .select('user_id, name, email, role')
        .order('role')
        .order('name');
      if (!error) setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
    }
    return true;
  });

  const roleBadge = (role) => {
    const colors = {
      super_admin:   { bg: '#fef2f2', fg: '#991b1b', label: '超管' },
      school_master: { bg: '#fef3e2', fg: '#92400e', label: '校长' },
      teacher:       { bg: '#eff6ff', fg: '#1e40af', label: '教师' },
      student:       { bg: '#f0fdf4', fg: '#166534', label: '学生' },
      parent:        { bg: '#faf5ff', fg: '#6b21a8', label: '家长' },
    };
    const c = colors[role] || { bg: '#f3f4f6', fg: '#6b7280', label: role };
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
        background: c.bg, color: c.fg, border: `1px solid ${c.fg}30`,
      }}>{c.label}</span>
    );
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="text" placeholder="搜索姓名 / 邮箱…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180,
            padding: '8px 12px', fontSize: 13,
            border: '1px solid #e8d5b0', borderRadius: 8,
          }}/>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13,
            border: '1px solid #e8d5b0', borderRadius: 8, background: '#fff',
          }}>
          <option value="all">所有角色</option>
          <option value="super_admin">超管</option>
          <option value="school_master">校长</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
          <option value="parent">家长</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#a07850' }}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#a07850' }}>无匹配用户</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(u => (
            <div key={u.user_id} style={{
              padding: 12, border: '1px solid #e8d5b0', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fafafa',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05' }}>
                    {u.name || '(no name)'}
                  </span>
                  {roleBadge(u.role)}
                </div>
                <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
                  {u.email}
                </div>
              </div>
              <UserModulesButton user={u} style={{
                padding: '6px 12px', fontSize: 12,
              }}/>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#8b6f47', textAlign: 'right' }}>
        共 {filtered.length} 个用户（共 {users.length}）
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, color }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${color}30`,
      borderRadius: 16, padding: '20px 24px', marginBottom: 18,
      display: 'flex', alignItems: 'center', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10, fontSize: 100, opacity: 0.06,
        lineHeight: 1, color, pointerEvents: 'none', userSelect: 'none',
        fontFamily: 'serif', fontWeight: 900,
      }}>{title}</div>
      <div style={{
        width: 50, height: 50, borderRadius: 14, background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, border: `1px solid ${color}30`, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#8b6f47', marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Placeholder({ hints }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '40px 24px',
    }}>
      <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05',
        textAlign: 'center', marginBottom: 8,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
        建设中 · Coming soon
      </div>
      <div style={{ fontSize: 12, color: '#8b6f47', textAlign: 'center', marginBottom: 20 }}>
        本模块将在下一会话构建。
      </div>
      {hints.length > 0 && (
        <div style={{
          background: '#fef3e2', border: '1px solid #f59e0b40',
          borderRadius: 10, padding: 14, fontSize: 12, color: '#92400e',
        }}>
          <strong>已有相关组件可复用：</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {hints.map((h, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                <code style={{ fontSize: 11 }}>{h}</code>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>
            可以从旧 /admin 后台访问这些功能。
          </div>
        </div>
      )}
    </div>
  );
}

function PillarPlaceholder({ hints, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '32px 24px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05',
        marginBottom: 14, fontFamily: "'STKaiti','KaiTi',serif" }}>
        本支柱（pillar）下的模块
      </div>
      {hints.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8b6f47' }}>暂无</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {hints.map((h, i) => (
            <div key={i} style={{
              padding: 12, background: `${color}08`,
              border: `1px solid ${color}25`,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: color, fontWeight: 700,
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0a05' }}>
                  {h.name}
                </div>
                <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 1 }}>
                  {h.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{
        marginTop: 18, padding: 12,
        background: '#fef3e2', border: '1px solid #f59e0b40',
        borderRadius: 10, fontSize: 12, color: '#92400e',
      }}>
        <strong>下一步：</strong> 这些组件目前在旧 /admin 后台中可访问。
        下一会话将把它们重组进新的 sidebar 结构，或为缺失的部分构建新的 CRUD 界面。
      </div>
    </div>
  );
}
