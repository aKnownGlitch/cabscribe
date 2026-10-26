# CabScribe Implementation Plan

**Status:** Draft for review
**Date:** 2026-10-26
**Product requirements:** [PRD](./prd.md)
**UX design brief:** [UX design brief](./ux-design-brief.md)
**Figma design:** [CabScribe — programming UI](https://www.figma.com/design/oZaLXycE1JaaoOjuOVfWTf/CabScribe?node-id=4-20817&t=5IuiFYRVxgVi4aAU-1)

## 1. Plan objective

Deliver an initial, side-loadable Linux desktop application with an Angular UI
hosted by Electron. It will read and write one NMRA DCC decoder CV at a time, in
Service Mode, through a DCC-EX command station over serial. A write is
successful only after a read-back confirms the requested value. macOS is a UI
testing environment, not a release target. The application must not store
operation history.

This plan sequences the work, validation, and decision gates. It is not an
implementation specification for an unconfirmed serial protocol or native
runtime.

## 2. Guiding constraints

- Follow the supplied Nx project guidance: self-contained applications under
  `apps/`; shared UI/services in a common Angular library under `libs/`; Angular
  Material; Core/Feature structure; SCSS; no SSR or example application unless
  later approved.
- Keep the serial/DCC boundary behind a typed application-facing interface so
  the CV workflow is not coupled to a particular host runtime.
- Keep Node serial access in Electron's main process. The Angular renderer must
  not receive raw Node or unrestricted IPC access.
- Do not report a write as successful without confirmed read-back. Do not
  automatically repeat a write after an uncertain outcome.
- Implement only agreed NMRA-defined validation after recording the applicable
  document revisions. Do not invent ranges or silently normalize user input.
- Keep operation data ephemeral; do not persist an operation history.
- Use the Figma design as the UI source of truth, subject to the behavior and
  safety requirements in the PRD.

## 3. Phase plan

### Phase 0 — Resolve platform and protocol feasibility

**Purpose:** Prove that the chosen runtime can deliver the Linux application
and reliable access to the target DCC-EX serial interface before committing to
the full application architecture.

**Work**

1. Confirm the DCC-EX hardware, firmware/configuration, host serial protocol,
   and documented Service Mode read, write, and read-back behavior.
2. Record the current NMRA revisions to be used for CV address/value
   validation and Service Mode behavior.
3. Validate Electron plus Node SerialPort on the agreed Ubuntu/Debian target
   and CPU architecture, including native dependency packaging.
4. Prototype port discovery, explicit port selection/open/close, request and
   response handling, disconnection, and a safe read-back cycle on the agreed
   hardware.
5. Verify the side-loadable Debian package on agreed Linux versions and
   confirm the macOS UI test workflow.

**Exit criteria / decision gate**

- A tested architecture decision confirms Electron, Node SerialPort, secure
  preload/IPC boundaries, DCC-EX protocol source, and package format.
- A repeatable hardware-backed proof demonstrates port connection and at least
  one Service Mode read and verified write, or identifies a concrete blocker
  and a revised product decision.
- Linux distribution/architecture scope and the DCC-EX test target are agreed.

**Dependency:** User decisions listed in Section 5. UI and domain-state work
may proceed against an explicitly unavailable transport while the hardware
protocol gate is being validated. Do not claim hardware-backed CV support
before that gate passes.

### Phase 1 — Establish the Nx application foundation

**Work**

- Create/configure the Nx workspace and self-contained Angular application
  using the provided project rules.
- Add the Electron main process and isolated preload bridge in a separate
  self-contained application under `apps/`.
- Establish the app shell, Angular Material theme foundation, Core and Feature
  areas, SCSS conventions, and local development/build commands.
- Add separate application dependency metadata as required by the workspace
  guidance.
- Set up formatting, linting, and focused test commands using the selected Nx
  targets.

**Exit criteria**

- The application builds and launches locally on the agreed Linux
  development/test environment and in the macOS UI test environment.
- No SSR or example application is generated.
- The runtime can load a minimal screen and expose the serial adapter boundary
  without leaking platform-specific APIs into the UI.

**Dependency:** Phase 0 architecture decision.

### Phase 2 — Implement serial and DCC-EX adapter

**Work**

- Implement device enumeration and explicit user-selected connection lifecycle.
- Implement port discovery and open/close in Electron's main process through a
  minimal preload API.
- Implement the verified DCC-EX host protocol behind a typed adapter, including
  readiness, response parsing, timeout, disconnect, and protocol error
  handling.
- Expose only the initial capability set: Service Mode, one-CV read, one-CV
  write, and subsequent read-back.
- Prevent overlapping or duplicate operations when the protocol cannot safely
  support them.
- Keep device access user-initiated and limited to the active session.

**Exit criteria**

- Adapter contract and supported capabilities are documented and tested.
- Tests distinguish valid values from malformed responses, unsupported
  commands, timeouts, disconnects, and uncertain write outcomes.
- Hardware-backed checks pass for the agreed DCC-EX setup.

**Dependency:** Phase 0 protocol and hardware confirmation; can proceed
alongside Phase 1 once its interface is agreed.

### Phase 3 — Implement CV rules and operation orchestration

**Work**

- Add typed CV address/value input and validation based on the recorded NMRA
  baseline and confirmed interface capabilities.
- Implement read operation state transitions and result representation.
- Implement write review/confirmation, write execution, mandatory read-back,
  and explicit verified, mismatch, unverified, failed, and unknown outcomes.
- Ensure uncertain writes are never silently retried and that errors preserve
  the distinction between "not sent," "rejected," and "outcome unknown" where
  the interface can establish it.
- Keep current operation state in memory only; add no history persistence.

**Exit criteria**

- Unit tests cover validation boundaries, permitted operation sequencing, and
  all success/failure transitions.
- A write cannot reach the success state unless read-back equals the requested
  value.
- Invalid inputs are rejected before transmission; values are never silently
  clamped or rewritten.

**Dependency:** Phase 2 adapter contract and Phase 0 standards baseline.

### Phase 4 — Implement the Figma-aligned user experience

**Work**

- Implement the application shell and primary programming screen from the
  [Figma design](https://www.figma.com/design/oZaLXycE1JaaoOjuOVfWTf/CabScribe?node-id=4-20817&t=5IuiFYRVxgVi4aAU-1)
  and [UX design brief](./ux-design-brief.md).
- Implement disconnected, no-device, connecting, connected/ready, permission
  error, and connection-lost states.
- Implement the single-CV read/write form, active progress state, explicit
  write confirmation, and distinct read/write result variants.
- Preserve the CV/value context through confirmation and result; use the
  agreed content and validation rather than placeholder assumptions about CV
  ranges.
- Add keyboard operation, logical focus order, visible focus, accessible
  labeling, and status messaging that does not rely on color alone.
- Verify responsive behavior at narrower desktop window widths and on macOS.

**Exit criteria**

- Figma primary flow is implemented: connect → read → write confirmation →
  verified result.
- At least one error/recovery flow is implemented.
- Every required state in the UX brief is represented and tested.
- UI results reflect the application operation state; no success-shaped
  fallback or inaccessible status-only-by-color behavior remains.

**Dependency:** Figma and UX brief; operation state contract from Phase 3.
Implementation can proceed in parallel with adapter work against a mock
adapter once the interface contract is stable.

### Phase 5 — Integration, verification, and usability

**Work**

- Run component, application, and adapter tests against the integrated
  application.
- Add a deterministic fake DCC-EX adapter or protocol fixture for repeatable
  error, timeout, mismatch, and disconnect scenarios.
- Perform hardware-in-the-loop tests with the agreed DCC-EX unit and test CVs.
- Run the supported workflow on Linux and verify macOS UI behavior without
  claiming macOS is a release target.
- Conduct a short usability review of connection discovery, write
  confirmation, and failure recovery with representative users if available.

**Exit criteria**

- All PRD success criteria pass for the agreed test matrix.
- Tests verify that a lost connection after a write never appears as verified
  success and never triggers an automatic repeat.
- No operation history is written to disk.
- Accessibility and usability issues that block safe CV writing are resolved.

**Dependency:** Phases 2–4.

### Phase 6 — Linux packaging and release readiness

**Work**

- Produce the agreed side-loadable Linux package for supported distribution
  and architecture combinations.
- Validate install, launch, permissions, serial device discovery, connect /
  disconnect, read, and verified write on clean supported Linux environments.
- Document supported runtime, Linux distributions/versions, architecture,
  DCC-EX configuration, serial requirements, known limitations, and recovery
  steps.
- Confirm versioning, release artifact naming, and how the package will be
  delivered to users.

**Exit criteria**

- Side-loaded release artifact installs and launches on every agreed Linux
  target.
- Release acceptance tests pass using the approved DCC-EX test setup.
- Unsupported combinations and remaining limitations are documented.

**Dependency:** Phase 0 packaging decision and successful Phases 1–5.

## 4. Test strategy

| Level | Coverage |
|---|---|
| Unit | CV validation; operation state machine; mandatory verification; error and uncertain-outcome classification. |
| Adapter/protocol | Device discovery and lifecycle; protocol parsing; response correlation; timeout, malformed response, disconnect, and unsupported capability handling. |
| UI/component | Form validation; connection states; progress and disabled states; confirmation; accessible operation results and recovery actions. |
| Integration | UI-to-adapter workflows with a deterministic fake/fixture, including read success, verified write, mismatch, timeout, and disconnect during write. |
| Hardware-in-the-loop | Agreed DCC-EX hardware; selected Service Mode test CVs; read and write/read-back with explicit operator confirmation. |
| Platform/package | Side-load install and launch, serial permissions, device enumeration, and end-to-end workflows on agreed Linux targets; macOS UI testing. |

Hardware-backed writes must use an agreed test setup and CV set. Avoid testing
against unknown or operationally sensitive decoder values.

## 5. Decisions required before implementation

1. **Linux platform matrix:** Which distributions/versions and CPU
   architectures are release targets?
2. **Package format:** Which side-loadable artifact format(s) are required?
3. **DCC-EX target:** Which command station hardware/firmware and serial
   protocol/configuration are the acceptance target?
4. **Test CVs and setup:** Which CVs and decoder/setup are safe and repeatable
   for read/write/read-back testing?
5. **NMRA baseline:** Which specific current document revisions will be
   recorded for this release?
6. **Linux package target:** Confirm Ubuntu/Debian versions, x86_64/amd64
   architecture, and whether `.deb` is the required package format.
7. **Engineering ownership:** Who supplies/maintains DCC-EX hardware access,
   Linux test machines, and release signing or distribution credentials if
   needed?

## 6. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| The Linux desktop runtime and Capacitor serial bridge are not a supported combination. | Use the selected Electron + Angular architecture and keep the main-process serial API isolated behind a typed preload bridge. |
| Serial API or permissions differ across Linux distributions and devices. | Limit the supported matrix, include clean-install tests, and document required setup and unsupported combinations. |
| DCC-EX protocol details or Service Mode read-back behavior are not yet confirmed. | Verify against the selected hardware and its authoritative protocol documentation; gate adapter implementation on this confirmation. |
| Decoder CVs may have side effects or may not be safely repeatable for testing. | Agree on test decoders/CVs and operator procedures; require confirmation and never automatically repeat uncertain writes. |
| NMRA documents can be revised and some listed documents may have draft revisions. | Record exact applicable approved revisions at the baseline gate and avoid claiming certification or blanket conformance. |
| Figma design changes during implementation. | Keep the design link and UX brief as references; review changed flows for alignment with write-verification and failure-state requirements. |

## 7. External references

- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security) — security guidance for main/renderer process boundaries.
- [Node SerialPort supported environments](https://serialport.io/docs/guide-platform-support/) — Node/Electron support and platform/architecture limits.
- [NMRA Standards and Recommended Practices](https://www.nmra.org/index-nmra-standards-and-recommended-practices) — authoritative location for the current DCC documents; record the applicable revisions before implementing validation and protocol behavior.
