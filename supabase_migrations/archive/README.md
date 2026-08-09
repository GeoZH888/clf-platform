# Archived migrations — recovered from the `David` working folder

These 66 `.sql` files came from `C:\Users\Lun_z\Desktop\projects\David`, a
scratch folder that was never under version control and is being replaced.

**Every one of them was unique.** Checked by content hash against all 41 `.sql`
files already in this repo: the overlap was zero. This directory is the only
copy of the schema history it records — the numbered series (`000_`–`013_`), the
`clf_*` and `jgw_*` migrations, the words / poems / grammar / chengyu / pinyin
work, and the pre-check / post-check / rollback trio that went with the big
migrations.

## What this is not

They are **not** a runnable migration chain, and committing them does not mean
they should be applied. Several are alternates of one another — for example
`001_new_infrastructure_SAFE.sql` beside `001_new_infrastructure_BULLETPROOF.sql`,
and `02_migration.sql` beside `02_migration (1).sql` and `02_migration_v2.sql`.
Which one actually ran against production is not recorded anywhere in the files.

Treat this as **history to read**, not a sequence to execute. Anything intended
to run from now on belongs in `supabase_migrations/` proper, numbered and
described.

## Why they were kept

The live schema was built by these scripts. Without them, the only description
of how a table reached its current shape is the table itself. That is enough
until something needs to be reproduced, audited, or rolled back — and then it
is not.

Filenames are unchanged, including the awkward ones with spaces and `(1)`
suffixes, so anything referring to them elsewhere still matches.
