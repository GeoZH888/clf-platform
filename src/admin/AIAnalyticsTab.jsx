// src/admin/AIAnalyticsTab.jsx — Enhanced AI Analytics
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850', verm:'#8B4513',
};
const MODULE_COLOR = { lianzi:'#8B4513', pinyin:'#1565C0', words:'#2E7D32', chengyu:'#6A1B9A', any:'#F57F17' };
const MODULE_LABEL = { lianzi:'练字', pinyin:'拼音', words:'词语', chengyu:'成语', any:'其他' };
const LEVEL_COLOR  = { Advanced:'#2E7D32', Intermediate:'#1565C0', 'Beginner+':'#F57F17', Beginner:'#90A4AE' };

function Card({ children, style }) {
  return <div style={{ background:V.card, border:`1px solid ${V.border}`, borderRadius:14,
    padding:'14px 16px', ...style }}>{children}</div>;
}
function Heading({ children }) {
  return <div style={{ fontSize:13, fontWeight:600, color:V.text, marginBottom:10 }}>{children}</div>;
}
function StatBox({ icon, value, label, sub, color='#8B4513' }) {
  return (
    <div style={{ background:V.card, border:`1px solid ${V.border}`, borderRadius:14,
      padding:'14px 16px', flex:1, minWidth:110 }}>
      <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:11, color:V.text2, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:V.text3 }}>{sub}</div>}
    </div>
  );
}

// Mini sparkline bar chart
function Sparkline({ data, color='#8B4513', height=28 }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex:1, background: v>0 ? color : '#f0e8d8',
          height:`${Math.max(4,(v/max)*100)}%`,
          borderRadius:'2px 2px 0 0', opacity:0.8,
          minWidth:4,
        }}/>
      ))}
    </div>
  );
}

// Heatmap for activity by hour
function HourHeatmap({ hourData }) {
  const max = Math.max(...Object.values(hourData), 1);
  return (
    <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
      {Array.from({length:24}, (_, h) => {
        const v = hourData[h] || 0;
        const pct = v / max;
        return (
          <div key={h} title={`${h}:00 — ${v} actions`}
            style={{ width:20, height:20, borderRadius:4,
              background: pct > 0.6 ? '#8B4513' : pct > 0.3 ? '#C8A050' : pct > 0 ? '#f0e0c0' : '#f5ede0',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:8, color: pct>0.4 ? '#fff' : '#a07850' }}>
            {h}
          </div>
        );
      })}
    </div>
  );
}

