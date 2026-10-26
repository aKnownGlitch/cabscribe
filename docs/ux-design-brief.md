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
5. Enter a locomotive or accessory ID in the **Programming Target Address** section above the CV
   editor; this is the target for the programming operation.
6. Enter one CV address and press **Read**; on success, the returned value
   appears in the editable **Value** field.
7. Edit the value if needed and press **Write** to review and explicitly
   confirm the change for that same target and CV.
8. See the write in progress, then the read-back value and a verified success,
   mismatch, or unverified/failure outcome.
9. If disconnected or an operation fails, understand the state and choose
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
- Show the **Programming Target Address** section above the CV editor with one
  **Locomotive or Accessory ID** field. Require a positive whole number before
  enabling a CV operation; apply approved DCC/NMRA address limits when they
  are established.

### A1. Serial connection settings dialog

- Open from the connection icon button beside the header status.
- Show the serial-port selector, refresh action, and Connect action when not
  connected; show the active port and Disconnect action when connected.
- Explain that the selected port is saved locally and restored on later
  launches. Do not automatically reconnect to the saved port.
- Include empty, scanning, unavailable, and connection-error states.
- In Web Serial-capable Chromium browsers, include **Choose device** to invoke
  the browser permission chooser directly from a user click. List only
  authorized ports and allow explicit Connect/Disconnect. Require HTTPS or
  localhost; browser permission and policy errors must be visible.
- Browser permissions may persist, but require port reselection after reload
  because Web Serial does not expose stable unique hardware IDs. Do not guess
  which device to connect to from shared USB vendor/product IDs.

### B. Main programming screen — connecting/connected

- Show connection state in the header status chip (**Service Mode** when
  connected).
- Keep connected device/port identity and disconnect action in the serial
  connection settings dialog, not in a main-screen hardware panel.
- Programming context identified as **Service Mode**.
- One shared single-CV form with CV address and Value fields and **Read** and
  **Write** actions.
- Use a filled primary-color **Read** button and a filled warning-red **Write**
  button, both with white text.
- Include an optional **CV function** dropdown that sets the same CV address
  as manual entry. Match known functions when an address is typed; retain
  manual entry for addresses outside the catalog.
- For a manually entered address outside the catalog, show **CV [number] —
  Manual address** in the dropdown so it always follows the valid input.
- The initial catalog covers named CVs through 106 from the
  [TCS CV reference](https://docs.tcsdcc.com/wiki/NMRA_Standard_CV%27s),
  including speed-table steps 1–28. Exclude reserved/unused entries, identify
  TCS-specific assignments, and do not imply universal decoder support.
- Place a **Programming Target Address** section directly above the CV editor. The entered
  Locomotive or Accessory ID is the programming target and applies to both
  Read and Write.
- A successful read places the returned value in the editable Value field.
- Add **Confirm** to the Programming Target Address section. With a connected
  serial port and a valid locomotive address, send `<R LOCOID>` and compare
  `<r LOCOID address>` with the entered ID. This reads the actual locomotive
  address, not its consist address; it does not change the address.
- Show checking, confirmed, and explicit mismatch/read-error/timeout states.
  Clear confirmation when the address changes or the connection is replaced;
  a lost connection must not retain confirmed status. Block conflicting
  operations while checking. After a timeout, transmission failure, or invalid/failed
  read, require reconnection before retrying to avoid accepting delayed replies.
- Confirmation requires a locomotive alone on the programming track with decoder
  acknowledgment support. Accessory address confirmation is unsupported and
  must be identified as such. Confirmation does not enable CV Read/Write.
- Place the confirmation guidance at the top right of the Programming Target
  Address section, alongside its heading; allow wrapping at narrow widths.
- Writing uses the current CV address and edited Value field, then requires
  confirmation before sending.
- Loading/progress feedback that prevents conflicting operations while a
  request is active.

### C. Write review and confirmation

- Show the exact CV address and proposed value before sending.
- Include the selected Locomotive or Accessory ID in the confirmation.
- Require an explicit confirmation action; make cancellation easy and safe.
- Make clear that writing changes decoder behavior and that CabScribe will
  read the CV back to verify the result.

### D. Serial debug output

- Use **Debug output** as the heading; omit the **SERIAL MONITOR** kicker.
- Replace the latest-operation result panel with a read-only serial log.
- Provide an accessible toggle switch to show or hide the complete debug
  section; show it by default.
- Let the log fill the remaining vertical space in the application window and
  scroll independently when its contents exceed the available space; keep the
  newest traffic in view as messages arrive.
- Prefix actual CabScribe-to-device serial writes with `CS>` and
  device-to-CabScribe serial input with `DC<`; do not log attempted/simulated
  writes as transmitted messages.
- Keep the log session-only; do not persist serial traffic to local storage or
  operation history.
- Display only traffic actually observed on the serial connection. Do not
  synthesize protocol messages or imply CV support before the protocol is
  implemented.

Read results populate the editable Value field. Invalid CV input, connection
failures, and unsupported operations should remain understandable through
field validation, connection status, and available operation feedback; never
automatically repeat a write.

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
- Keep the Address and Configuration Variable sections concise: use field
  labels and placeholders without descriptive subtitles or repeated helper
  text beneath the inputs. Keep write-verification guidance in the
  confirmation dialog.
- Do not silently alter, clamp, or substitute entered addresses or values.
- Disable or gate actions when disconnected, an operation is in progress, or
  required inputs are invalid; explain why an action is unavailable.
- Keep the target Locomotive or Accessory ID, one active CV address, and
  editable value visible across read and write confirmation. Populate the
  value field after a successful read.
- Make it clear that only the current operation is shown; there is no saved
  operation history in the initial release.
- Include concise instructions for recovering from connection and operation
  errors without promising that retrying is always safe.

## 6. Visual and accessibility direction

- Include **Copyright © 2026 Larry Weinheimer** in the footer alongside the
  CABSCRIBE brand and an icon-only **GitHub** button with an accessible label linking to
  [the project repository](https://github.com/aKnownGlitch/cabscribe).
  Replace the local-connection/cloud-account footer text with this button.
- Prioritize glanceable connection and operation status. Do not use color alone
  to communicate success, warning, failure, or an unknown outcome.
- Provide clear focus states, keyboard navigation, logical tab order, and
  keyboard-operable dialogs and controls.
- Use readable typography, strong contrast, adequately sized controls, and
  persistent labels rather than placeholder-only field identification.
- Design error, disabled, and in-progress states as intentionally as the
  default screen. Make the serial debug output clearly read-only.
- Follow the product's Angular Material implementation constraint, but the
  Figma visual language and component styling remain a design decision.

## 7. Figma deliverables

- Desktop application shell and primary programming screen.
- Connected/disconnected, device discovery, permission/error, and operation
  progress states.
- Write confirmation and serial debug output visible/hidden states.
- Clickable prototype for connect → read into the editable value field → edit
  value → write confirmation, including serial log input/output and at least
  one error/recovery path.
- Reusable component variants for connection status, input validation,
  serial log toggle, buttons, and confirmation dialog.
- Brief annotations for interaction behavior, keyboard/accessibility details,
  and responsive behavior at narrower desktop window widths.

## 8. Out of scope / unresolved product details

The PRD still leaves Linux distributions and architectures, package formats,
the exact DCC-EX hardware/serial target, test CVs, and the NMRA revision
baseline open. The design should avoid depicting unsupported setup details or
hard-coding unconfirmed device metadata and CV ranges. These details can be
filled in after the implementation plan and acceptance-test target are agreed.
