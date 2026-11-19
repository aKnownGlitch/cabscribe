# Extended Configuration and Operations Implementation Plan

- **Status:** Draft for review
- **Date:** 2026-11-18
- **Command inventory:** [DCC-EX commands by purpose](./dcc-ex-serial-commands-by-purpose.md)
- **Related product plans:** [PRD](./prd.md), [PRD v2](./prd-v2.md), [implementation plan](./implementation-plan.md), [UX design brief](./ux-design-brief.md)

## 1. Objective

Expand CabScribe with two routed pages for issuing supported DCC-EX serial
commands:

- **Extended Configuration** for configuration and diagnostics commands.
- **Operations** for locomotive, track, accessory, layout, and peripheral
  commands.

Both pages use domain tabs and a structured command form following the existing
single-CV editor's input layout. The command inventory is the initial grouping
and discovery aid; it is not, by itself, proof that every listed command is
implemented, safe, or supported by every firmware build.

This work expands the current product scope. The existing PRDs limit the
application to single-CV Service Mode workflows and identify broader DCC
operations as non-goals. Approve an updated product scope and protocol
verification gate before enabling commands against hardware.

## 2. Goals and non-goals

### Goals

- Add two navigation destinations without changing the existing CV editor,
  CV Table, or debug workflows.
- Organize commands under the same Configuration/Operations areas as the
  command inventory.
- Let users select an area, choose a command form, enter typed parameters,
  review the exact command, and receive an explicit outcome.
- Gate commands by verified protocol support, connection capabilities,
  hardware, and firmware features.
- Make the consequences of mutating, persistent, or destructive commands
  clear before execution.

### Non-goals for the first increment

- Arbitrary free-form serial command entry or scripting.
- Claiming support for every command in the inventory.
- Changing the existing Service Mode CV read/write workflow.
- Cloud connectivity, command history, or persistent storage of command
  values and credentials.
- Implementing commands against hardware before their framing, replies,
  side effects, and recovery behavior are verified.

## 3. Navigation and page structure

### Navigation

- Add an **Extended Configuration** navigation button using the Material
  `extension` icon and an **Operations** button using the Material
  `model_training` icon.
- Use inline SVG icons consistent with the existing header. Do not introduce
  external icon fonts; the current application uses a restrictive Content
  Security Policy.
- Provide visible tooltips, accessible names, active-route styling, and
  `aria-current="page"` for both buttons.
- Add client-side routes, for example `/configuration` and `/operations`.
  Preserve the existing default CV editor, CV Table, and debug routes, as well
  as web and packaged Electron navigation behavior.
- Keep the connection status and serial settings available in the shared
  application shell. Navigation must not disconnect the station or interrupt
  a command without an explicit, surfaced outcome.

### Extended Configuration tabs

Use scrollable tabs that retain these area names from the command inventory:

1. Track power and track configuration
2. Turnouts, sensors, and outputs
3. JMRI-compatible information and roster
4. Turntables
5. Network configuration and diagnostics
6. Configuration and diagnostics

### Operations tabs

Use scrollable tabs for:

1. Station and throttle
2. Track power and track configuration
3. Turnouts, sensors, and outputs
4. JMRI-compatible information and roster
5. Turntables
6. DCC accessory and programming commands
7. Consists, momentum, and raw packets
8. Pins, displays, sound, and peripherals
9. EXRAIL automation

Tabs are an information architecture boundary, not a capability guarantee.
Hide or disable command forms that the active connection or firmware does not
support, and explain why they are unavailable.

## 4. Command selection and input experience

- Reuse the single-CV editor's visual patterns: an operation card, labeled
  Angular Material form fields, selectors for predefined choices, and clearly
  grouped actions.
- Within each tab, provide a **Command** combo box containing only command
  forms for that area. Give variants separate selectable entries (for example
  turnout creation by DCC, pin, or servo).
- Render typed fields from the selected command definition. Use numeric inputs
  for numeric values, selects for enumerated keywords, toggles for boolean
  choices, and text inputs for quoted strings. Labels must identify units,
  valid ranges, and required/optional status when established by the protocol.
- Do not assume the shared Programming Target Address applies to every
  command. Collect loco, turnout, sensor, track, output, or other IDs in the
  selected command form when that command requires them.
- Show an exact serialized-command preview before execution. Preserve required
  opcode case, keywords, separators, quoting, and angle brackets; do not
  silently normalize invalid or ambiguous values.
- Provide one primary action appropriate to the command (for example,
  **Read**, **Apply**, or **Send**) and a clear disabled reason when the
  connection, capability, input, or firmware requirements are not met.
- For commands that return state, show the parsed response and any resulting
  broadcasts as distinct from the fact that a command was transmitted.
  Distinguish accepted/sent, completed, rejected, timed out, disconnected, and
  outcome-unknown states where the protocol supports those distinctions.

## 5. Command metadata and execution boundary

Before implementation, turn the approved command subset into a typed,
reviewable catalog. Each command definition should capture:

- Stable command identifier, category, display name, and syntax template.
- Parameter names, types, required status, enumerated choices, and verified
  constraints.
- Whether the command is read-only, runtime-mutating, persistent, destructive,
  diagnostic, or raw-packet.
- Required connection mode, firmware/build feature, and transport capability.
- Expected direct responses, broadcasts, and timeout/uncertain-outcome
  behavior.
- Confirmation policy and any platform or USB-serial restrictions.

The UI must call an application-level command service rather than write serial
bytes directly. Keep transport-specific work behind the existing typed
transport boundary and share command execution state across pages. Do not
construct a successful result merely because a write to the serial stream
completed.

The Markdown command inventory remains design documentation; the runtime
catalog is the executable allowlist and must be checked against the selected
DCC-EX source revision and target firmware.

