# ATU Simulation Hospital — MEDITECH-style chart

This public site hosts the MEDITECH-style simulation chart for the ATU Simulation Hospital. Students and faculty use the existing shared hospital sign-in and chart. The site is for simulation education only; do not enter real patient information.

## Access

- Students choose their simulation experience and see its patients.
- Faculty unlocks Faculty controls with a passphrase checked by the existing Supabase project.
- Only admission-visible chart content is included in the website files. Unreleased scenario events and the complete medication barcode catalog are stored in the protected Supabase database and are returned to Faculty only after unlock.
- The app does not include a Supabase service-role key or the faculty passphrase.

## Opening the chart

Open the [simulation hospital](./meditech/). Shared charts and faculty release controls require the existing hospital connection.

## Safe updates

Do not add source scenario scripts, packet documents, private event seeds, unreleased event images, or the full medication barcode catalog to this public repository. Build the sanitized admission chart before publishing changes. Do not enter real patient information.
