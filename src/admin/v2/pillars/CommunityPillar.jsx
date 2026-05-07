// src/admin/v2/pillars/CommunityPillar.jsx
// 社区 pillar — 8 sub-modules.
// Each sub-tab renders an existing admin component.
// CharacterImportWizard is a modal so it gets a trigger button.
// ChengyuAdminTab needs apiKeys prop (passed empty for now).
import React, { useState } from 'react';

import CharacterImportWizard from '../../CharacterImportWizard';
// CLFWordsAdminTab.jsx exports `WordsAdminTab` (not CLFWordsAdminTab)
import WordsAdminTab from '../../CLFWordsAdminTab';
import PinyinAdminTab from '../../PinyinAdminTab';
import GrammarAdminTab from '../../GrammarAdminTab';
import ChengyuAdminTab from '../../ChengyuAdminTab';
import PoetryAdminTab from '../../PoetryAdminTab';
import StoryAdminTab from '../../StoryAdminTab';
import ScenarioAdminTab from '../../ScenarioAdminTab';

const TABS = [
  { id: 'characters', icon: '✍️', label: '汉字',     desc: '汉字导入与管理' },
  { id: 'words',      icon: '📚', label: '词语',     desc: '词语库' },
  { id: 'pinyin',     icon: '🔤', label: '拼音',     desc: '拼音教学' },
  { id: 'grammar',    icon: '📐', label: '语法',     desc: '语法点' },
  { id: 'chengyu',    icon: '🎋', label: '成语',     desc: '成语库' },
  { id: 'poetry',     icon: '🪶', label: '诗歌',     desc: '诗词库' },
  { id: 'story',      icon: '📖', label: '故事会',   desc: '故事内容' },
  { id: 'scenario',   icon: '💬', label: '场景对话', desc: '对话场景' },
];

class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error('[CommunityPillar] tab error:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20, background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 10,
          color: '#991b1b',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            ⚠ 此模块加载失败
          </div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            可以从旧 /admin 后台访问此功能，或在下次会话中调试。
            其他 sub-tab 不受影响。
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CharactersWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 10, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05', marginBottom: 6 }}>
          汉字导入向导
        </div>
        <div style={{ fontSize: 12, color: '#5d4630', marginBottom: 12 }}>
          从语料库批量导入汉字，自动获取拼音、释义、插画。
        </div>
        <button onClick={() => setOpen(true)} style={{
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
          background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>
          打开导入向导
        </button>
      </div>
      {open && (
        <CharacterImportWizard
          open={open}
          onClose={() => setOpen(false)}
          onComplete={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default function CommunityPillar() {
  const [active, setActive] = useState('chengyu'); // start on something likely to render

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
        flexWrap: 'wrap',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            title={t.desc}
            style={{
              padding: '7px 12px', borderRadius: 6, border: 'none',
              background: active === t.id ? '#3b82f6' : 'transparent',
              color: active === t.id ? '#fff' : '#5d4630',
              cursor: 'pointer', fontSize: 12,
              fontWeight: active === t.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Active sub-tab content with error boundary */}
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 16, minHeight: 200,
      }}>
        <TabErrorBoundary key={active}>
          {active === 'characters' && <CharactersWrapper/>}
          {active === 'words'      && <WordsAdminTab/>}
          {active === 'pinyin'     && <PinyinAdminTab/>}
          {active === 'grammar'    && <GrammarAdminTab/>}
          {active === 'chengyu'    && <ChengyuAdminTab apiKeys={{}}/>}
          {active === 'poetry'     && <PoetryAdminTab/>}
          {active === 'story'      && <StoryAdminTab/>}
          {active === 'scenario'   && <ScenarioAdminTab/>}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
