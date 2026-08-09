-- ============================================================
-- PRE-MIGRATION VERIFICATION (Day 1, Stage A)
-- ============================================================
-- Run this FIRST. Save the output. Compare to post-migration.
-- If any of these queries return unexpected results, STOP and ask.

-- 1. Snapshot of clf_user_modules data
select
  'BEFORE: clf_user_modules row count' as label,
  count(*) as value
from clf_user_modules
union all
select
  'BEFORE: distinct module_id values',
  count(distinct module_id)
from clf_user_modules;

-- 2. Distribution of module_id values (so we can verify migration worked)
select module_id, count(*) as row_count, count(distinct user_id) as user_count
from clf_user_modules
group by module_id
order by module_id;

-- 3. Snapshot of jgw_invites.modules arrays (for Phase 2 reference)
select
  'BEFORE: jgw_invites with modules' as label,
  count(*) as value
from jgw_invites
where modules is not null;

-- 4. Sample zhang's current state (to verify zhang doesn't lose access)
select r.username, r.approved_user_id, count(um.user_id) as toggle_count,
       array_agg(um.module_id order by um.module_id) as modules_set
from jgw_registrations r
left join clf_user_modules um on um.user_id = r.approved_user_id
where r.username = 'zhang'
group by r.username, r.approved_user_id;

-- 5. List ALL module_ids currently in jgw_invites.modules (deduplicated)
select distinct unnest(modules) as legacy_module_id
from jgw_invites
where modules is not null
order by 1;
