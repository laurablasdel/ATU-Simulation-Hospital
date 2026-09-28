## Patient-specific label printing

The top Print Patient Wristband + All Patient Medications button prints one patient wristband label followed by one label per unique package linked to that patient (including faculty-release orders) on Avery 5160 sheets. It uses all of that patient's packages regardless of the lower section's selection/quantity controls. The medication-label section now shows only packages linked to the current patient, with selection, copies, starting position and preview unchanged. Patient information appears only on the wristband, never medication package labels.

## Barcode MAR and Avery 5160 medication labels

The shared MAR now scans a patient wristband before every administration, matches MED- package barcodes to the current patient's released orders, and requires explicit confirmation. Manual and barcode entries use saveMedicationAdministration and the existing mar collection. Initials remain blank. Scans and confirmation checkboxes are never restored from drafts; documentation drafts are scoped to the selected medication. Completed saves clear both scan fields. Shared saves, audit attribution, and reset archives use the existing architecture.

In Faculty Mode open a patient, then Medication & Barcode Center. The Avery 5160 section defaults to one label per named package, mixed across 30 positions per sheet. Select all, select this patient's packages, clear selection, choose individual quantities, and choose a starting position 1–30. Print preview is inline. Use US Letter, 100%/Actual size, no headers/footers. Print a plain-paper alignment test before labels. No ordered dose, patient instructions, or simulation warning is printed. Package strengths/forms are only supplied when supported by the provided sources; blank values are omitted and faculty may edit them.

Verification: all 13 patients, 64 eligible medication orders, manual/scanned same-save path, ambiguous orders, wrong/unknown/unordered medication, repeat and one-time doses, verifier checks, reload/storage failures, shared MAR across three levels and retained reset audits. All 61 default Code128 labels decoded independently at 203/300/600 dpi; mixed sheets and starting position 8 tested. Physical Motorola scanner and Avery printer alignment remain to be tested by the user.

## Change Area and level tabs

Students can use Change Area beside their name without signing out. Name/group remain unchanged, drafts are saved before leaving the current chart, and saved documentation stays with its patient. Level 1/2/3 tabs filter patients within the selected clinical area and show area-specific counts.

## Student areas and dropdown stability

Student Mode opens a full-screen sign-in, then one census containing only the selected area across all levels. Medical Surgical: Charles Jones, Jane Fowler, Vincent Brody, Vernon Watkins. Baby Boy Sung stays under OB. ICU retains Ruth/Carl/Karl; Ortho retains Ruth and Progressive Care retains Carl/Karl. Shared refresh preserves expanded chart sections and defers chart redraw while an input, textarea or dropdown is focused, except when a patient reset must apply.

## Student sign-in (September 28, 2026)

In Student Mode, enter first and last name, optional clinical group/cohort, and a clinical area. Sign-in remains in the current browser tab across refreshes and chart changes until Sign Out (closing the tab ends that tab session). Sign Out preserves saved charts and does not disconnect the shared hospital connection. Names/group/area are recorded in the audit; clinical documentation fields stay blank. Area choices follow the reference repository units: Medical Surgical and ICU, Orthopedic Med-Surg, Progressive Care, Psychiatric, plus PEDS and OB for existing patients. Area filters use patient clinicalAreas when configured, then existing specialty/unit information. Ruth remains available under the combined Medical Surgical and ICU area and Orthopedic Med-Surg; Carl/Karl also appear under Progressive Care. This name check-in is separate from Supabase shared-connection authentication.

# ATU Simulation Hospital — editable repository

Prepared September 23, 2026 from `sescobar1/ATU-simulation-hospital`, revision `4a2e11a056a0817bc1df6dc5870234e0a9316138`, with Carl Shapiro and Ruth Livingston updates. The existing patients and application are included. See [SOURCE-AUDIT.md](SOURCE-AUDIT.md) for source discrepancies and unfinished attachments.

## Put this on your own GitHub account

