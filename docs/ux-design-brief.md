# CabScribe UX Design Brief

**Audience:** UX designer  
**Purpose:** Figma design scope for the initial release  
**Source:** [Product Requirements Document](./prd.md)

## 1. Product and user

CabScribe helps a model railroader read or change one NMRA DCC decoder
Configuration Variable (CV) at a time. The initial target is a DCC-EX command
station connected over serial, using Service Mode. A CV write must be read back
and confirmed before the interface reports success.

Design for a user who may be standing at a workbench, focused on a locomotive
and programming hardware, and needs clear feedback about which device is
connected and whether a requested change actually took effect. Favor readable
labels, visible status, and deliberate write confirmation over dense controls.

## 2. Design scope

Create desktop-first designs for the initial Linux application. The UI will also
be exercised on macOS; include a responsive layout that remains usable at
different desktop window sizes. Do not design a mobile-first experience or
platform-specific native chrome.

The initial scope is serial connection, single-CV Service Mode reading and
writing, and explicit operation outcomes. Do not include Operations Mode,
multi-CV editing, decoder profiles, saved history, cloud accounts, throttle
controls, or firmware workflows.

## 3. Primary user flow

1. Launch CabScribe and see a **Disconnected** status in the header.
2. Open serial connection settings with the adjacent icon button.
3. Choose an available serial port and connect to the DCC-EX command station.
   The selected port is remembered in local storage for the next session.
4. See the header change to **Service Mode** after the serial connection opens,
   and a clear connected/ready state in the main screen.
5. Enter one CV address and press **Read**; on success, the returned value
   appears in the editable **Value** field.
6. Edit the value if needed and press **Write** to review and explicitly
   confirm the change for that same CV.
7. See the write in progress, then the read-back value and a verified success,
   mismatch, or unverified/failure outcome.
8. If disconnected or an operation fails, understand the state and choose
   whether to reconnect or retry. Never retry a write automatically.

## 4. Figma screens and states

Design the following screens or variants. They may be represented as states of
one primary application screen rather than separate pages.

### A. Main programming screen — disconnected

- Product identity and a clear connection status in the header.
- Do not show a separate hardware connection panel on the main programming
  screen. Keep the **Disconnected** status and adjacent icon button to open
  serial connection settings in the header.
- A single CV editor with a CV address field, editable Value field, and **Read**
  and **Write** buttons; unavailable until the connection is ready, or with a
  clear prompt directing the user to connect first.
- Helpful state for device discovery failure or unavailable permissions.

### A1. Serial connection settings dialog

- Open from the connection icon button beside the header status.
- Show the serial-port selector, refresh action, and Connect action when not
  connected; show the active port and Disconnect action when connected.
- Explain that the selected port is saved locally and restored on later
  launches. Do not automatically reconnect to the saved port.
- Include empty, scanning, unavailable, and connection-error states.

### B. Main programming screen — connecting/connected

- Show connection state in the header status chip (**Service Mode** when
  connected).
- Keep connected device/port identity and disconnect action in the serial
  connection settings dialog, not in a main-screen hardware panel.
- Programming context identified as **Service Mode**.
- One shared single-CV form with CV address and Value fields and **Read** and
  **Write** actions.
- A successful read places the returned value in the editable Value field.
- Writing uses the current CV address and edited Value field, then requires
  confirmation before sending.
- Loading/progress feedback that prevents conflicting operations while a
  request is active.

### C. Write review and confirmation

- Show the exact CV address and proposed value before sending.
- Require an explicit confirmation action; make cancellation easy and safe.
- Make clear that writing changes decoder behavior and that CabScribe will
  read the CV back to verify the result.

### D. Operation result states

Provide visually distinct, accessible states for:

- Read succeeded, with requested CV and returned value.
- Write verified: read-back matches the requested value.
- Write mismatch: show requested and read-back values without implying success.
- Write unverified: write may have been sent, but read-back could not confirm it.
- Read/write rejected or unsupported.
- Operation timed out.
- Device disconnected during an operation; outcome is unknown where applicable.
- Invalid CV address/value; validation feedback before transmission.

For all failure states, provide a useful next action where known. Do not style
an unknown or unverified result as success. Do not trigger another write
automatically.

### E. No-device and permission/error variants

- No serial devices found, with a rescan/retry affordance if available.
- Port access denied or unavailable, with a clear explanation and recovery
  guidance.
- Device connection lost, with status updated immediately and an intentional
  reconnect action.

Do not assume or design a specific Linux permission mechanism until the
implementation and supported distribution targets are decided.

## 5. Interaction and content requirements

- Use **CV** and **Service Mode** consistently; avoid unapproved technical
  shorthand.
- Clearly associate labels, units/ranges, and validation messages with each
  field. Exact CV limits and validation language must follow the approved NMRA
  baseline and should not be invented in the mockups.
- Do not silently alter, clamp, or substitute entered addresses or values.
- Disable or gate actions when disconnected, an operation is in progress, or
  required inputs are invalid; explain why an action is unavailable.
- Keep one active CV address and editable value visible across read, write
  confirmation, and result feedback. Populate the value field after a
  successful read.
- Make it clear that only the current operation is shown; there is no saved
  operation history in the initial release.
- Include concise instructions for recovering from connection and operation
  errors without promising that retrying is always safe.

## 6. Visual and accessibility direction

- Prioritize glanceable connection and operation status. Do not use color alone
  to communicate success, warning, failure, or an unknown outcome.
- Provide clear focus states, keyboard navigation, logical tab order, and
  keyboard-operable dialogs and controls.
- Use readable typography, strong contrast, adequately sized controls, and
  persistent labels rather than placeholder-only field identification.
- Design error, success, disabled, and in-progress states as intentionally as
  the default screen.
- Follow the product's Angular Material implementation constraint, but the
  Figma visual language and component styling remain a design decision.

## 7. Figma deliverables

- Desktop application shell and primary programming screen.
- Connected/disconnected, device discovery, permission/error, and operation
  progress states.
- Write confirmation and all key read/write result states.
- Clickable prototype for connect → read into the editable value field → edit
  value → write confirmation → verified result, including at least one
  error/recovery path.
- Reusable component variants for connection status, input validation,
  operation feedback, buttons, and confirmation dialog.
- Brief annotations for interaction behavior, keyboard/accessibility details,
  and responsive behavior at narrower desktop window widths.

## 8. Out of scope / unresolved product details

The PRD still leaves Linux distributions and architectures, package formats,
the exact DCC-EX hardware/serial target, test CVs, and the NMRA revision
baseline open. The design should avoid depicting unsupported setup details or
hard-coding unconfirmed device metadata and CV ranges. These details can be
filled in after the implementation plan and acceptance-test target are agreed.
