# Shared cloud record synchronization

The cloud stores individual chart records in `ehr_sync_records`. A small `ehr_sync_heads` revision notification prompts clients to fetch only changes since their last revision. The existing three-way merge and compare-and-save rules continue to protect simultaneous edits and single-use medication overrides.

Completed debrief reports live in `ehr_simulation_reports`; live charts contain report headers. Downloading a report fetches its full body once per browser session. Full backup export hydrates all reports before downloading. Reset never deletes archived reports.

## Deployment

Run `supabase-record-sync.sql` in the existing project, then deploy the frontend with `recordSync: true`. Reload all open hospital tabs once. The migration is transactional, preserves the original `ehr_sync` payload as an administrator-only recovery copy, and keeps access restricted to the existing approved hospital members. Old clients are blocked from overwriting or downloading the frozen legacy row. Do not rerun the original setup SQL to undo this migration; that would re-enable the old transport.

## Validation

After installing development dependencies, run `npm test` and `npm run test:record-sync`. The latter uses an isolated PostgreSQL engine to validate migration, access restrictions, concurrent clients, changed-record transfers, idle clients, archive downloads, resets, and provider decisions. It does not use live patient records or credentials.

Bandwidth already used remains in the billing-cycle total. Measure new daily usage after rollout; smaller transfers do not guarantee that every usage pattern stays within the free quota.

## October 13, 2026: charting and MAR save reliability

The MAR confirmation records an administration only after the student confirms it and the shared revision accepts it. A scan displays the existing order, patient MRN/DOB/allergies, ordered dose/route, timing, and independent-verifier requirement. Unknown, wrong-patient, inactive, ambiguous, changed, or duplicate orders retain the existing safeguards. Repeated clicks are blocked while saving; a retry can recover the same administration after a lost response, including after background synchronization has already recovered it.

Save completion is bound to the patient, screen, fields, and values submitted. It cannot clear a note, assessment, vitals, or I&O draft opened while a MAR write is pending. Saving one MAR row preserves other unfinished rows; a delayed response cannot redraw a newer scan. Verification checkboxes and order selection are never restored as completed verification. Drafts remain local and now explicitly say they are drafts; only completed chart entries synchronize.

Supabase logs for October 12 showed permission failures from legacy `ehr_sync` reads. That table is deliberately frozen. This release versions the browser configuration and changed scripts and defaults a missing `recordSync` flag to the current record transport. It does not restore legacy table access or modify policies. Already-open classroom tabs must reload the updated application once; do not clear site data, which contains local work.

Connection feedback distinguishes local saves from shared saves, explains denied access and expired sign-ins, retains errors across navigation, and reports storage failures without claiming a local save. Sign-out suspends shared writes; reconnecting retries completed local entries. A background sync does not dismiss a failed MAR confirmation.

Validation: `npm test` runs 23 suites, including new `navigation-persistence.cjs` and `sync-errors.cjs`. `npm run test:record-sync` separately exercises actual PostgreSQL functions and RLS in an isolated database, concurrent clients and MAR confirmations, and archive retention. The live project was inspected read-only and its approved-member read/no-op save was checked in a rolled-back transaction. No existing records or access policies were changed. Physical scanner hardware and classroom network behavior require an on-site check.
