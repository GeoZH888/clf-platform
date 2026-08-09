# `David` working-folder archive

`C:\Users\Lun_z\Desktop\projects\David` was a scratch folder — 164 files, no
`package.json`, no `src/`, no git. Not an app and not deployable, but it held
the only copy of a good deal of this project's history. It is being replaced by
the jiaguwen project, so the text-sized contents were moved here first.

| Here | From | What it is |
|---|---|---|
| `../../supabase_migrations/archive/` | 66 × `.sql` | The whole schema history. See that README — all 66 were unique. |
| `notes/` | 12 of 13 `.md` | Integration and patch notes: `MIGRATION_GUIDE`, `PHASE_2B_INTEGRATION`, the audio and character-extraction READMEs, several `*_patch` notes. One file withheld — see below. |
| `audits/` | 60 × `.csv` | Supabase query results — user/auth alignment checks, table audits, column-type inspections. Point-in-time snapshots, not live data. |
| `scripts/` | 2 × `.py` | Python helpers found alongside the migrations. |
| `images/` | 2 × `.png` | |

## Deliberately not copied — move these somewhere else yourself

About **1.4 GB** of binaries stayed behind. They do not belong in git, and
committing them would bloat every clone of this repo forever:

| Files | Size | Note |
|---|---|---|
| 2 × `.safetensors` | ~872 MB | Model weights. Re-obtainable from wherever they were trained or downloaded. |
| 6 × `.zip` | ~582 MB | Includes `HUST-OBC.zip`, a published oracle-bone dataset — likely re-downloadable. |
| 2 × `.ttf` | ~11 MB | Fonts. Check the licence before redistributing these anywhere. |

**Copy those to external storage before deleting the folder.** If the
`.safetensors` weights are not reproducible from a script in this repo, they are
the single most irreplaceable thing in there — more so than the SQL, which at
least describes a database that still exists.

## One note was withheld, and its credentials need rotating

`# Supabase — runtime needs these too, no.md` is **not** in this archive. It
held live credentials in plaintext — a Supabase `service_role` JWT, an
Anthropic key, a DeepSeek key and an Azure Speech key. GitHub's push protection
caught it, correctly.

Those four should be **rotated regardless of whether this repo ever saw them**.
They sat unencrypted in an unversioned folder of unknown reach, and the
`service_role` key is the one that matters most: it bypasses RLS entirely, so
it can read and write every table as any user.

The other two files matching a key pattern are fine — `MIGRATION_GUIDE.md` and
`scripts/auto-caption-ai.py` only contain the literal placeholder `sk-ant-...`
in usage examples.

## Status

These are records, not working files. Nothing in the build or the app reads
this directory.
