# CabScribe Product Requirements Document — Version 2

**Status:** Draft for review
**Date:** 2026-10-27
**Builds on:** [prd.md](./prd.md) (version 1)

## 1. Summary

Version 1 reads and writes one Configuration Variable (CV) at a time. Version 2
adds a **CV Table** page that reads many CVs from the target decoder in one
operation and presents them as a table of CV, value, and description. The page
reuses the existing target panel and keeps Service Mode as the only programming
mode.

## 2. Problem and opportunity

Inspecting a decoder one CV at a time is slow and error-prone. Users want a
snapshot of the decoder's configuration to review settings, compare against
expectations, and find CVs worth changing. Service Mode reads are slow (each
read can take seconds), so a bulk read must show progress and be cancellable.

## 3. Goals

- Let the user read all applicable CVs from the target in one action.
- Present values with human-readable descriptions where known.
- Make clear which CVs are unsupported, unreadable, or not applicable to the
  connected interface or target, rather than showing them as valid values.
- Give clear progress and a reliable way to cancel a long scan.

## 4. Non-goals for version 2

- Bulk writing, restoring, or importing CV sets.
- Saving snapshots between sessions or comparing snapshots. (CSV export of the
  current table is in scope; see FR-V2-8.)
- Operations Mode programming.
- Decoder identification (reading CV 7/8 to label the decoder) and
  manufacturer-specific CV guides beyond the existing definitions
  (see FR-V2-4).
- Changing the single-CV read/write workflow from version 1.

## 5. Primary scenarios

1. **Open the table:** The user selects the Table Chart button in the header
   and arrives on the CV Table page.
2. **Scan:** The user confirms the target address, selects **Read**, and
   watches a determinate progress circle in the button while rows fill in.
3. **Cancel:** The user selects the button again during the scan to stop it.
   Values already read are kept and the remaining rows stay unread.
4. **Review:** The user scans the table for values and descriptions, and sees
   which CVs failed or are not applicable.
5. **Return:** The user returns to the single-CV page without losing the
   connection or target selection.

## 6. Functional requirements

### FR-V2-1: Navigation and routing

- The application shall provide a client-side router with a route for the
  single-CV page (existing behavior, default route) and a new route for the CV
  Table page (for example `/cv-table`).
- The header shall include an icon button next to the debug and connection
  buttons using the Material **table_chart** icon, with an accessible label
  ("Read CV table") and tooltip.
- The button shall indicate the active state (pressed/highlighted) while the CV
  Table page is shown, and shall navigate back to the single-CV page when
  selected again.
- Serial connection state, the connection dialog, the debug panel and its
  toggle, and the selected target address shall remain available and shared
  across both pages. Navigating shall not disconnect or interrupt an operation
  in progress without notice (see FR-V2-3).
- Routes shall work in both the web build and the Electron build (hash-based
  or relative-base routing as required by the packaged `file://` origin).

### FR-V2-2: Shared target panel

- The CV Table page shall use the same target panel as the single-CV page,
  including its address entry and confirmation behavior and validation.
- The target state shall be a single shared source so a change on one page is
  reflected on the other.
- The single-CV controls (CV address and value fields) shall not appear on
  the CV Table page. The table and a **Read** button take their place.

### FR-V2-3: Table scan

