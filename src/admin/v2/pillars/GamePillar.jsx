// src/admin/v2/pillars/GamePillar.jsx
// 游戏 pillar — currently 猜灯谜 only.
// Future: tabs for additional games (字源记忆、拼字游戏、etc).
import React, { useState } from 'react';
import RiddleAdminTab from '../../RiddleAdminTab';

const GAMES = [
  { id: 'riddles', icon: '🏮', label: '猜灯谜', component: RiddleAdminTab, active: true },
  { id: 'memory',  icon: '🧠', label: '字源记忆', component: null, active: false },
  { id: 'spelling', icon: '🔤', label: '拼字游戏', component: null, active: false },
];

export default function GamePillar() {
  const [activeGame, setActiveGame] = useState('riddles');
  const game = GAMES.find(g => g.id === activeGame);
  const Component = game?.component;

  return (
    <div>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {GAMES.map(g => (
          <button key={g.id}
            onClick={() => g.active && setActiveGame(g.id)}
            disabled={!g.active}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: activeGame === g.id ? '#10b981' : 'transparent',
              color: activeGame === g.id
                ? '#fff'
                : g.active ? '#5d4630' : '#a07850',
              cursor: g.active ? 'pointer' : 'not-allowed',
              opacity: g.active ? 1 : 0.5,
              fontSize: 13,
              fontWeight: activeGame === g.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span>{g.icon}</span> {g.label}
            {!g.active && <span style={{ fontSize: 9, opacity: 0.7 }}>· 待建</span>}
          </button>
        ))}
      </div>
      <div style={{
        background: '#fff',
        border: '1px solid #e8d5b0',
        borderRadius: 12,
        padding: 16,
      }}>
        {Component ? (
          <Component/>
        ) : (
          <div style={{
            padding: 30, textAlign: 'center',
            background: '#fef3e2',
            border: '1px solid #f59e0b40',
            borderRadius: 10,
            color: '#92400e',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🚧</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {game.label} · 建设中
            </div>
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              下一阶段开发
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
