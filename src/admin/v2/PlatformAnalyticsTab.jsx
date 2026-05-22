// src/admin/v2/PlatformAnalyticsTab.jsx
// Phase 3.5 of docs/build-plan.md — global platform metrics + audit log viewer.
//
// Top section: user counts by role / by tier / signup trend (last 30 days).
// Bottom section: recent rows from clf_admin_audit_log (Phase 3.2 table).
//
// Credit metrics are intentionally NOT shown yet — Phase 2.B hasn't applied
// migration 005 in production, so clf_credit_* tables may be empty / missing.
// Add once credits ship.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const ROLES = ['super_admin', 'school_master', 'teacher', 'student', 'parent'];

const ROLE_LABEL = {
  super_admin:   '超管',
  school_master: '校长',
  teacher:       '教师',
  student:       '学生',
  parent:        '家长',
};

const ROLE_COLOR = {
  super_admin:   '#991b1b',
  school_master: '#92400e',
  teacher:       '#1e40af',
  student:       '#166534',
  parent:        '#6b21a8',
};

export default function PlatformAnalyticsTab() {
  const [stats, setStats]       = useState(null);   // { totalUsers, byRole, byTier, signups30d, activeUsers7d }
  const [auditRows, setAuditRows] = useState(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    (async () => {
      try {
        // ── Users (role/tier counts + recent activity) ────────────────
        const { data: users, error: usersErr } = await supabase
          .from('clf_user_profiles')
          .select('user_id, role, tier_id, created_at, last_sign_in_at, is_active');
        if (usersErr) throw usersErr;

        const byRole = {};
        for (const r of ROLES) byRole[r] = 0;
        const byTier = {};
        let signups30d = 0;
        let activeUsers7d = 0;
        const dayBucket30 = {};   // YYYY-MM-DD → count of signups
        const now = Date.now();
        const D30 = now - 30 * 86400_000;
        const D7  = now - 7  * 86400_000;

        // Pre-fill 30-day bucket so chart shows zero days too.
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now - i * 86400_000);
          const key = d.toISOString().slice(0, 10);
          dayBucket30[key] = 0;
        }

        for (const u of users || []) {
          if (u.role && byRole[u.role] != null) byRole[u.role] += 1;
          if (u.tier_id != null) {
            const k = String(u.tier_id);
            byTier[k] = (byTier[k] || 0) + 1;
          } else {
            byTier['(none)'] = (byTier['(none)'] || 0) + 1;
          }
          const created = u.created_at ? new Date(u.created_at).getTime() : 0;
          if (created >= D30) {
            signups30d += 1;
            const key = new Date(created).toISOString().slice(0, 10);
            if (dayBucket30[key] != null) dayBucket30[key] += 1;
          }
          const lastSign = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
          if (lastSign >= D7) activeUsers7d += 1;
        }

        const signupSeries = Object.entries(dayBucket30)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date: date.slice(5), count })); // MM-DD

        const byRoleSeries = ROLES.map(r => ({ role: ROLE_LABEL[r], count: byRole[r], fill: ROLE_COLOR[r] }));
        const byTierSeries = Object.entries(byTier)
          .sort(([, a], [, b]) => b - a)
          .map(([tier, count]) => ({ tier, count }));

        setStats({
          totalUsers: users?.length || 0,
          byRoleSeries,
          byTierSeries,
          signupSeries,
          signups30d,
          activeUsers7d,
        });

        // ── Audit log (last 50 rows) ──────────────────────────────────
        const { data: audit, error: auditErr } = await supabase
          .from('clf_admin_audit_log')
          .select('id, actor_user_id, target_user_id, action, before_value, after_value, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (auditErr) {
          // Table may not exist yet if migration 007 hasn't been applied. Don't fail the whole tab.
          console.warn('[PlatformAnalytics] audit log query failed:', auditErr.message);
          setAuditRows([]);
        } else {
          setAuditRows(audit || []);
        }
      } catch (e) {
        setError(e?.message || 'Failed to load analytics');
      }
    })();
  }, []);

  if (error) {
    return <div style={errBox}>加载失败: {error}</div>;
  }
  if (!stats) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#a07850' }}>···</div>;
  }

  return (
    <div>
      {/* Top-line stats */}
      <div style={{
        display: 'grid', gap: 10, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        <StatCard label="总用户"    value={stats.totalUsers}    color="#1a0a05"/>
        <StatCard label="30 天新增" value={stats.signups30d}    color="#166534"/>
        <StatCard label="7 天活跃"  value={stats.activeUsers7d} color="#1e40af"/>
      </div>

      {/* Role distribution */}
      <ChartCard title="按角色分布">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.byRoleSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b0"/>
            <XAxis dataKey="role" tick={{ fontSize: 11, fill: '#5d4630' }}/>
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5d4630' }}/>
            <Tooltip/>
            <Bar dataKey="count">
              {stats.byRoleSeries.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Signup trend */}
      <ChartCard title="过去 30 天新增用户">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.signupSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b0"/>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5d4630' }} interval={3}/>
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5d4630' }}/>
            <Tooltip/>
            <Line type="monotone" dataKey="count" stroke="#c41e3a" strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tier distribution */}
      {stats.byTierSeries.length > 0 && (
        <ChartCard title="按 Tier 分布">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.byTierSeries.map(({ tier, count }) => (
              <div key={tier} style={{
                background: '#fff', border: '1px solid #e8d5b0',
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
              }}>
                <span style={{ color: '#5d4630' }}>Tier {tier}: </span>
                <strong style={{ color: '#1a0a05' }}>{count}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Audit log */}
      <ChartCard title="审计日志（最新 50 条）">
        {(auditRows == null) && <div style={{ padding: 20, color: '#a07850' }}>加载中…</div>}
        {auditRows && auditRows.length === 0 && (
          <div style={{
            padding: 24, textAlign: 'center', fontSize: 12, color: '#a07850',
            background: '#fffaf3', borderRadius: 8,
          }}>
            暂无审计记录。应用迁移 007_admin_security.sql 后，管理员操作会自动记录于此。
          </div>
        )}
        {auditRows && auditRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fffaf3', textAlign: 'left' }}>
                  <th style={th}>时间</th>
                  <th style={th}>操作</th>
                  <th style={th}>操作者</th>
                  <th style={th}>目标</th>
                  <th style={th}>变更</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f5e6c8' }}>
                    <td style={td}>{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                    <td style={td}><ActionBadge action={r.action}/></td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace' }}>{(r.actor_user_id || '').slice(0, 8)}</td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace' }}>{(r.target_user_id || '').slice(0, 8) || '—'}</td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', color: '#5d4630' }}>
                      <AuditDelta before={r.before_value} after={r.after_value}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 11, color: '#5d4630', opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'STKaiti','KaiTi',serif" }}>
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 12, padding: 16, marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#5d4630', marginBottom: 12,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const ACTION_COLOR = {
  role_change:    { bg: '#fef3e2', fg: '#92400e' },
  user_create:    { bg: '#f0fdf4', fg: '#166534' },
  user_delete:    { bg: '#fef2f2', fg: '#991b1b' },
  password_reset: { bg: '#fff7ed', fg: '#9a3412' },
  module_change:  { bg: '#faf5ff', fg: '#6b21a8' },
};
const ACTION_LABEL = {
  role_change:    '角色变更',
  user_create:    '创建用户',
  user_delete:    '删除用户',
  password_reset: '重置密码',
  module_change:  '权限变更',
};

function ActionBadge({ action }) {
  const c = ACTION_COLOR[action] || { bg: '#f3f4f6', fg: '#374151' };
  return (
    <span style={{
      background: c.bg, color: c.fg,
      padding: '2px 8px', borderRadius: 10,
      fontSize: 10, fontWeight: 700,
    }}>{ACTION_LABEL[action] || action}</span>
  );
}

function AuditDelta({ before, after }) {
  if (!before && !after) return null;
  if (action(before, after, 'role')) {
    return <span>{(before?.role || '—')} → {(after?.role || '—')}</span>;
  }
  // Default: dump compact JSON of changed fields, max ~60 chars.
  const text = JSON.stringify({ before, after });
  return <span>{text.slice(0, 60)}{text.length > 60 ? '…' : ''}</span>;
}
function action(before, after, key) {
  return (before && before[key] !== undefined) || (after && after[key] !== undefined);
}

const th = { padding: '8px 10px', fontSize: 11, color: '#5d4630', fontWeight: 700 };
const td = { padding: '6px 10px' };
const errBox = {
  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
  borderRadius: 8, padding: 12, fontSize: 12,
};
