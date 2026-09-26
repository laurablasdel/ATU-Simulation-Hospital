# Shared simulation, saving, and history layout — September 25, 2026

The faculty and student computers must open the same hospital URL and connect to the same simulation session. Click **Shared connection**, enter an approved hospital account, and choose **Connect**. The hospital account is separate from the Supabase dashboard login and database password. Never share the database password with students.

The header distinguishes local saves, connection problems, and successful shared saves. Faculty and student mode remain independent on each computer. Faculty releases and messages update the shared chart; students receive the existing notification popup. Realtime changes are supplemented by a five-second refresh and retries after a connection failure. In-progress student fields stay on screen while notifications arrive.

All existing patients use this connection. Patient-specific orders, assessments, vitals, MAR documentation, messages, and releases retain their existing formats. Concurrent saves merge distinct records and fields, then use an atomic revision check to retry conflicts. If two computers edit the same field, the pending local edit wins; coordinate simultaneous edits to the same existing record.

Completed entries persist in browser storage and, after connection, in the shared session. Unfinished chart entries are durable local drafts, not signed chart records, and survive reopening the browser. Complete and save the entry to share it. Faculty Live Control editors still use their individual Save Changes buttons. Browser storage failures are reported and do not clear the draft. Clearing browser/site data can still erase an unsent local draft.

Reset Patient for New Sim clears the selected patient's student documentation, resets its baseline, and propagates a reset marker. Older disconnected computers cannot restore entries from the prior simulation. Other patients retain their documentation. A local reset archive and pre-connection backup are retained for recovery; resetting is not a secure data-erasure operation.

Order List, Assessment History, and Vitals History now appear first, above reference charts and data-entry sections. Detailed saved assessment forms are included in Assessment History.

## Rooms: faculty, simulation, and observers

* **Control room (Faculty Mode):**
  * Release content as usual.
  * When a student sends an SBAR, a popup appears on any faculty screen. Type an optional provider response (sent to the student as a message) and click **Accept**.
* **Simulation room (Student Mode):**
  * Chart as usual.
  * Each release shows one popup to acknowledge once.
  * Use **Provider Notification (SBAR)** in the sidebar to notify the provider.
* **Debrief room (Observer Mode):**
  * **Setup:** open `…/?mode=observer`, or in Faculty Mode use **Faculty Live Control → This Computer's Role → Make this computer an Observer**. The computer stays an observer after the browser is reopened. The faculty PIN switches it back.
  * **Chart access:** observers open any part of the chart independently but cannot chart.
  * **Alerts:** releases show a brief notice that closes itself. An SBAR shows a popup to close. Observer laptops sign in with Shared connection like every other computer.

## Configuration and access

`app-config.js` contains the hospital-owned project URL, a **publishable** key, and session ID. It contains no database password or server secret. `supabase-setup.sql` describes the table, membership policies, atomic save function, and realtime setup. Create hospital accounts in Supabase Authentication and explicitly approve each in `simulation_members`. Merely signing up does not grant chart access.

Approved members share the whole simulation state. The existing faculty PIN and pending-content controls are teaching workflow controls, not server-enforced separation of instructor material. Use simulated patient information only. Separate class sessions need separate session rows/memberships and configuration.

The private `diagnostics` bucket supports new shared attachments after setup. Older attachments saved only in a browser must be uploaded again by faculty for other computers to access them.

## Verification

Tests cover all 13 patients, saved data after reload, fresh-tab draft restoration, all three history layouts, reset isolation, concurrent faculty/student writes with conflict retries, message alerts during typing, failed browser saves, and stale records after reset. Existing Carl, Ruth, and Level 3 regression tests also pass. The shared-client tests use isolated simulated clients; classroom hardware still requires a two-computer acceptance check.

1. Connect both computers and open the same patient; put one in Student Mode.
2. Begin typing a student entry. Release an order/result and send a faculty message. Confirm the alert appears and typed work stays intact.
3. Save a student assessment/vital. Confirm it appears on the faculty computer and remains after refresh.
4. Reset only that patient for a new sim. Confirm the documentation clears on both computers and other patients remain intact.

Barcode/label work is preserved separately and is not included in this priority release.
