# 教学 Dashboard Spec (super_admin)

**Status:** Design spec for next session.
**Decisions locked (May 06 2026):**
- Audience: super_admin only (in /admin-v2)
- Format: Comprehensive multi-section dashboard
- Sections: Activity overview + per-school + per-teacher + real-time
- Build approach: Real Supabase queries from the start, mock data only where schema unclear

---

## Why this dashboard exists

Super_admin needs platform-level visibility into how 教学 (teaching) is functioning across the system:

- Are teachers actually using the homework feature?
- Which schools are most active?
- Which teachers are most engaged?
- What's happening right now?

Single page, scrollable, refreshable. Lives at `/admin-v2 → 模块内容 → 教学`.

---

## Sections (in order top to bottom)

### Section 1 — Activity overview (the "headline numbers")

Six stat cards in a single row (responsive auto-fit grid):

| Metric | Source | Notes |
|---|---|---|
| 学校数 | `count(distinct schools)` from clf_schools (or clf_user_profiles.school_id) | If no schools table, count distinct school_id |
| 班级数 | `count(*)` from clf_classes | |
| 教师数 | `count(*)` from clf_user_profiles where role='teacher' | |
| 学生数 | `count(*)` from clf_user_profiles where role='student' | |
| 本周作业 | `count(*)` from clf_homework where created_at >= start_of_week | |
| 提交率 | `count(submissions) / (count(homework) * count(students_in_class))` | Approximate; refine later |

Visual: white cards with colored numbers, icon, mini-label.

### Section 2 — Per-school breakdown

Table or card grid showing each school:

| Column | Source |
|---|---|
| 学校名称 | clf_schools.name (or fallback "未命名") |
| 教师数 | join clf_user_profiles where role='teacher' and school_id=this |
| 学生数 | join clf_user_profiles where role='student' and school_id=this |
| 班级数 | join clf_classes where school_id=this |
| 活跃度 | (recent homework events / total students) — 0-100% bar |

Sort by activity descending. Click a school → drilldown (future session).

**Schema check needed before building:** Does `clf_schools` table exist? If not, derive from clf_user_profiles or use a string field.

### Section 3 — Per-teacher breakdown

Card grid: each teacher with their stats. Sort options: most active / alphabetical / by school.

