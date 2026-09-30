# Shared cloud record synchronization

The cloud stores individual chart records in `ehr_sync_records`. A small `ehr_sync_heads` revision notification prompts clients to fetch only changes since their last revision. The existing three-way merge and compare-and-save rules continue to protect simultaneous edits and single-use medication overrides.

Completed debrief reports live in `ehr_simulation_reports`; live charts contain report headers. Downloading a report fetches its full body once per browser session. Full backup export hydrates all reports before downloading. Reset never deletes archived reports.

## Deployment

Run `supabase-record-sync.sql` in the existing project, then deploy the frontend with `recordSync: true`. Reload all open hospital tabs once. The migration is transactional, preserves the original `ehr_sync` payload as an administrator-only recovery copy, and keeps access restricted to the existing approved hospital members. Old clients are blocked from overwriting or downloading the frozen legacy row. Do not rerun the original setup SQL to undo this migration; that would re-enable the old transport.

## Validation

After installing development dependencies, run `npm test` and `npm run test:record-sync`. The latter uses an isolated PostgreSQL engine to validate migration, access restrictions, concurrent clients, changed-record transfers, idle clients, archive downloads, resets, and provider decisions. It does not use live patient records or credentials.

Bandwidth already used remains in the billing-cycle total. Measure new daily usage after rollout; smaller transfers do not guarantee that every usage pattern stays within the free quota.