1. Create a new GitHub repository, for example `simulation-hospital`.
2. Unzip this package. Upload the **contents** of the `ATU-simulation-hospital` folder into the repository root. `index.html` must be at the root, alongside the JavaScript files and `assets` folder. Preserve the folder structure.
3. Commit the files to `main`.
4. In the repository, open **Settings → Pages**. Select **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
5. Open the website link GitHub provides after deployment completes. Pages availability depends on the account and repository visibility.

No build step is needed for the website. `node_modules` is not needed. This package does not create or publish the repository for you. These steps follow [GitHub's Pages publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Start and edit

Open the site, select Carl or Ruth, and open Faculty Live Control. The inherited default faculty PIN is `2026`. Change it in the application's settings before classroom use. It is a classroom interface control, not server authentication.

* Carl: **Lab Results (Shapiro new)** starts pending. His original lab image stays visible. Release the new result when the scenario calls for it.
* Ruth: baseline labs and **Ortho Orders** are visible. **ICU Orders** (release at ICU transfer; it also releases her ICU medications on the MAR), **Culture Results — Ruth**, **ICU Lab Results — Ruth**, and **Transfusion Orders — Ruth** start pending. Review the repeat chloride source discrepancy before releasing that report.
* Both: source nursing notes are visible under Nursing Notes. Reset to Base restores the intended starting chart and pending releases.

Faculty edits in the website are saved in that browser. They do **not** rewrite files in GitHub. To make permanent changes for all new users, edit the repository files and commit them. Existing saved charts may keep earlier faculty edits; export anything needed before resetting.

| What to change | File |
| --- | --- |
| Ruth's new lab tables, nursing note, consent link and release cards | `ruth-profile.js` |
| Carl's imported chart text, images and new-lab pending status | `chart-data.js` (search `carl-shapiro`) |
| Carl's missing demographics migration | `chart-admin.js` (search `migrateCarlProfile`) |
| Ruth's missing demographics migration | `ruth-profile.js` (search `migrateRuthProfile`) |
| Starting charts used by Reset to Base | `simulation-defaults.js` |
| Site layout and forms | `index.html` |
| Your optional cloud connection and local storage namespace | `app-config.js` |
| Images and PDF attachments | `assets/` |

Keep record IDs stable when editing. A record's `status: 'pending'` places it behind faculty release; `status: 'released'` displays it initially. Do not change the same record in only one of the live data and reset baseline: after patient changes, run the documented `npm run update:profiles` and tests to refresh Carl/Ruth's reset snapshots.

To restore Ruth's original consent: download its PDF from the [Notion consent page](https://app.notion.com/p/nursing-chart/25d195d201d581aa9910c83836fe6b07), add it as `assets/ruth-consent.pdf`, and change that record's content in `ruth-profile.js` to `[Blood transfusion consent](assets/ruth-consent.pdf)`. Verify the actual document and signature status; do not infer them from the filename. Then refresh the profile defaults.

## Local mode and shared sessions

This copy starts in **local mode** and has no connection to the original owner's database. Saved data, uploaded documents, and live updates are isolated by website path. Two tabs in the same browser on this site can share updates. Different devices or browsers do **not** share changes in local mode.

Cross-device sessions require your own compatible Supabase backend. `app-config.js` has empty URL and publishable-key fields. An administrator must first set up the application's `ehr_sync` table, realtime subscription and appropriate access policies; uploads also use its storage integration. Merely publishing to GitHub Pages does not create a database. Do not insert a service-role key. Runtime error reporting is disabled by default. No cloud setup or cross-device integration has been tested for this new repository.

This is the inherited static simulation application. A public GitHub repository exposes its source and pending scenario material. The faculty PIN and delayed release UI do not make instructor material confidential. Use synthetic simulation data only; a private instructional deployment needs a proper access-control layer.

## Test or preview on your computer

With Node.js 24.15 or later in the Node 24 release line installed (the tests were run on 24.19):

```sh
npm install
npm test
npm run preview
```

Open `http://127.0.0.1:4173`. Stop the preview with Ctrl+C.

`npm test` runs the focused Carl/Ruth release, visibility, saved-state migration and reset checks, plus repository configuration checks. The original `tests/workflow-details.cjs` and `tests/simulation-workflows.cjs` are retained; both already fail on the original source revision and are not represented as passing. See [CHANGELOG.md](CHANGELOG.md).

## Provenance

Original application and existing assets: [ATU Simulation Hospital](https://github.com/sescobar1/ATU-simulation-hospital). Source comparison: the user's authorized Notion simulation workspace. This package does not grant new rights to the original code, branding, scenario documents or images. Preserve existing ownership and obtain any necessary redistribution authorization from their owner.

# September 28 chart and debrief update

- **Student chart check-in:** Student Mode asks for first and last name on each Open Chart click. The name identifies audit activity; it does not fill documentation fields or replace the shared connection login.
- **Vernon:** Routine laboratory results are available immediately. Faculty Live Control has four separate releases: Nurse Driven Heparin Protocol, Heparin Flowsheet, Stat Orders, and Stat Lab Results. The protocol includes the original printable PDF. The released flowsheet saves through the existing chart-form workflow.
- **History times:** `14:35_09/28/2026`. Timezone-qualified timestamps display in America/Chicago; existing timezone-free chart entries retain their entered wall time. Stored values and date/time controls are unchanged.
- **Debrief / Audit:** Select a patient and choose Download Current Simulation. Open the downloaded HTML document in a browser; use Print / Save as PDF if desired. Reset Patient for New Sim archives that patient's completed report before clearing documentation. Prior reports appear under Previous simulations and synchronize with the shared chart. A failed local archive save stops the reset.
- **Audit scope:** Section/document/attachment visits, saved documentation and revisions are recorded from this update onward. Reports also include the current chart, SBAR/provider responses, medication administrations, and released documents. Old unlogged visits and unsaved drafts cannot be reconstructed. Self-entered student names identify activity but are not individually authenticated identities. Private attachments remain in the hospital storage; reports retain their record metadata.
- **Connection:** The email field defaults to Atusim1@atu.edu; the original approved account can still be entered. No password is stored in source code. Use Shared connection on each simulation computer and confirm the connected status. Refresh open hospital tabs after deployment so they use the same chart/audit version.


## Medication workflow and shared alerts

Student Mode scans the wristband and medication before the administration form appears immediately below verification. The manual date/time, initials, Given and Save rows remain in the MAR. A patient mismatch cannot be overridden. An unmatched medication offers Provider override with a required reason. Faculty identify the medication and authorize a dose and route for one administration, or deny the request. Students rescan and explicitly confirm administration after approval. Approval never documents a dose, releases a pending order, or creates a recurring order. High-alert verification is retained.

Approvals and consumption use the existing shared revision-checked save transaction. A shared connection is required, and concurrent students cannot use the same authorization twice. Requests, decisions and administrations appear in the retained simulation audit. Reset invalidates old authorizations.

Observers see all outstanding student alerts (including messages and SBAR notices), cannot dismiss them, and retain them until Student Mode acknowledges them. That acknowledgement clears them for all computers. Opening Messages in Observer Mode does not acknowledge messages. SBAR acknowledgement is separate from faculty accepting the SBAR.

Student section/document/attachment navigation remains in the audit; faculty and observer navigation is excluded. Faculty releases, order/document changes, messages and override decisions remain recorded.

Patient barcode sheets and selectable Avery 5160 medication labels include active and pending medication packages. Vernon’s pending Stat Orders now link the Heparin 10,000 units/10 mL vial and infusion bag to their shared package identifiers. The bag concentration remains unspecified in the supplied information. Printing does not release the medications. Future structured pending medication releases use the same package catalog.

### Reconnection and local controls

All modes share the same existing Supabase simulation connection. Focus, internet restoration, and return to a visible tab trigger a synchronization/reconnection attempt. Idle polling reads only revision metadata when nothing changed, reducing transfers on the free plan. Internet access and an approved hospital sign-in are still needed; sleeping/offline computers cannot receive live changes.

The X on a faculty medication override request closes it locally without an approval, denial, or shared save. It remains closed in that tab across refreshes. Review closed medication requests reopens it; the shared request remains pending. Clear / Start over in the MAR removes the current patient/medication scans, matching result and unsaved confirmation fields. It preserves saved administrations, submitted requests, and manual MAR drafts.
