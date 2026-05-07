# 教学 Tab — Patch for `SuperAdminPage.jsx`

Five inserts into your existing file. Locations referenced by the comments already in your code.

---

## ⚠️ Schema assumptions — verify these column names

Before pasting, run this in Supabase SQL editor and adjust below if anything's missing:

```sql
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema='public' 
  AND table_name IN ('dwxz_classes','dwxz_class_lessons','dwxz_homework','dwxz_join_requests','dwxz_users_view')
  AND column_name IN ('id','name','title','teacher_id','school_id','grade_level','is_active','status','class_id','due_date','full_name','email','role','created_at')
ORDER BY table_name, column_name;
```

If any of `name`, `title`, `teacher_id`, `school_id`, `grade_level`, `due_date`, `full_name` don't exist on the expected table, swap the variant your schema uses. Everything else is defensive (uses `?.` and fallbacks).

---

## ① Add new state (right after `const [aiSettings,setAiSettings]= useState({});`, ~line 27)

```jsx
  const [teaching,  setTeaching]  = useState(null);
```

---

## ② Add load trigger (in the `useEffect` block, ~line 46, alongside the others)

```jsx
    if (tab === 'teaching') loadTeaching();
```

The block becomes:

```jsx
  useEffect(() => {
    if (!supabase) return;
    if (tab === 'overview') loadOverview();
    if (tab === 'users')    loadUsers();
    if (tab === 'kb')       loadKB();
    if (tab === 'config')   loadConfig();
    if (tab === 'teaching') loadTeaching();   // ← new
  }, [tab, supabase]);
```

---

## ③ Add `loadTeaching` function (after `loadKB`, before `loadConfig`)

```jsx
  async function loadTeaching() {
    setLoading(true);
    const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();

    // Run counts and lists in parallel; use Promise.allSettled so a missing
    // table or column never blanks the whole panel.
    const queries = await Promise.allSettled([
      supabase.from('dwxz_schools').select('id', { count:'exact', head:true }),
      supabase.from('dwxz_classes').select('id', { count:'exact', head:true }).eq('is_active', true),
      supabase.from('dwxz_classes').select('id', { count:'exact', head:true }),
      supabase.from('dwxz_class_lessons').select('id', { count:'exact', head:true }).gte('created_at', weekAgo),
      supabase.from('dwxz_homework').select('id', { count:'exact', head:true }).gte('created_at', weekAgo),
      supabase.from('dwxz_homework_submissions').select('id', { count:'exact', head:true }).gte('created_at', weekAgo),
      supabase.from('dwxz_join_requests').select('id', { count:'exact', head:true }).eq('status','pending'),
      supabase.from('dwxz_classes').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('dwxz_class_lessons').select('*').order('created_at',{ascending:false}).limit(10),
      supabase.from('dwxz_homework').select('*').order('created_at',{ascending:false}).limit(10),
      supabase.from('dwxz_schools').select('id,name').limit(50),
    ]);

    const get = (i) => queries[i].status === 'fulfilled' ? queries[i].value : { count:0, data:[] };
    const recentClasses  = get(7).data || [];
    const recentLessons  = get(8).data || [];
    const recentHomework = get(9).data || [];
    const schoolsList    = get(10).data || [];

    // Resolve teacher names for the recent classes table
    const teacherIds = [...new Set(recentClasses.map(c => c.teacher_id).filter(Boolean))];
    let teacherMap = {};
    if (teacherIds.length) {
      const { data: teachers } = await supabase
        .from('dwxz_users_view')
        .select('id,full_name,email')
        .in('id', teacherIds);
      teacherMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));
    }

    // Detect inactive classes (no lessons in 7 days)
    let inactiveCount = 0;
    if (recentClasses.length) {
      const classIds = recentClasses.filter(c => c.is_active !== false).map(c => c.id);
      if (classIds.length) {
        const { data: recentLessonsByClass } = await supabase
          .from('dwxz_class_lessons')
          .select('class_id')
          .gte('created_at', weekAgo)
          .in('class_id', classIds);
        const activeClassIds = new Set((recentLessonsByClass || []).map(l => l.class_id));
        inactiveCount = classIds.filter(id => !activeClassIds.has(id)).length;
      }
    }

    const schoolMap = Object.fromEntries(schoolsList.map(s => [s.id, s.name]));

    setTeaching({
      schools:         get(0).count || 0,
      activeClasses:   get(1).count || 0,
      totalClasses:    get(2).count || 0,
      lessonsWeek:     get(3).count || 0,
      homeworkWeek:    get(4).count || 0,
      submissionsWeek: get(5).count || 0,
      pendingJoins:    get(6).count || 0,
      recentClasses,
      recentLessons,
      recentHomework,
      teacherMap,
      schoolMap,
      inactiveCount,
      errors: queries.map((q,i) => q.status === 'rejected' ? { i, msg: q.reason?.message } : null).filter(Boolean),
    });
    setLoading(false);
  }
```