export default function AIAnalyticsTab() {
  const [sessions,    setSessions]    = useState([]);
  const [pts,         setPts]         = useState([]);
  const [cyProg,      setCyProg]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [aiInsight,   setAiInsight]   = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [selectedUser,setSelectedUser]= useState(null);
  const [view,        setView]        = useState('overview'); // overview | students | activity | alerts

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [sR, pR, cR] = await Promise.all([
        supabase.from('jgw_device_sessions')
          .select('*, jgw_invites(label, username, modules, max_devices)')
          .order('last_seen', { ascending:false }).limit(100),
        supabase.from('jgw_points')
          .select('device_token, module, action, points, earned_at')
          .order('earned_at', { ascending:false }).limit(1000),
        supabase.from('jgw_chengyu_progress')
          .select('device_token, mode, correct, practiced_at').limit(500),
      ]);
      setSessions(sR.data || []);
      setPts(pR.data     || []);
      setCyProg(cR.data  || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  // ── Compute per-user stats ─────────────────────────────────────
  const userStats = useMemo(() => {
    const byInvite = {};
    sessions.forEach(s => {
      const key = s.invite_id || 'unknown';
      if (!byInvite[key]) byInvite[key] = {
        label: s.jgw_invites?.label || 'Unknown',
        username: s.jgw_invites?.username || '',
        modules: s.jgw_invites?.modules || [],
        sessions: [], tokens: [],
      };
      byInvite[key].sessions.push(s);
      if (s.device_token) byInvite[key].tokens.push(s.device_token);
    });

    return Object.values(byInvite).map(u => {
      const userPts  = pts.filter(p => u.tokens.includes(p.device_token));
      const totalPts = userPts.reduce((s,p) => s + (p.points||0), 0);
      const byModule = {};
      userPts.forEach(p => { byModule[p.module] = (byModule[p.module]||0) + p.points; });

      // Level
      const level = totalPts >= 500 ? 'Advanced'
        : totalPts >= 200 ? 'Intermediate'
        : totalPts >= 50  ? 'Beginner+' : 'Beginner';

      // Last seen
      const lastSeen = u.sessions.map(s => new Date(s.last_seen||0)).sort((a,b)=>b-a)[0];
      const daysAgo  = lastSeen ? Math.floor((Date.now()-lastSeen)/86400000) : 999;

      // Daily activity (last 7 days)
      const now = Date.now();
      const daily = Array.from({length:7}, (_, i) => {
        const dayStart = now - (6-i)*86400000;
        const dayEnd   = dayStart + 86400000;
        return userPts.filter(p => {
          const t = new Date(p.earned_at).getTime();
          return t >= dayStart && t < dayEnd;
        }).reduce((s,p) => s+p.points, 0);
      });

      // Velocity: points per active day in last 7 days
      const activeDays = daily.filter(d=>d>0).length;
      const velocity   = activeDays > 0 ? Math.round(daily.reduce((s,v)=>s+v,0) / activeDays) : 0;

      // Chengyu
      const userCy = cyProg.filter(c => u.tokens.includes(c.device_token));
      const cyAcc  = userCy.length
        ? Math.round((userCy.filter(c=>c.correct).length/userCy.length)*100) : null;

      // Estimated days to next level
      const levelThresholds = { Beginner:50, 'Beginner+':200, Intermediate:500, Advanced:Infinity };
      const nextThreshold = levelThresholds[level] || Infinity;
      const remaining = nextThreshold - totalPts;
      const daysToNextLevel = velocity > 0 ? Math.ceil(remaining / velocity) : null;

      return {
        ...u, totalPts, byModule, level, daysAgo, actions:userPts.length,
        cyAcc, cyTotal:userCy.length, active:u.sessions.some(s=>s.is_active),
        daily, velocity, daysToNextLevel,
      };
    }).sort((a,b) => b.totalPts - a.totalPts);
  }, [sessions, pts, cyProg]);

  // ── Global stats ───────────────────────────────────────────────
  const totalUsers  = userStats.length;
  const activeToday = userStats.filter(u=>u.daysAgo<1).length;
  const activeWeek  = userStats.filter(u=>u.daysAgo<7).length;
  const avgPoints   = totalUsers ? Math.round(userStats.reduce((s,u)=>s+u.totalPts,0)/totalUsers) : 0;

  // Module activity
  const moduleActivity = {};
  pts.forEach(p => { moduleActivity[p.module] = (moduleActivity[p.module]||0) + p.points; });

  // Activity by hour (all users)
  const hourActivity = {};
  pts.forEach(p => {
    const h = new Date(p.earned_at).getHours();
    hourActivity[h] = (hourActivity[h]||0) + 1;
  });

  // Last 7 days global activity
  const now = Date.now();
  const last7 = Array.from({length:7}, (_, i) => {
    const dayStart = now - (6-i)*86400000;
    const dayEnd   = dayStart + 86400000;
    return pts.filter(p => { const t=new Date(p.earned_at).getTime(); return t>=dayStart&&t<dayEnd; }).length;
  });
  const dayLabels = Array.from({length:7}, (_, i) => {
    const d = new Date(now - (6-i)*86400000);
    return ['日','一','二','三','四','五','六'][d.getDay()];
  });

  // Alerts
  const alerts = [
    ...userStats.filter(u=>u.daysAgo>7&&u.daysAgo<999).map(u=>({
      type:'inactive', icon:'⏰', color:'#E65100',
      msg:`${u.label} — ${u.daysAgo}天未登录`
    })),
    ...userStats.filter(u=>u.totalPts<10&&u.daysAgo<14).map(u=>({
      type:'low', icon:'📉', color:'#C62828',
      msg:`${u.label} — 积分很低(${u.totalPts}⭐)，需要帮助`
    })),
    ...userStats.filter(u=>u.daysAgo<2&&u.totalPts>300).map(u=>({
      type:'star', icon:'🌟', color:'#2E7D32',
      msg:`${u.label} — 优秀学生！${u.totalPts}⭐ 积极练习中`
    })),
  ].slice(0,10);

  async function generateInsights(mode='class') {
    setAiLoading(true);
    const key = localStorage.getItem('admin_key_anthropic');
    if (!key) { setAiInsight('⚠️ Add your Anthropic key in API Keys tab.'); setAiLoading(false); return; }

    let prompt;
    if (mode === 'class') {
      prompt = `You are an AI teaching assistant for 大卫学中文 (Chinese learning app).
Analyze this class data and give the teacher 3-4 short actionable paragraphs.
Focus on: overall engagement, students needing attention, popular modules, specific recommendations.
Write in English, be concise and warm.

Data: ${JSON.stringify({
  totalUsers, activeThisWeek:activeWeek, avgPointsPerUser:avgPoints,
  topStudents: userStats.slice(0,3).map(u=>({name:u.label,pts:u.totalPts,level:u.level,velocity:`${u.velocity}pts/day`})),
  modulePopularity: moduleActivity,
  needsAttention: userStats.filter(u=>u.totalPts<20&&u.daysAgo<14).map(u=>u.label),
  inactive7days: userStats.filter(u=>u.daysAgo>7).map(u=>u.label),
}, null, 2)}`;
    } else if (selectedUser) {
      const u = userStats.find(u=>u.label===selectedUser);
      prompt = `Student "${u?.label}" in 大卫学中文:
Level: ${u?.level} (${u?.totalPts} pts) | Velocity: ${u?.velocity} pts/day
Modules: ${JSON.stringify(u?.byModule)} | 成语 accuracy: ${u?.cyAcc!==null?u?.cyAcc+'%':'not started'}
Last active: ${u?.daysAgo} days ago | Days to next level: ${u?.daysToNextLevel || 'unknown'}

Give 3 specific learning suggestions and a motivational note for this student.
Be personal and encouraging. Include Chinese phrases where appropriate.`;
    }

    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'generate_text', provider:'claude', client_key:key, max_tokens:500, prompt }),
      });
      const d = await res.json();
      setAiInsight(d.result || d.content || 'No response.');
    } catch(e) { setAiInsight('Error: '+e.message); }
    setAiLoading(false);
  }

  function exportCSV() {
    const rows = [
      ['Name','Username','Level','Points','Velocity(pts/day)','Last Active','Modules','ChengYu Acc%'],
      ...userStats.map(u => [
        u.label, u.username, u.level, u.totalPts, u.velocity,
        u.daysAgo===999?'Never':`${u.daysAgo}d ago`,
        Object.keys(u.byModule).join('+'),
        u.cyAcc!==null?u.cyAcc+"%":'—',
      ])
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `class_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:V.text3}}>Loading analytics…</div>;

  const TAB_VIEWS = [
    {id:'overview', label:'📊 概览'},
    {id:'students', label:'👥 学生'},
    {id:'activity', label:'📅 活动'},
    {id:'alerts',   label:`🔔 提醒 ${alerts.length>0?`(${alerts.length})`:''}`},
  ];

  return (
    <div style={{maxWidth:1000}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:15,fontWeight:600,color:V.text}}>📊 AI 班级分析</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={loadAll} style={{padding:'6px 12px',fontSize:12,cursor:'pointer',
            borderRadius:8,border:`1px solid ${V.border}`,background:V.bg,color:V.text2}}>↺ 刷新</button>
          <button onClick={exportCSV} style={{padding:'6px 12px',fontSize:12,cursor:'pointer',
            borderRadius:8,border:`1px solid ${V.border}`,background:V.bg,color:V.text2}}>⬇ CSV</button>
          <button onClick={()=>generateInsights('class')} disabled={aiLoading}
            style={{padding:'6px 14px',fontSize:12,cursor:'pointer',borderRadius:8,border:'none',
              background:aiLoading?'#E0E0E0':V.verm,color:aiLoading?'#aaa':'#fff',fontWeight:600}}>
            {aiLoading?'分析中…':'🤖 AI 班级报告'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{display:'flex',gap:4,marginBottom:14,background:V.card,
        borderRadius:12,padding:4,border:`1px solid ${V.border}`}}>
        {TAB_VIEWS.map(v => (
          <button key={v.id} onClick={()=>setView(v.id)}
            style={{flex:1,padding:'7px 8px',borderRadius:9,border:'none',cursor:'pointer',
              fontSize:12,fontWeight:view===v.id?600:400,
              background:view===v.id?V.verm:'transparent',
              color:view===v.id?'#fff':V.text2}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* AI insight box */}
      {aiInsight && (
        <Card style={{background:'#F3E5F5',border:'2px solid #CE93D8',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'#4A148C',marginBottom:6}}>🤖 AI 分析</div>
          <div style={{fontSize:12,color:'#4A148C',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{aiInsight}</div>
          <button onClick={()=>setAiInsight('')}
            style={{marginTop:8,fontSize:11,color:'#CE93D8',background:'none',border:'none',cursor:'pointer'}}>
            关闭 ×
          </button>
        </Card>
      )}

      {/* ── OVERVIEW ── */}
      {view==='overview' && <>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
          <StatBox icon="👥" value={totalUsers}  label="学生总数"  sub="Total students"/>
          <StatBox icon="🔥" value={activeToday} label="今日活跃"  sub="Active today"    color="#E65100"/>
          <StatBox icon="📅" value={activeWeek}  label="本周活跃"  sub="Active this week" color="#1565C0"/>
          <StatBox icon="⭐" value={avgPoints}   label="平均积分"  sub="Avg points"       color="#F57F17"/>
          <StatBox icon="🔔" value={alerts.length} label="待关注" sub="Need attention"  color="#C62828"/>
        </div>

        {/* Module activity bars */}
        <Card style={{marginBottom:14}}>
          <Heading>模块活跃度 Module Activity</Heading>
          {Object.entries(moduleActivity).sort((a,b)=>b[1]-a[1]).map(([mod,p]) => {
            const max = Math.max(...Object.values(moduleActivity));
            return (
              <div key={mod} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{width:44,fontSize:11,color:V.text2,textAlign:'right'}}>{MODULE_LABEL[mod]||mod}</div>
                <div style={{flex:1,height:16,background:'#f0e8d8',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(p/max)*100}%`,
                    background:MODULE_COLOR[mod]||'#888',borderRadius:4}}/>
                </div>
                <div style={{fontSize:11,color:V.text3,width:48}}>{p}⭐</div>
              </div>
            );
          })}
        </Card>

        {/* Level distribution */}
        <Card style={{marginBottom:14}}>
          <Heading>📈 等级分布</Heading>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {['Beginner','Beginner+','Intermediate','Advanced'].map(lvl => {
              const count = userStats.filter(u=>u.level===lvl).length;
              return (
                <div key={lvl} style={{flex:1,minWidth:80,
                  background:(LEVEL_COLOR[lvl]||'#888')+'10',
                  border:`1px solid ${(LEVEL_COLOR[lvl]||'#888')}33`,
                  borderRadius:10,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:700,color:LEVEL_COLOR[lvl]||'#888'}}>{count}</div>
                  <div style={{fontSize:10,color:V.text2,marginTop:2}}>{lvl}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </>}

      {/* ── STUDENTS ── */}
      {view==='students' && (
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <Heading>学生详情 · {totalUsers} 人</Heading>
          </div>
          {userStats.length===0 ? (
            <div style={{textAlign:'center',color:V.text3,fontSize:13,padding:'2rem'}}>
              暂无数据 — 学生登录后显示
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#f5ede0'}}>
                    {['学生','等级','积分','速度','趋势(7日)','上次活跃','成语准确率','升级预估','AI建议'].map(h=>(
                      <th key={h} style={{padding:'7px 8px',textAlign:'left',fontSize:10,color:V.text3,fontWeight:500}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((u,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${V.border}`,
                      background:selectedUser===u.label?'#F3E5F5':'transparent'}}>
                      <td style={{padding:'8px',fontWeight:500,color:V.text,maxWidth:100}}>
                        <div style={{fontSize:12}}>{u.label}</div>
                        {u.username&&<div style={{fontSize:10,color:V.text3,fontFamily:'monospace'}}>{u.username}</div>}
                      </td>
                      <td style={{padding:'8px'}}>
                        <span style={{fontSize:10,padding:'2px 6px',borderRadius:8,
                          background:(LEVEL_COLOR[u.level]||'#888')+'15',
                          color:LEVEL_COLOR[u.level]||'#888',fontWeight:600}}>
                          {u.level}
                        </span>
                      </td>
                      <td style={{padding:'8px',fontWeight:600,
                        color:u.totalPts>200?'#2E7D32':u.totalPts>50?'#F57F17':V.text3}}>
                        {u.totalPts}⭐
                      </td>
                      <td style={{padding:'8px',fontSize:11,color:u.velocity>0?'#2E7D32':V.text3}}>
                        {u.velocity>0?`+${u.velocity}/日`:'—'}
                      </td>
                      <td style={{padding:'8px'}}>
                        <Sparkline data={u.daily} color={LEVEL_COLOR[u.level]||'#8B4513'}/>
                      </td>
                      <td style={{padding:'8px',fontSize:11,
                        color:u.daysAgo===0?'#2E7D32':u.daysAgo<3?'#F57F17':'#c0392b'}}>
                        {u.daysAgo===0?'今天':u.daysAgo===999?'从未':`${u.daysAgo}天前`}
                      </td>
                      <td style={{padding:'8px',fontSize:11}}>
                        {u.cyAcc!==null
                          ?<span style={{color:u.cyAcc>=70?'#2E7D32':'#E65100',fontWeight:600}}>
                              {u.cyAcc}%
                            </span>
                          :<span style={{color:V.text3}}>—</span>}
                      </td>
                      <td style={{padding:'8px',fontSize:11,color:V.text3}}>
                        {u.daysToNextLevel
                          ? `~${u.daysToNextLevel}天`
                          : u.level==='Advanced' ? '🏆' : '—'}
                      </td>
                      <td style={{padding:'8px'}}>
                        <button onClick={()=>{setSelectedUser(u.label);setView('students');generateInsights('student');}}
                          disabled={aiLoading}
                          style={{padding:'3px 8px',fontSize:11,cursor:'pointer',borderRadius:6,
                            border:'1px solid #CE93D8',background:'#F3E5F5',color:'#6A1B9A'}}>
                          🤖
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── ACTIVITY ── */}
      {view==='activity' && <>
        <Card style={{marginBottom:14}}>
          <Heading>📅 最近7天活动（全班）</Heading>
          <div style={{display:'flex',gap:6,alignItems:'flex-end',marginBottom:6}}>
            {last7.map((v,i)=>{
              const max=Math.max(...last7,1);
              return(
                <div key={i} style={{flex:1,textAlign:'center'}}>
                  <div style={{fontSize:9,color:V.text3,marginBottom:2}}>{v||''}</div>
                  <div style={{height:60,background:'#f0e8d8',borderRadius:4,overflow:'hidden',
                    display:'flex',alignItems:'flex-end'}}>
                    <div style={{width:'100%',height:`${Math.max(4,(v/max)*100)}%`,
                      background:v>0?V.verm:'transparent',borderRadius:'2px 2px 0 0'}}/>
                  </div>
                  <div style={{fontSize:9,color:V.text3,marginTop:3}}>{dayLabels[i]}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{marginBottom:14}}>
          <Heading>🕐 学习时间分布（0-23时）</Heading>
          <HourHeatmap hourData={hourActivity}/>
          <div style={{marginTop:6,fontSize:11,color:V.text3}}>
            最活跃时段：{Object.entries(hourActivity).sort((a,b)=>b[1]-a[1])[0]
              ? `${Object.entries(hourActivity).sort((a,b)=>b[1]-a[1])[0][0]}:00` : '—'}
          </div>
        </Card>

        <Card>
          <Heading>📈 学生活跃度排行</Heading>
          {userStats.slice(0,5).map((u,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:20,fontSize:14,textAlign:'center'}}>
                {['🥇','🥈','🥉','4️⃣','5️⃣'][i]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:V.text}}>{u.label}</div>
                <div style={{height:6,background:'#f0e8d8',borderRadius:3,marginTop:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${userStats[0]?.totalPts?Math.round((u.totalPts/userStats[0].totalPts)*100):0}%`,
                    background:LEVEL_COLOR[u.level]||V.verm,borderRadius:3}}/>
                </div>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:LEVEL_COLOR[u.level]||V.verm}}>
                {u.totalPts}⭐
              </div>
            </div>
          ))}
        </Card>
      </>}

      {/* ── ALERTS ── */}
      {view==='alerts' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {alerts.length===0 ? (
            <Card>
              <div style={{textAlign:'center',color:'#2E7D32',fontSize:14,padding:'1rem'}}>
                ✅ 全部正常，没有需要关注的情况
              </div>
            </Card>
          ) : alerts.map((a,i)=>(
            <div key={i} style={{background:a.color+'10',border:`1.5px solid ${a.color}33`,
              borderRadius:12,padding:'12px 16px',display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:20}}>{a.icon}</span>
              <span style={{fontSize:13,color:a.color,fontWeight:500}}>{a.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
