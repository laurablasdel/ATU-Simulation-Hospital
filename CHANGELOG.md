## September 25 — shared simulation and durable charting

* Add authenticated shared sessions with conflict retries, reset protection, and live messages/alerts.
* Keep chart drafts across browser sessions and preserve entered Stephanie vitals during startup.
* Show orders, assessment history, and vital history above reference documents.
* See SHARED-SIMULATION.md for setup, access limits, and verification.

# Changes for the repository owner

## Roles and provider notifications (September 26, 2026)

* **Release alerts are acknowledged once.** Acknowledge now updates the current shared chart. Previously it updated a copy that the 5-second shared refresh had replaced, so the alert returned and students had to acknowledge it repeatedly. Each computer also remembers what it acknowledged, and a popup already handled on another computer closes itself.
* **Observer Mode** for debrief-room computers. Observers browse the chart independently and view it read-only. Release notices appear briefly and close on their own. To set a computer up, open the site with `?mode=observer` or use Faculty Live Control → This Computer's Role. The faculty PIN is needed to leave Observer Mode.
* **Provider Notification (SBAR)** screen. Students send an SBAR (Routine, Urgent or STAT) to the provider.
  * **Faculty:** get a popup to accept it, with an optional provider response. The response reaches the student as a message alert.
  * **Observers:** get a popup to close, wherever they are in the chart. It is the only thing observers need to close.
  * **SBAR History:** each patient's SBARs are listed on the SBAR screen.
  * **Reset:** resetting a patient clears that patient's SBARs.
* Test: `tests/roles-sbar.cjs`. It covers a control-room, simulation-room and two debrief computers sharing one chart.

## Level 3 chart fixes (September 24, 2026)

* Removed the WDL "Physical Assessment" form from Brody, Livingston, Shapiro, Sharp and Watkins. It showed raw text with nothing to chart except name and shift. Students use the Detailed Head-to-Toe Assessment instead.
* Carl and Karl: removed the blank "ER VS" row and the empty columns. The ER vital signs are now read-only, like Ruth's. Students chart new vitals in the Vitals / Flowsheet form.
* Ruth: she now starts on the Ortho Orders, transcribed from the Notion Ortho Orders page. **ICU Orders** starts pending. When faculty releases it at transfer, the NS 500 mL bolus, NS 125 mL/hr, norepinephrine and vancomycin appear on the MAR, and LR 75 mL/hr and piperacillin-tazobactam are discontinued. The NS bolus row was removed from the starting paper MAR.
* Faculty Live Control no longer shows the student "unfinished entries" warning after an edit is saved. Each faculty card is saved by its own button. Student charting screens still warn before leaving.
* Faculty MAR now shows the same medication table as students. Unreleased medications (such as Ruth's ICU medications) are listed separately under "Not Yet Released — Students Cannot See These".
* Ruth's ICU norepinephrine now shows on the MAR as **Norepinephrine**, dose 2 mcg/min, IV infusion, continuous. The start and titration instructions appear as a note under the name. Saved charts with the old long entry are updated. Medication notes now display on the MAR.
* Ruth's MAR always follows her ICU Orders. Before release, the ICU medications are hidden and LR/piperacillin-tazobactam are active. After release, it's the reverse. This holds even if **Update Base Patient** was clicked after the ICU release, which previously left the ICU medications on the MAR after a reset.
* Ruth's ICU drugs (norepinephrine, vancomycin, normal saline) are recognized by drug name, so renamed or faculty-edited copies also stay hidden until ICU Orders are released. Duplicate norepinephrine rows are merged.
* One-time migration updates charts and reset bases already saved in a browser. Reset defaults were updated. Test: `tests/level3-assessment-fixes.cjs`.

## Carl Shapiro

* Changed `chart-262195d201d580e18688dc6f4d7711db` (Lab Results / Shapiro new) from immediately visible to pending faculty release. Original baseline lab record and both original images are retained.
* Added the missing Today/LJ nursing note, including the ED oxygen, aspirin, nitroglycerin, saline bolus, ECG and antiplatelet/anticoagulation narrative.
* Filled generic/missing header fields with MRN PCS71900, Dr. Chin A. Revis, Progressive Care Unit, male, 110 kg and 175 cm.
* Added a one-time migration for older saved charts and saved reset bases; explicit existing queue releases and student notes are preserved.

## Ruth Livingston

* Replaced the baseline lab placeholder with readable tables transcribed from the Notion PDF. Yesterday/Today CBC columns and Today chemistry values are retained; blood culture starts pending and blood type is A+.
* Added the missing Today 0600/VR nursing note about confusion, catheter removal, incontinence, urethral bleeding, bathing and pending repeat urinalysis.
* Added pending faculty release records for the positive E. Cloacae culture, repeat ICU results, and Dr. Marcus's two-unit PRBC transfusion/type-and-cross orders.
* Filled generic/missing header fields with MRN PCS10800, Hans Olsson MD, orthopedic surgical unit, female, 54 kg, 160 cm and A+. ICU transfer orders remain in the chart; the header describes the source admission unit.
* Retained the original consent page link with an explicit missing-local-attachment notice. The PDF itself is not bundled.
* Added migration of old placeholders and reset bases without replacing subsequent faculty-edited content.

## Application/package

* Added `ruth-profile.js` as a compact editable source for Ruth additions.
* Displayed both source nursing notes on the Nursing Notes screen.
* Kept all Level 3 patients discoverable when their source unit names replace generic unit labels.
* Updated Carl/Ruth reset defaults and linked migrations to shared-state refresh.
* Added `app-config.js`. Removed the original owner's cloud URL/key and error-report destination. New copy defaults to local mode; local storage, file storage and broadcast channels are separated by website path.
* Included all 26 assets from the original GitHub tree, verified against their Git blob hashes.
* Added setup/edit instructions, focused tests and a local preview command. No changes were published to the original website or repository.

## Verification

Focused tests cover baseline visibility, pending-result isolation, release into the student chart, persistence after refresh/reopening, reset to pending, duplicate prevention, legacy base/placeholder migration and preservation of student notes. Repository checks verify syntax, independent configuration, relative script availability and profile defaults.

Original unrelated regression failures, reproduced on the untouched source revision:

* `tests/simulation-workflows.cjs`: initial MAR test expects a `[data-select-med]` button that is not present.
* `tests/workflow-details.cjs`: Jane Fowler pending-medication title expectation fails.

These are pre-existing failures, not passing checks. No clinical validation of source values or new backend integration is claimed. See SOURCE-AUDIT.md before instructional release.

An inherited reference to `assets/baby-boy-sung-chest-xray.png` has no matching file in the original repository. It is outside the Ruth/Carl update and remains an owner follow-up; no replacement image was invented.