---

## ④ Add to `TABS` array (~line 193)

```jsx
  const TABS = [
    { id:'overview', icon:'📊', label:lbl('系统概览','Overview') },
    { id:'users',    icon:'👥', label:lbl('用户与访问','Users & Access') },
    { id:'teaching', icon:'📚', label:lbl('教学','Teaching') },   // ← new
    { id:'kb',       icon:'🧠', label:lbl('知识库监控','KB Monitor') },
    { id:'config',   icon:'⚙️', label:lbl('系统配置','Config') },
    { id:'panda',    icon:'🐼', label:'Panda Studio' },
  ];
```

---

## ⑤ Add the panel block (after the `{tab === 'kb' && ...}` block, before `{tab === 'config' && ...}`)

```jsx
      {/* ══ TEACHING ══ */}
      {tab === 'teaching' && teaching && (
        <div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
            {[
              { icon:'🏫', val:teaching.schools,         label:lbl('学校','Schools'),       color:C.primary },
              { icon:'📚', val:`${teaching.activeClasses}/${teaching.totalClasses}`,
                                                          label:lbl('活跃班级','Active Classes'), color:C.info },
              { icon:'📅', val:teaching.lessonsWeek,     label:lbl('本周课时','Lessons (7d)'),   color:C.success },
              { icon:'📝', val:teaching.homeworkWeek,    label:lbl('本周作业','Homework (7d)'),  color:'#7c3aed' },
              { icon:'✅', val:teaching.submissionsWeek, label:lbl('本周提交','Submissions (7d)'), color:'#0891b2' },
              { icon:'🤝', val:teaching.pendingJoins,    label:lbl('待审请求','Pending Joins'),  color:C.warning },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'0.75rem', marginBottom:0 }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val ?? '…'}</div>
                <div style={{ fontSize:11, color:C.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Health alert */}
          {teaching.inactiveCount > 0 && (
            <div style={{ ...S.card, background:'#fef3c7', borderColor:'#f59e0b', color:'#92400e' }}>
              ⚠️ {lbl(
                `${teaching.inactiveCount} 个活跃班级最近 7 天没有课时记录`,
                `${teaching.inactiveCount} active class(es) have no lessons in the past 7 days`
              )}
            </div>
          )}

          {/* Two-column: classes + activity */}
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:'1rem' }}>

            {/* Recent classes */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>📚 {lbl('最近班级','Recent Classes')}</h3>
              {teaching.recentClasses.length === 0 ? (
                <div style={{ color:C.muted, fontSize:13 }}>{lbl('暂无班级','No classes yet')}</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid var(--border)`, color:C.muted, textAlign:'left' }}>
                        <th style={{ padding:'6px 4px' }}>{lbl('班级','Class')}</th>
                        <th style={{ padding:'6px 4px' }}>{lbl('教师','Teacher')}</th>
                        <th style={{ padding:'6px 4px' }}>{lbl('学校','School')}</th>
                        <th style={{ padding:'6px 4px' }}>{lbl('级别','Level')}</th>
                        <th style={{ padding:'6px 4px' }}>{lbl('状态','Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teaching.recentClasses.map(c => {
                        const teacher = teaching.teacherMap[c.teacher_id];
                        const school = teaching.schoolMap[c.school_id];
                        return (
                          <tr key={c.id} style={{ borderBottom:`1px solid var(--border)` }}>
                            <td style={{ padding:'6px 4px', fontWeight:600 }}>{c.name || c.class_name || c.id?.slice(0,8)}</td>
                            <td style={{ padding:'6px 4px' }}>{teacher?.full_name || teacher?.email || (c.teacher_id?.slice(0,6)+'…') || '—'}</td>
                            <td style={{ padding:'6px 4px', color:C.muted }}>{school || '—'}</td>
                            <td style={{ padding:'6px 4px', color:C.muted }}>{c.grade_level || c.level || '—'}</td>
                            <td style={{ padding:'6px 4px' }}>
                              <span style={S.badge(
                                c.is_active === false ? '#991b1b' : '#166534',
                                c.is_active === false ? '#fee2e2' : '#dcfce7'
                              )}>
                                {c.is_active === false ? lbl('已归档','Archived') : lbl('活跃','Active')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Activity feed */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>⏱ {lbl('近期活动','Recent Activity')}</h3>
              {(() => {
                const feed = [
                  ...teaching.recentLessons.map(l => ({ ...l, _kind:'lesson' })),
                  ...teaching.recentHomework.map(h => ({ ...h, _kind:'homework' })),
                ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12);

                if (feed.length === 0) return <div style={{ color:C.muted, fontSize:13 }}>{lbl('暂无活动','No activity')}</div>;

                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {feed.map((item, i) => (
                      <div key={`${item._kind}-${item.id || i}`} style={{
                        padding:'6px 8px', fontSize:12, borderRadius:6,
                        background:'var(--background)', display:'flex', alignItems:'center', gap:8,
                      }}>
                        <span>{item._kind === 'lesson' ? '📅' : '📝'}</span>
                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.title || item.name || (item._kind === 'lesson' ? lbl('课时','Lesson') : lbl('作业','Homework'))}
                        </span>
                        <span style={{ color:C.muted, fontSize:11 }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Soft errors (column/table mismatches will surface here) */}
          {teaching.errors?.length > 0 && (
            <div style={{ ...S.card, marginTop:'1rem', fontSize:11, color:C.muted }}>
              <strong style={{ color:C.warning }}>⚠ {lbl('部分查询失败','Some queries failed')}:</strong>{' '}
              {teaching.errors.map(e => `[${e.i}] ${e.msg}`).join(' · ')}
            </div>
          )}
        </div>
      )}
```

---

## How to verify after pasting

1. Save the file, hot-reload should pick it up.
2. In the SuperAdmin page, the new **📚 教学** tab appears between 用户与访问 and 知识库监控.
3. Click it. Stats grid loads, recent classes table populates, activity feed shows.
4. **If you see the soft-error footer at the bottom:** one of my column-name guesses is wrong. The error message tells you which table+column. Adjust the `loadTeaching` query and reload.
5. **If a stat shows `0` but you know data exists:** likely `is_active` or `status` value mismatch. Check actual values in the table:
   ```sql
   SELECT DISTINCT is_active FROM dwxz_classes;
   SELECT DISTINCT status FROM dwxz_join_requests;
   ```

## What's intentionally NOT in this first pass

- **No CRUD** (create/edit/archive class). Read-only oversight only.
- **No drilldowns** to per-class detail pages. Could add later — easy to wire each class row to navigate to a teacher/class page.
- **No charts.** Stats are numeric only. If you want trend lines (lessons per week over the last 8 weeks), that's a Recharts add-on for round 2.

If round-1 works, those three are the natural next additions.
