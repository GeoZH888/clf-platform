// src/components/AdaptiveCard.jsx
// Self-adaptive learning card shown at top of every module home screen.
// Reads jgw_points to understand what the user has done, and recommends next steps.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

// Days since a date string
function daysAgo(d) {
  return d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 999;
}

// Module configs
const MODULE_CONFIG = {
  lianzi: {
    color:  '#8B4513', bg:'#FBE9E7', border:'#E8D5B0',
    actions: ['lianzi_practiced','lianzi_quiz_done','lianzi_perfect'],
    tiers:   [
      { min:0,   max:30,  label:'初学', labelEn:'Starting',     tip:'先从基础字集开始，每天练3个字', tipEn:'Start with basic characters, 3 per day' },
      { min:30,  max:100, label:'入门', labelEn:'Building',      tip:'坚持每天练习，重点复习错字',     tipEn:'Practice daily, review mistakes' },
      { min:100, max:300, label:'进阶', labelEn:'Intermediate',  tip:'尝试笔顺测验，提高准确率',       tipEn:'Try stroke order quizzes' },
      { min:300, max:Infinity, label:'熟练', labelEn:'Advanced', tip:'挑战高级字集，追求满分',         tipEn:'Challenge advanced sets' },
    ],
  },
  pinyin: {
    color:  '#1565C0', bg:'#E3F2FD', border:'#BBDEFB',
    actions: ['pinyin_table_tap','pinyin_listen_right','pinyin_type_right'],
    tiers:   [
      { min:0,   max:20,  label:'初学', labelEn:'Starting',    tip:'先学声母韵母表，点击每个音练习', tipEn:'Start with the initials/finals table' },
      { min:20,  max:60,  label:'入门', labelEn:'Building',    tip:'开始四声练习，区分声调',          tipEn:'Practice the four tones' },
      { min:60,  max:150, label:'进阶', labelEn:'Intermediate',tip:'挑战听音识调，锻炼耳朵',          tipEn:'Try listen & identify tones' },
      { min:150, max:Infinity, label:'熟练', labelEn:'Advanced',tip:'拼音输入练习，强化书写',         tipEn:'Practice pinyin typing' },
    ],
  },
  words: {
    color:  '#2E7D32', bg:'#E8F5E9', border:'#C8E6C9',
    actions: ['words_flash','words_listen_right','words_fill_right'],
    tiers:   [
      { min:0,   max:15,  label:'初学', labelEn:'Starting',    tip:'先用闪卡浏览词语，建立词汇量',  tipEn:'Browse flashcards to build vocabulary' },
      { min:15,  max:60,  label:'入门', labelEn:'Building',    tip:'尝试听词选义，加深理解',          tipEn:'Try listen & choose meaning' },
      { min:60,  max:150, label:'进阶', labelEn:'Intermediate',tip:'挑战看义填词，强化记忆',          tipEn:'Try fill-in-blank for better recall' },
      { min:150, max:Infinity, label:'熟练', labelEn:'Advanced',tip:'按主题系统学习，扩大词汇',      tipEn:'Study by theme, expand vocabulary' },
    ],
  },
  chengyu: {
    color:  '#8B4513', bg:'#FFF8E1', border:'#FFE082',
    actions: ['chengyu_flash','chengyu_quiz_right','chengyu_fill_right','chengyu_match_all','chengyu_chain'],
    tiers:   [
      { min:0,   max:20,  label:'初学', labelEn:'Starting',    tip:'先用闪卡认识成语，了解意思',    tipEn:'Use flashcards to learn idiom meanings' },
      { min:20,  max:80,  label:'入门', labelEn:'Building',    tip:'做选义测验，巩固记忆',            tipEn:'Take the quiz to consolidate' },
      { min:80,  max:200, label:'进阶', labelEn:'Intermediate',tip:'挑战填空和配对，加深理解',        tipEn:'Try fill-blank and matching games' },
      { min:200, max:Infinity, label:'熟练', labelEn:'Advanced',tip:'成语接龙挑战，展示功力',        tipEn:'Try the idiom chain challenge!' },
    ],
  },
  grammar: {
    color:  '#6A1B9A', bg:'#F3E5F5', border:'#CE93D8',
    actions: ['grammar_quiz_right','grammar_build_right'],
    tiers:   [
      { min:0,   max:15,  label:'初学', labelEn:'Starting',    tip:'先阅读语法点，了解规则',          tipEn:'Start by reading grammar patterns' },
      { min:15,  max:50,  label:'入门', labelEn:'Building',    tip:'做填空练习，巩固语法规则',          tipEn:'Try fill-in-blank exercises' },
      { min:50,  max:120, label:'进阶', labelEn:'Intermediate',tip:'挑战连词成句，运用语法',           tipEn:'Try building sentences' },
      { min:120, max:Infinity, label:'熟练', labelEn:'Advanced',tip:'综合运用所有语法，写短文',       tipEn:'Apply all grammar in writing!' },
    ],
  },
  hsk: {
    color:'#2E7D32', bg:'#E8F5E9', border:'#A5D6A7',
    actions:['hsk_learn_know','hsk_quiz_right','hsk_practice_right'],
    tiers:[
      {min:0,  max:30,  label:'初学',labelEn:'Starting',    tip:'从HSK1开始，认识基础词汇',      tipEn:'Start with HSK 1 basics'},
      {min:30, max:100, label:'入门',labelEn:'Building',    tip:'每天复习，重点记忆生词',          tipEn:'Review daily, focus on new words'},
      {min:100,max:300, label:'进阶',labelEn:'Intermediate',tip:'挑战HSK3-4，扩大词汇量',        tipEn:'Challenge HSK 3-4 vocabulary'},
      {min:300,max:Infinity,label:'熟练',labelEn:'Advanced',tip:'冲刺HSK5-6，备考实力强劲',     tipEn:'Aim for HSK 5-6 mastery'},
    ],
  },
  poetry: {
    color:'#C8972A', bg:'#FFF8E1', border:'#FFE082',
    actions:['poetry_read','poetry_memorize','poetry_quiz_right'],
    tiers:[
      {min:0,  max:20,  label:'初学',labelEn:'Starting',    tip:'先阅读诗歌，感受意境',           tipEn:'Start by reading poems'},
      {min:20, max:80,  label:'入门',labelEn:'Building',    tip:'尝试默写练习，加深记忆',          tipEn:'Try memorization exercises'},
      {min:80, max:200, label:'进阶',labelEn:'Intermediate',tip:'挑战诗句测验，巩固记忆',          tipEn:'Challenge yourself with quizzes'},
      {min:200,max:Infinity,label:'熟练',labelEn:'Advanced',tip:'熟读成诵，诗意满怀',             tipEn:'Master the classics!'},
    ],
  },
};