## 6. Safety, privacy, and recovery

- Require an explicit review/confirmation step for persistent configuration,
  destructive commands, and commands with substantial or difficult-to-reverse
  effects. The confirmation must show the exact command and its target.
- Keep time-critical operations such as emergency stop discoverable and avoid
  placing them behind a generic confirmation flow; make their immediate
  effect unmistakable.
- Treat track power, locomotive motion, turnout movement, CV programming,
  network changes, reset, deletion, and raw-packet commands as separate risk
  classes. Review their confirmation and recovery behavior before enabling
  each class.
- Never automatically retry a mutating command after timeout, disconnect, or
  an uncertain result. Explain when the user must inspect the layout or
  reconnect before trying again.
- Keep passwords and other credentials masked in form controls and redact
  them from debug output, errors, analytics, and any command preview that is
  not explicitly user-reviewed. Do not persist credentials or command history.
- Validate inputs before transmission using verified command constraints.
  Reject invalid values explicitly; do not clamp, coerce, or substitute.
- Require capability and firmware checks for commands marked conditional in
  the inventory. Unsupported commands must not be sent.
- Test that disconnects and timeouts release operation state and leave the
  UI with an explicit result rather than a false success.

## 7. Implementation phases

### Phase 0 — Product and protocol gate

- Update the product requirements to include the two pages and explicitly
  supersede applicable non-goals.
- Select the initial command subset and document the DCC-EX firmware/source
  revision and hardware configuration.
- Verify command syntax, serial framing, responses/broadcasts, side effects,
  feature conditions, and safe recovery for that subset.
- Decide the confirmation policy for power changes, resets, deletion, and
  raw-packet commands.

**Exit criteria:** The approved subset has a reviewed capability/risk matrix
and a testable command/response contract. No unverified command is enabled.

### Phase 1 — Navigation and tabbed page shells

- Add the two header navigation buttons, inline icons, routes, active states,
  page titles, and accessible tab controls.
- Add shared page shells and command-form placeholders using the existing
  operation-card layout.
- Verify that connection state, target address, debug output, and existing
  CV workflows remain intact during navigation.

**Exit criteria:** Both pages load in browser and Electron builds; routing,
keyboard tab navigation, accessible labels, and narrow-window tab scrolling
work with mocked command data.

### Phase 2 — Typed catalog and command forms

- Implement the initial reviewed command catalog with typed parameter
  definitions and capability/risk metadata.
- Build the command selector and parameter form from catalog entries.
- Add client-side validation, command preview, confirmation policy, and
  structured result states.
- Cover serialization and validation with focused tests, including quoted
  text, optional parameters, enumerated keywords, and malformed values.

**Exit criteria:** Tests prove supported inputs serialize exactly as expected
and unsupported/invalid inputs cannot reach the transport.

### Phase 3 — Safe query and low-impact operations

- Implement a small, approved set of read-only status/list commands first.
- Validate direct replies, asynchronous broadcasts, missing replies, and
  device errors against fixtures and agreed hardware.
- Add accessible progress and result feedback without implying more certainty
  than the protocol provides.

**Exit criteria:** Read-only commands are hardware-verified and distinguish
valid results from timeout, unsupported, malformed, and disconnected states.

### Phase 4 — Configuration and state-changing operations

- Add configuration changes and routine operational commands by risk class.
- Add review/confirmation and explicit outcome handling for persistent,
  destructive, or high-impact operations.
- Add redaction for network credentials before exposing Wi-Fi commands.
- Add raw-packet commands only as a separately reviewed advanced capability.

**Exit criteria:** Each enabled command has tests for validation, expected
responses, timeout/disconnect recovery, and confirmation behavior; hardware
tests verify the documented side effects.

### Phase 5 — Integration and release readiness

- Verify all supported command tabs, connection-mode gating, navigation, and
  shared shell behavior in web and Electron builds.
- Test accessibility, keyboard use, responsive tab scrolling, and error
  recovery.
- Update user-facing command documentation and the hardware/firmware support
  matrix to match the implemented allowlist.

**Exit criteria:** No command outside the approved allowlist can be sent;
existing CV and CV Table workflows remain covered by passing tests; release
notes state the exact supported command subset and limitations.

## 8. Acceptance criteria

- Extended Configuration and Operations are reachable from distinct,
  accessible header buttons with the requested icons.
- Each page exposes its document-derived areas as navigable tabs.
- Selecting a command form shows the correct typed inputs and exact command
  preview; invalid input blocks transmission.
- Commands unavailable for the current transport, hardware, or firmware are
  clearly identified and not sent.
- The UI distinguishes transmission from confirmed command outcome and never
  shows a success-shaped fallback for missing or uncertain responses.
- High-impact changes show the exact target and command for confirmation;
  credentials are not exposed in logs or persisted.
- Navigation preserves connection and existing application state, and the CV
  editor and CV Table retain their existing behavior.
- Tests cover command serialization, capabilities, confirmation, credential
  redaction, response parsing, and failure recovery for every enabled command
  family.

## 9. Decisions to resolve before implementation

- Which command forms are in the first hardware-verified release subset?
- Should read-only commands be available while disconnected as preview-only
  forms, or should selection itself be gated?
- Which mutations require confirmation, and what exact wording is required for
  track power, loco motion, deletion, reset, and raw packets?
- Which DCC-EX firmware/build feature flags can the app discover, and which
  require explicit user selection?
- What protocol evidence distinguishes a command being accepted from its
  effect being completed?
- What is the approved storage/redaction policy for network credentials and
  sensitive serial traffic?
- Should command-specific results remain visible when navigating between
  tabs/pages, and for how long?