Per teacher card:
- Avatar + name + email + 学校
- 班级数 (count of classes they own)
- 学生数 (count of students across their classes)
- 已布置作业 (count of homework they've assigned)
- 已批改作业 (count of submissions they've graded)
- 最后活动时间 (last homework or grading event)

Visual: white cards with subtle hover, role badge in corner, last-activity time in italic gray.

### Section 4 — Real-time activity feed

Vertical timeline showing the last 20 events across the platform. Format:

```
[Time] [Avatar] [Person] [Verb] [Object]
```

Examples:
- "2 分钟前 · 李老师 布置了作业 「春天的颜色」 to 三年级"
- "5 分钟前 · marco 提交了作业 「拼音练习 3」"
- "12 分钟前 · 李老师 批改了 marco 的作业，得分 85"
- "30 分钟前 · 张校长 创建了班级 「四年级 A 班」"

Auto-refresh every 30s (using `setInterval` or Supabase realtime if reasonable).

Source: Union of recent rows from `clf_homework`, `clf_homework_submissions`, `clf_classes`, optionally `clf_grades`. Each row needs: timestamp, actor, verb, object summary.

**Implementation note:** A view `v_teaching_activity` on the SQL side would simplify this. Otherwise, multiple queries combined client-side and merged by timestamp.

### Section 5 — Submission heatmap (optional, nice-to-have)

7-day × 24-hour grid showing submission volume. Color intensity = number of submissions in that hour bucket. Useful for seeing "学生总是周日晚上交作业" patterns.

Defer to later if Section 4 is enough already.

### Section 6 — Top performers / attention needed

Two side-by-side panels:

**🏆 活跃教师 Top 5**: Teachers ranked by homework assigned + grading activity in past 7 days.

**⚠️ 需要关注**: Items needing super_admin attention:
- Teachers with 0 activity in past 30 days
- Classes with low submission rates (<50%)
- Students with no submissions in past 14 days
- Homework assigned but never graded (>7 days old)

These help super_admin spot problems early.

---

## Database schema needed

These are the tables this dashboard reads. Verify each exists and has the right columns:

```
clf_user_profiles  (user_id, name, email, role, school_id, last_sign_in_at)
clf_classes        (id, name, school_id, teacher_id, created_at)
clf_homework       (id, class_id, teacher_id, title, created_at)
clf_homework_submissions (id, homework_id, student_id, submitted_at, graded_at, score)
clf_schools        (id, name) — may not exist yet
```

If any table/column is missing, we either build it or downgrade that section to mock data + warning banner.

---

## File structure

```
src/admin/v2/
  TeachingDashboard.jsx         ← top-level page
  teaching/
    ActivityOverviewSection.jsx
    PerSchoolSection.jsx
    PerTeacherSection.jsx
    ActivityFeedSection.jsx
    SubmissionHeatmapSection.jsx
    TopPerformersSection.jsx
```

Six files. Each section a self-contained component. Top-level page composes them.

Then in AdminAppV2:
```jsx
if (activeTab === 'pillar-school') {
  return (
    <div>
      <SectionHeader icon="🏫" title="教学" subtitle="..." color="#c41e3a"/>
      <TeachingDashboard/>
    </div>
  );
}
```

---

## Build plan (next session)

| Step | What | Time |
|---|---|---|
| 1 | Run a schema discovery script — list which tables/columns exist | 5 min |
| 2 | Build TeachingDashboard.jsx shell with 6 placeholder section divs | 5 min |
| 3 | Build ActivityOverviewSection (Section 1) with real queries | 15 min |
| 4 | Build PerSchoolSection (Section 2) — handle missing clf_schools gracefully | 15 min |
| 5 | Build PerTeacherSection (Section 3) | 20 min |
| 6 | Build ActivityFeedSection (Section 4) — most complex | 25 min |
| 7 | Build TopPerformersSection (Section 6) | 15 min |
| 8 | Skip Section 5 (heatmap) for now — defer | 0 min |
| 9 | Wire into AdminAppV2 教学 tab | 5 min |
| 10 | Test live | 10 min |

**Total: ~2 hours of focused work.** Realistic for one session if started fresh.

---

## Auto-refresh approach

For the real-time feel:
- Each section has its own `useEffect` with `setInterval(load, 30_000)`
- A "刷新" button at top of dashboard for manual refresh
- "最后更新于 14:32" timestamp visible
- Loading indicators per section (don't block whole page if one query is slow)

---

## Visual design (consistent with V2 light theme)

- Background: cream/beige (existing V2 main area)
- Cards: white with `#e8d5b0` borders
- Stat values: large bold in role-color when relevant
- Hover: subtle lift + accent border
- Activity feed: zebra stripes for readability
- Charts (heatmap if added): subtle red gradient (matches platform theme)
- All in 简体中文 with English subtitles where helpful

Loosely inspired by Vercel/Linear dashboards — clean, dense, scannable.

---

## Out of scope for first build

These can be added in later sessions:
- Drill-down pages (click school → school detail page)
- Date range filters (past 7/30/90 days)
- Export to CSV / PDF
- Per-class detail view
- Student progress overlays (cross-references HSK / module activity)
- Notifications/alerts when thresholds crossed
- Mobile-optimized layout (current spec is desktop-first)

---

## Open design questions

These may affect implementation. Decide before starting next session:

1. **Time zone:** Server time or user's local time for the activity feed?
2. **Privacy:** Should super_admin see student names + emails in feed, or anonymize as "学生 #1234"?
3. **Score visibility:** Show actual scores in feed, or just "已批改"?
4. **Refresh frequency:** 30s default — too aggressive? too slow?
5. **Empty state:** What does the dashboard show on a brand-new platform with no data?

Default answers if unspecified:
1. Server time (UTC), display localized
2. Show real names (super_admin has full access already)
3. Show actual scores
4. 30s refresh
5. "暂无数据" placeholder per section

---

## Resume checklist for next session

When picking this up:

- [ ] Have this doc open
- [ ] Run schema discovery first to confirm clf_schools status
- [ ] Decide on the 5 open design questions above
- [ ] Allocate 2 hours minimum — don't try to squeeze into 30 min
- [ ] Build sections incrementally; deploy after Section 1 + verify, then 2, then 3...
- [ ] Skip Section 5 (heatmap) until everything else works