- The page shall present a user-selectable **CV range** (start and end
  address, validated against the NMRA limits and the interface's capabilities)
  and a **Read** button that starts a scan of that range, one CV at a time in
  Service Mode, using the existing read path through the selected interface.
  The range controls shall be disabled while a scan is active.
- The Read button shall be disabled until the connection is ready and the
  target is confirmed, consistent with version 1.
- While scanning, the button shall show a **determinate circular progress
  indicator** reflecting completed CVs out of total CVs to read, and shall
  change to a **Cancel** action (label, icon, and accessible name updated;
  progress announced to assistive technology). Progress is based on the count
  of CVs scanned, not on elapsed or estimated time, and no time estimate shall
  be shown.
- Cancelling shall stop issuing further reads, let any in-flight read finish
  or time out safely, keep values already read, and mark unread rows as not
  read. The button shall return to **Read**.
- Only one operation shall run at a time. Single-CV read/write and a new scan
  shall be unavailable while a scan is active, and the page shall say so.
- Disconnection or a repeated interface failure during a scan shall stop the
  scan, keep values already read, and surface the cause.
- Starting a new scan shall clear previous values after the scan begins, not
  before, so a failed start does not discard data.
- The table shall be cleared on application restart, on a new connection, and
  whenever the confirmed target changes. Otherwise it is retained when
  navigating between pages.

### FR-V2-4: CV table content

- The table shall list the CV address, current value, and description for
  each CV in the scan list. Columns: **CV**, **Value**, **Description**,
  and **Status** (may be combined with Value visually).
- The table shall list every CV in the selected range. Descriptions are
  taken from the CV definitions already in the application (the NMRA standard
  CVs referenced in version 1); CVs without a definition are listed with no
  description.
- Value display shall show decimal by default. A secondary representation
  (hexadecimal and binary) shall be available for bit-field CVs, at least on
  demand.
- Every row shall be in exactly one state, shown in text and not by color
  alone:
  - **Not read** — before a scan, or after cancellation.
  - **Reading** — the current CV.
  - **Value** — a valid value returned by the interface.
  - **Unsupported** — the interface or decoder reports that the CV is not
    supported.
  - **Failed** — read error or timeout, with an actionable reason.
  - **Not applicable** — the CV is known not to apply (see below).
- Descriptions shall come from the definitions source and be omitted, not
  invented, when unknown.

### FR-V2-5: Variable applicability

Not all CVs are valid for every controller or target.

- The application shall distinguish **interface limits** (what the connected
  DCC interface can read, for example its supported CV range and capability
  flags) from **decoder limits** (what the decoder implements).
- CVs that the interface cannot read shall be shown as not applicable, shall
  not be requested, and shall not count toward progress totals.
- CVs that are requested but rejected by the decoder or yield no valid response
  shall be shown as unsupported or failed, and shall not be reported as a value
  such as 0.
- Known dependent CVs shall be handled explicitly. Examples: long-address CVs
  17/18 apply only when CV 29 selects a long address; indexed CV ranges
  (CV 31/32) and consist CVs (19, 21–24) apply to specific decoder types. The
  application shall read the controlling CV first where this is needed to
  decide applicability, and shall state why a row is not applicable.
- The user selects the scan range (for example 1–256). The default range
  shall be the standard baseline CVs (1–29). Because large ranges are slow and
  manufacturer-specific, the UI shall show the number of CVs to be read
  before the scan starts.
- Applicability rules shall be data-driven and covered by tests so that they
  can be extended without rewriting the scanner.

### FR-V2-6: Reading safety and reliability

- The scan shall be read-only. It shall never write CVs.
- Reads shall run sequentially, with the same timeout behavior as the
  single-CV read. A timeout or failure on one CV shall not abort the scan,
  but the scan shall stop after **3 consecutive failures**, keep values
  already read, and report why it stopped. Unsupported and not-applicable
  rows do not count as failures.
- The debug log shall continue to record all serial traffic for each read.
- The UI shall not claim the table represents the complete decoder state; it
  shall state which CVs were read and when.

### FR-V2-7: Accessibility and responsive layout

- The table shall use semantic table markup with column headers, keyboard
  navigation, and a visible focus indicator.
- Progress and state changes shall be announced through a polite live region.
  The progress indicator shall expose a value, not only a visual.
- On narrow viewports the table shall remain usable (horizontal scroll or
  stacked layout) and the sticky header and Read/Cancel button shall remain
  reachable.

### FR-V2-8: CSV export

- The page shall provide an **Export CSV** action, enabled when the table
  has at least one row read, that downloads the current table as a CSV file
  that opens correctly in Excel and Google Sheets.
- Columns shall match the table (CV, value, status, description); the value
  shall be written as decimal. Rows that were not read, unsupported, failed, or
  not applicable shall be exported with their status and an empty value, never
  as 0.
- Fields shall be quoted and escaped per RFC 4180, and the file shall be
  UTF-8 (with a byte-order mark for Excel compatibility).
- The export shall include only data from the current table, work in the web
  and Electron builds, and be available after a cancelled or stopped scan.
  The file name shall include the target address and the date.

## 7. Safety, reliability, and usability requirements

- Cancellation shall respond within one read timeout and the UI shall show
  "Cancelling…" until it has taken effect.
- A scan shall not leave the interface in an unknown state; cancellation and
  disconnection paths shall be tested.
- Errors shall use the same wording and presentation as version 1.

## 8. Success criteria

- A user can open the CV Table page, read the standard CVs from a DCC-EX
  command station, and see values and descriptions without leaving the app.
- Progress shown matches reads completed, and Cancel stops a scan within one
  read timeout with partial results retained.
- No row shows a value that was not returned by the interface; unsupported or
  not-applicable CVs are never displayed as zero.
- Unit tests cover scan ordering, range selection, CSV output, progress, cancellation, disconnection,
  timeouts, and applicability rules. Component tests cover the route, header
  button, shared target panel, table states, and Read/Cancel button.
- Existing version 1 single-CV tests continue to pass.

## 9. Product constraints and guidance

- Reuse the existing `DccSessionService` read path; add scan orchestration
  as a service in `libs/common` so it is testable without the UI and available
  to both web and Electron builds.
- Introduce the Angular router and split the current page into a shell
  (header, connection dialog, shared target panel, debug panel) and
  route components. Keep shared state in services or signals.
- Use Angular Material and the existing visual language; the Table Chart icon
  shall be the Material `table_chart` glyph, inlined as SVG as with the
  other header icons (the CSP does not allow external fonts).
- Keep descriptions and applicability rules as data alongside
  `cv-definitions.ts`, citing the source.

## 10. Decisions and remaining questions

### Decisions

- **Scan range:** The user selects the range; the default is CVs 1–29.
- **Failure policy:** Stop the scan after 3 consecutive failures.
- **Retained data:** Clear the table on restart, new connection, and target
  change; retain it when navigating between pages.
- **Export:** CSV export for Excel and Google Sheets is included (FR-V2-8).
- **Decoder identification:** Not in this version.
- **Progress:** Based on the count of CVs scanned, not time; no time estimate.

### Remaining questions

- None at this time.

## 11. References

- [prd.md](./prd.md), [ux-design-brief.md](./ux-design-brief.md), and
  [implementation-plan.md](./implementation-plan.md).
- NMRA Standard S-9.2.2 (Configuration Variables) and RP-9.2.3, as listed in
  version 1 Section 11.
- TCS standard CV reference used by `cv-definitions.ts`.
