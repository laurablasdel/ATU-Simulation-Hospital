# Changes for the repository owner

## Level 3 chart fixes (September 24, 2026)

* Removed the WDL "Physical Assessment" form from Brody, Livingston, Shapiro, Sharp and Watkins. It showed raw text with nothing to chart except name and shift. Students use the Detailed Head-to-Toe Assessment instead.
* Carl and Karl: removed the blank "ER VS" row and the empty columns. The ER vital signs are now read-only, like Ruth's. Students chart new vitals in the Vitals / Flowsheet form.
* Ruth: she now starts on the Ortho Orders, transcribed from the Notion Ortho Orders page. **ICU Orders** starts pending. When faculty releases it at transfer, the NS 500 mL bolus, NS 125 mL/hr, norepinephrine and vancomycin appear on the MAR, and LR 75 mL/hr and piperacillin-tazobactam are discontinued. The NS bolus row was removed from the starting paper MAR.
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