// Days of week heatmap (mini, 7 squares)
function WeekHeatmap({ daily, color }) {
  const max = Math.max(...daily, 1);
  const days = ['日','一','二','三','四','五','六'];
  const today = new Date().getDay();
  return (
    <div style={{ display:'flex', gap:3, alignItems:'flex-end' }}>
      {daily.map((v, i) => {
        const dayIdx = (today - 6 + i + 7) % 7;
        return (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{
              width:14, height: Math.max(4, Math.round((v/max)*28)),
              background: v > 0 ? color : '#E0E0E0',
              borderRadius:2, opacity:0.85,
            }}/>
            <div style={{ fontSize:8, color:'#aaa', marginTop:1 }}>{days[dayIdx]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdaptiveCard({ module, lang = 'zh', style: wrapStyle }) {
  const [pts,     setPts]    = useState(0);
  const [daily,   setDaily]  = useState([0,0,0,0,0,0,0]);
  const [streak,  setStreak] = useState(0);
  const [loading, setLoad]   = useState(true);

  const cfg = MODULE_CONFIG[module];
  const t = (zh, en) => lang === 'zh' ? zh : en;

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !cfg) { setLoad(false); return; }

    supabase.from('jgw_points')
      .select('points, earned_at')
      .eq('device_token', token)
      .eq('module', module)
      .order('earned_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) { setLoad(false); return; }

        const total = data.reduce((s,r) => s + (r.points||0), 0);
        setPts(total);

        // Last 7 days activity
        const now = Date.now();
        const d7 = Array.from({length:7}, (_, i) => {
          const dayStart = now - (6-i)*86400000;
          const dayEnd   = dayStart + 86400000;
          return data.filter(r => {
            const t = new Date(r.earned_at).getTime();
            return t >= dayStart && t < dayEnd;
          }).reduce((s,r) => s + r.points, 0);
        });
        setDaily(d7);

        // Streak (consecutive days with activity)
        let s = 0;
        for (let i = 6; i >= 0; i--) {
          if (d7[i] > 0) s++;
          else break;
        }
        setStreak(s);
        setLoad(false);
      }).catch(() => setLoad(false));
  }, [module]);

  if (!cfg || loading) return null;

  // Find tier
  const tier = cfg.tiers.find(t => pts >= t.min && pts < t.max) || cfg.tiers[cfg.tiers.length-1];
  const nextTier = cfg.tiers[cfg.tiers.indexOf(tier) + 1];
  const progress = nextTier ? Math.round(((pts - tier.min) / (nextTier.min - tier.min)) * 100) : 100;

  const todayPts = daily[6];
  const isActiveToday = todayPts > 0;

  return (
    <div style={{
      background: cfg.bg,
      border: `1.5px solid ${cfg.border}`,
      borderRadius: 16,
      padding: '14px 16px',
      marginBottom: 12,
      ...wrapStyle,
    }}>
      {/* Top row: level + streak */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            fontSize:11, padding:'3px 10px', borderRadius:12,
            background:cfg.color, color:'#fff', fontWeight:700,
          }}>
            {t(tier.label, tier.labelEn)}
          </span>
          <span style={{ fontSize:12, fontWeight:700, color:cfg.color }}>
            {pts} ⭐
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {streak > 0 && (
            <span style={{ fontSize:11, color:'#E65100', fontWeight:600 }}>
              🔥 {streak}{t('天连续','d streak')}
            </span>
          )}
          {isActiveToday && (
            <span style={{ fontSize:10, color:'#2E7D32', background:'#E8F5E9',
              padding:'2px 7px', borderRadius:10, fontWeight:600 }}>
              ✅ {t('今日已练','Practiced today')}
            </span>
          )}
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:10, color:cfg.color, marginBottom:3, opacity:0.8 }}>
            <span>{t('距下一级', 'To next level')}: {nextTier.min - pts} ⭐</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height:5, background:cfg.border, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, borderRadius:3,
              background:cfg.color, transition:'width 0.5s ease' }}/>
          </div>
        </div>
      )}

      {/* Today's tip */}
      <div style={{ fontSize:12, color:cfg.color, lineHeight:1.5,
        display:'flex', gap:6, alignItems:'flex-start' }}>
        <span>💡</span>
        <span>{t(tier.tip, tier.tipEn)}</span>
      </div>

      {/* Week activity */}
      <div style={{ marginTop:10, display:'flex', alignItems:'center',
        justifyContent:'space-between' }}>
        <div style={{ fontSize:10, color:cfg.color, opacity:0.7 }}>
          {t('本周活动', 'This week')}
        </div>
        <WeekHeatmap daily={daily} color={cfg.color}/>
      </div>
    </div>
  );
}
