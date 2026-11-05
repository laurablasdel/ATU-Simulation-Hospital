# ATU Simulation Hospital — MEDITECH-style EHR

This is the MEDITECH-style version of the ATU Simulation Hospital. Students and faculty use the same shared hospital login and chart in the existing Supabase project. The site is simulation-only; do not enter real patient information.

## How access works

- Students sign in with their name and choose a simulation experience. They see only patients assigned to that experience.
- Faculty use the same shared hospital connection, then unlock Faculty controls with a passphrase that Supabase checks. The passphrase and a short-lived access token are not included in the public website source.
- Faculty can release individual orders, medication orders, results, notes, images, and documents. Students receive only items that have been released.
- Faculty edits to admission-visible chart content and session clock changes apply to the shared chart. Resetting a patient clears that patient’s session documentation and releases, then restores the original admission chart and pending releases.
- The faculty barcode screen and label printer require an unlocked Faculty session.

## Protecting unreleased simulation items

The public app bundle contains only admission-visible patient data. Pending scenario items and their attached images are stored in the private `meditech_private` Supabase schema. The `public.ehr_scenario_releases` table contains only items faculty have released. Row-level security lets approved chart members read those released rows; clients cannot insert or change them directly.

Do not publish event-bearing patient scripts, scenario packets, unreleased images, private exports, passphrases, or Supabase secrets. `js/data/patients-public.js` is a sanitized build output. The source event data is intentionally excluded by the repository `.gitignore` rules. New scenario updates should be prepared privately and loaded into the protected Supabase store.

This protects the new MEDITECH app and its configured chart session. Any older public website or repository copy that still contains scenario details must not be used by students; this app cannot erase files that were already published elsewhere.

## Supabase connection

This build connects to the existing ATU Simulation Hospital Supabase project and shared chart. Its security migration is included in `supabase/migrations/20261105_secure_unreleased_scenarios.sql` for review and version tracking. The private event and barcode catalog seeds must be loaded separately and must never be committed to the public repository.

`js/config.js` may contain the Supabase project URL and publishable key. It must never contain a database password, service-role key, faculty passphrase, or private scenario payload.

## Local preview

Serve the repository root with a static web server, then open `/meditech/`. Shared chart features require an internet connection and the existing hospital login. Faculty release setup also requires the Faculty passphrase.

## Main files

- `index.html` — MEDITECH app entry point
- `labels.html` — faculty-only barcode and label printer
- `js/config.js` — public site and Supabase connection settings
- `js/data/patients-public.js` — sanitized admission-visible charts
- `js/shared.js` — shared chart connection and protected faculty calls
- `supabase/migrations/` — database security changes
