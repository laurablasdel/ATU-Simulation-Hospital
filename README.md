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
* Ruth: baseline labs are visible. **Culture Results — Ruth**, **ICU Lab Results — Ruth**, and **Transfusion Orders — Ruth** start pending. Review the repeat chloride source discrepancy before releasing that report.
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
