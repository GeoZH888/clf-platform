# 🎯 练字 Adaptive Learning — Integration Guide

Connects the existing `useAdaptiveLearning` hook to the 练字 module. Adds a "Next Up" card that surfaces 5 due/new characters AND reorders character sets so ones with due reviews appear first.

## What's NOT being rebuilt

The platform already has:
- `useAdaptiveLearning.js` — full adaptive engine with SM-2 spaced repetition
- `AdaptiveCard.jsx` — tier/streak/heatmap UI
- `usePracticeLog.js` — already records to `jgw_practice_log`

We're connecting these existing pieces to the 练字 module — not duplicating.

## Files

| File | Path | Action |
|---|---|---|
| `005_lianzi_progress.sql` | Run in Supabase | NEW |
| `usePracticeLog.js` | `src/hooks/usePracticeLog.js` | REPLACE |
| `HomeScreen.jsx` | `src/components/HomeScreen.jsx` | REPLACE |

## Step 1 — Run SQL

Paste `005_lianzi_progress.sql` into Supabase SQL editor → Run.

Verify:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'clf_lianzi_progress'
order by ordinal_position;
-- expect: id, user_id, device_token, character, correct, score, mode, practiced_at
```

## Step 2 — Drop in the 2 JS/JSX files

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

Move-Item -Force $HOME\Downloads\usePracticeLog.js  src\hooks\usePracticeLog.js
Move-Item -Force $HOME\Downloads\HomeScreen.jsx     src\components\HomeScreen.jsx
```

## Step 3 — Build, push, deploy

```powershell
npm run build

git add -A
git commit -m "feat(lianzi): connect adaptive learning — Next Up card + set reordering"
git push
```

## Step 4 — Test

### A. Verify the SQL writes work

1. Hard-refresh `/practice` (or wherever 练字 lives) in incognito
2. Practice writing one character — submit a stroke completion
3. In Supabase SQL editor:
   ```sql
   select * from clf_lianzi_progress
   order by practiced_at desc limit 5;
   ```
4. You should see your write. Both `jgw_practice_log` AND `clf_lianzi_progress` got the same write.

### B. Verify the Next Up card appears

1. Practice 5-10 different characters with various scores (some > 70, some < 70)
2. Go back to 练字 home screen
3. Below the AdaptiveCard, you should see a new card titled **🎯 接下来练这些字**
4. It shows up to 5 character buttons:
   - **Orange border + "复习" label** = due for review (you've practiced it but interval has elapsed)
   - **Brown border + "新" label** = new (never practiced)
   - **Green border + "✓" label** = mastered (rare — only shown if nothing due/new)

### C. Verify set reordering

1. Practice characters from Set B (skip Set A entirely)
2. Wait ~4 hours (the first SM-2 interval)
3. Refresh — Set B should now appear ABOVE Set A in the list (it has due reviews)
4. The first set will show a `📚 N个待复习` badge in its description

If you don't want to wait, manually backdate a row:

```sql
update clf_lianzi_progress
set practiced_at = now() - interval '5 hours'
where character = '木';
```

Then refresh — 木 should appear in the Next Up card as "复习".

## How adaptive priority works

The `setAdaptivePriority(set)` formula:

```js
score = (chars due for review) * 100 + (new chars) * 1
```

Sets with even one due review jump above sets with only new chars. Sets you've completed with mastery score > 0.8 sink to the bottom (priority near 0).

This ordering uses the existing `useAdaptiveLearning` hook — no new logic.

## What "due for review" actually means

From `useAdaptiveLearning.js` line 36 — SM-2 intervals:

```
After 1st practice → due in  4 hours
After 2nd practice → due in  1 day
After 3rd practice → due in  3 days
After 4th practice → due in  7 days
After 5th practice → due in  14 days
After 6th+ practice → due in 30 days
```

The hook checks: `if last practice was more than [interval] hours ago, mark as due`.

## Cold start handling

For a brand-new student who has never practiced anything:
- `clf_lianzi_progress` is empty
- All chars are "new"
- Adaptive queue picks 5 chars by difficulty (lowest first), respecting their HSK level
- Sets appear in original order (no reorder since nothing is due)
- Next Up card appears once they have any progress

This is graceful — no broken UI, no empty states.

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Next Up card doesn't appear | `flatChars` is empty (no character data passed) | Verify `sets` prop has `chars` arrays with `c` field |
| Card shows but characters look wrong | `c.c` field name mismatch | Check that your set data uses `chars: [{c: '木'}]` shape |
| Build error: `useAdaptiveLearning is not exported` | Wrong import path | Verify file is at `src/hooks/useAdaptiveLearning.js` |
| Database write fails RLS | Anon insert policy missing | Check Step 1 verification — RLS policy "Insert lianzi progress" should exist |
| Sets don't reorder | Adaptive data not loading | Check browser DevTools → Network for `clf_lianzi_progress` query results |

## Rollback if needed

If the new HomeScreen breaks something:

```powershell
git revert HEAD
git push
```

The `clf_lianzi_progress` table doesn't need to be dropped — it's harmless as data sits there. The dual-write in `usePracticeLog.js` won't cause issues either; old code reading from `jgw_practice_log` still works.

## What's intentionally NOT included

- **Pinyin tones / mnemonics in the queue** — chars are shown without pinyin to keep the card compact
- **Skip / "I knew it" buttons** — practice mode stays the source of truth for correctness
- **Auto-advance** — clicking a queue char takes you to its set, not directly to practice mode (would require a deeper App.jsx change)
- **A/B testing for adaptive vs random** — premature; observe student behavior first

These are all reasonable later additions if students engage with the queue but want shortcuts.

## Verifying it's actually working

Three signals to look for after a week of student use:

1. **Click-through on Next Up cards** — if students never tap them, the card isn't useful. Pull from logs:
   ```sql
   -- Practices grouped by mode (look for 'list' vs 'next_up')
   select mode, count(*) from clf_lianzi_progress
   where practiced_at > now() - interval '7 days'
   group by mode;
   ```

2. **Mastery progression** — students should accumulate high-mastery chars over time:
   ```sql
   select character, count(*) as practices,
          avg(case when correct then 1 else 0 end) as accuracy
   from clf_lianzi_progress
   where user_id = '<student>'
   group by character
   having count(*) >= 3
   order by accuracy desc;
   ```

3. **Return rate after Next Up** — do students come back the day after seeing a "due" card? Track via `practiced_at` timestamps clustered by user_id.

If the answers are "yes, yes, yes" — adaptive is working. If "no, flat, no" — the queue isn't compelling and you should revisit.
