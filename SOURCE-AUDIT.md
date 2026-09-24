# Source comparison — September 23, 2026

Source: [Level 3 ATU Simulation Hospital in Notion](https://app.notion.com/p/nursing-chart/Level-3-ATU-Simulation-Hospital-25d195d201d581fca4a1c907b113ccd6). Comparison target: original GitHub revision `4a2e11a056a0817bc1df6dc5870234e0a9316138`.

## Carl

[Profile](https://app.notion.com/p/nursing-chart/262195d201d580d3b8bcf33bf6f058d0)

| Source section (Notion ID) | Finding/action |
| --- | --- |
| Summary `262195d201d581268fb8f10bf438ab82` | Text retained; generic profile header filled. |
| ER Note `262195d201d58163a592e192c5fef54a` | Existing text retained. |
| Cardiology Admit Note `262195d201d58168aa7df74eb4b80081` | Existing text retained; source age inconsistency below. |
| Progressive Care Orders `262195d201d58197a04ace19ca7b779e` | Existing text retained. |
| Lab Results `262195d201d581579e8ccb9409ec5a4f` | Original image verified against source; visible at start. |
| Lab Results (Shapiro new) `262195d201d580e18688dc6f4d7711db` | Original image verified; now pending faculty release. New second troponin is 0.1*; baseline had pending. |
| MAR `262195d201d581edb5f5f60cca674b30` and nested vital signs `262195d201d581c7adc3f86cdc38c563` | Source reviewed; existing content retained. |
| Physical Assessment `262195d201d581a7aef3c901aeb3e21b` | All nine expanded WDL definitions reviewed. |
| Nursing Notes `262195d201d581ad96b0e8bb01be03b9` | Missing note added; source time blank, so no time invented. |

Faculty should resolve Carl's age: the cardiology note has a 64-year age field while the main scenario and assessment say 54. The ER note prints temperature as 98.7°C. These source inconsistencies were not silently corrected.

## Ruth

[Profile](https://app.notion.com/p/nursing-chart/25d195d201d581c4aadec99e27ade7c7)

| Source section (Notion ID) | Finding/action |
| --- | --- |
| Overview and Summary `25d195d201d581dda938d7da8c289162` | Existing narrative and expanded family living note retained. |
| Consents `25d195d201d581aa9910c83836fe6b07` | Scanned blood-transfusion PDF visible in Notion, but authenticated download could not be recovered. Linked with explicit gap notice. No signature status inferred. |
| ICU Orders `25d195d201d581a0a439ec5e6a8a85a4` | Existing orders retained. |
| Lab Results `25d195d201d581f58678f1d549846bc0` | Placeholder replaced by transcription of visible PDF; original PDF not bundled. Chemistry/lactate values are in Today 0600 column, confirmed visually. |
| MAR `25d195d201d5816fb8a9eb0e7e5bb4fd` | Current Notion lists eight rows. GitHub also has ketorolac and saline-bolus rows consistent with its ICU orders; retained as existing additions, not falsely attributed to this MAR source. |
| Vital Signs `25d195d201d581c29716dc7ec0e2bf12` | Current Notion table is blank. GitHub has Last/1329/1340 entries; retained and flagged as existing scenario additions, not verified source entries. |
| Physical Assessment `25d195d201d581788086cb6c706ac318` | All nine expanded WDL definitions reviewed; retained. |
| Nursing Notes `25d195d201d5819ba68ad680b4eab2b3` | Missing Today 0600/VR note added. |

### Instructor Eyes Only ICU

* [Culture Results](https://app.notion.com/p/nursing-chart/25d195d201d58103a862e1423b28b42b): same baseline results with blood culture Positive E. Cloacae; staged for Ruth.
* [ICU Lab Results](https://app.notion.com/p/nursing-chart/25d195d201d5813d8944d02d7166f91c): repeat CBC/chemistry/lactate results and positive culture; staged for Ruth. Original PDF is not bundled; values are transcribed. Chloride is printed **1.5**, which is preserved and prominently flagged for faculty verification before release.
* [Orders](https://app.notion.com/p/nursing-chart/25d195d201d58164b326d9be8612eae5): transfuse two units PRBC and type/cross two units PRBC, Dr. Marcus; staged for Ruth. Date/time is blank.
* Older [Ortho Orders](https://app.notion.com/p/nursing-chart/25d195d201d581389bd8e788a7234f42) and [Doctors orders](https://app.notion.com/p/nursing-chart/25d195d201d581758e95d28c49612acd) were reviewed as source history. They were not substituted for the active ICU order set because they represent different stages and include later handwritten/entered material.
* [Lab Results linked under Orders](https://app.notion.com/p/nursing-chart/25d195d201d5812bb821ecd85347c33a) is a separate historical source reference; not substituted for Ruth's explicitly identified baseline and ICU repeat reports.
* One linked page displayed **No access** (`1c74d1ee708c810f993fe81d9cef401e`). Its content remains unverified. No claim of a complete export of every instructor-only item is made.
* No additional accessible Carl-specific instructor record was identified beyond the new lab report.

Source medication text includes Piperacillin/Tazobactam **450 mg** and differing pre-/post-ICU medication states. Existing clinical wording is preserved; faculty must reconcile it. Header unit/provider reflect the lab admission header, whereas ICU orders describe transfer under Dr. Marcus.

### Instructor Eyes Only MS

The heparin flowsheet, Watkins stat orders and Watkins stat lab sources were identified with Vernon Watkins. Other links led to Charles Jones/Brody material. These were not reassigned to Carl Shapiro or Ruth Livingston. Karl Sharp is a distinct profile; this package does not claim a completed Karl/Vernon audit or modify them for the Ruth/Carl request.

## Completion boundary

Carl's accessible profile sections have been checked and the missing note/release change implemented. Ruth's accessible profile sections have been checked with the explicit exceptions above. Ruth's original consent attachment, inaccessible instructor link, historical instructor attachments and clinical/source conflicts require owner/faculty follow-up. The repository is editable and runnable, but the Ruth chart is not a fully recovered standalone copy of every Notion attachment.
