// src/admin/ContentManagementTab.jsx
import React, { useState } from 'react';
import { MODULES } from '../config/modules';
import LianziPage from './content/LianziPage';
import WordsPage from './content/WordsPage';
import PinyinPage from './content/PinyinPage';
import GrammarPage from './content/GrammarPage';
import HskPage from './content/HskPage';
import LessonsPage from './content/LessonsPage';
import ChengyuPage from './content/ChengyuPage';
import PoetryPage from './content/PoetryPage';
import RiddlesPage from './content/RiddlesPage';
import ScenarioPage from './content/ScenarioPage';
import StoryPage from './content/StoryPage';
import ChatPage from './content/ChatPage';
import VoicePage from './content/VoicePage';
import HomeworkPage from './content/HomeworkPage';
import ShopPage from './content/ShopPage';
import ParentsPage from './content/ParentsPage';

const PAGES = {
  lianzi: LianziPage, words: WordsPage, pinyin: PinyinPage, grammar: GrammarPage,
  hsk: HskPage, lessons: LessonsPage, chengyu: ChengyuPage, poetry: PoetryPage,
  riddles: RiddlesPage, scenario: ScenarioPage, story: StoryPage, chat: ChatPage,
  voice: VoicePage, homework: HomeworkPage, shop: ShopPage, parents: ParentsPage,
};

export default function ContentManagementTab() {
  const [active, setActive] = useState('chengyu');
  const Active = PAGES[active] || (() => <div>未配置</div>);
  const gateable = MODULES.filter(m => m.gateable && PAGES[m.id]);

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        marginBottom: 20, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {gateable.map(m => (
          <button key={m.id} onClick={() => setActive(m.id)} style={{
            padding: '6px 12px', borderRadius: 6, border: 'none',
            background: active === m.id ? '#c41e3a' : 'transparent',
            color: active === m.id ? '#fff' : '#5d4630',
            cursor: 'pointer', fontSize: 12,
            fontWeight: active === m.id ? 700 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
