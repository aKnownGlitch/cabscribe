# CabScribe Product Requirements Document

**Status:** Draft for review
**Date:** 2026-10-26

## 1. Product summary

CabScribe is a client application for reading and writing NMRA DCC decoder
Configuration Variables (CVs). It connects to a supported DCC command station
or programming interface through a serial port on the user's device and provides
a clear, safe workflow for inspecting and changing decoder parameters.

The application is intended to use Capacitor so that a shared client experience
can be packaged for the initial Linux release. macOS is an additional UI testing
environment, not an initial release target. Serial-port access and packaging
must be validated for each platform; Capacitor itself does not define the DCC
interface protocol or guarantee a serial-port API on every platform.

## 2. Problem and opportunity

DCC users need to inspect and configure decoder CVs through hardware connected
to their computer or mobile device. They need to know which interface is
connected, which operation is in progress, and whether a read or write actually
succeeded. Different hardware and operating systems may expose serial
connectivity differently, so the product must make supported combinations
clear and report unsupported or failed operations instead of implying success.

## 3. Goals

- Read a requested CV from a decoder through a supported DCC interface.
- Write a requested CV with clear review and confirmation before the operation.
- Show operation progress and an explicit result, including errors and
  timeouts.
- Make the connected serial device and connection state visible to the user.
- Provide installable, platform-specific packages for the platforms approved
  for release.
- Initially support a DCC-EX command station and Service Mode programming.
- Require read-back verification for CV writes.
- Limit the initial CV workflow to one CV at a time and do not store operation
  history.
- Align CV behavior and terminology with applicable NMRA DCC standards and
  recommended practices.

## 4. Non-goals for the initial release

- Firmware updates for decoders, command stations, or interfaces.
- General train control, throttle, accessory, or layout-management features.
- Support for every DCC command station, interface, or operating system.
- Operations Mode programming, multi-CV workflows, and persistent operation
  history in the initial release.
- Cloud accounts, remote operation, or server-side storage for core CV access.
- A built-in decoder catalog or manufacturer-specific programming guide unless
  separately approved.
- Claiming NMRA certification or conformance beyond the tested and documented
  product behavior.

## 5. Users and primary scenarios

### Primary user

A model railroader who has a decoder and a compatible DCC programming
interface, and wants to inspect or change a CV without guessing whether the
operation reached the decoder.

### Primary scenarios

1. **Connect:** The user opens CabScribe, chooses an available serial device,
   and sees whether the interface is connected and ready.
2. **Read a CV:** The user connects to a DCC-EX command station, enters one CV
   address in Service Mode, starts a read, and sees the returned value or an
   actionable failure.
3. **Write a CV:** The user enters a CV and value, reviews the pending change,
   confirms it, and sees whether the write succeeded and the read-back value
   matches the requested value.
4. **Recover:** If a device disconnects or an operation fails or times out, the
   user sees what happened and can safely reconnect or retry.

## 6. Functional requirements

### FR-1: Serial device connection

- The application shall enumerate serial devices supported by the host
  platform and selected interface implementation.
- The initial supported DCC interface shall be a DCC-EX command station.
- The user shall explicitly choose a device before connecting.
- The application shall display connection, disconnection, and permission
  states, and shall surface platform or device errors in understandable terms.
- The application shall not claim a connection is ready until the selected
  interface reports readiness.

### FR-2: CV reading

- The user shall be able to request a read of one CV address at a time in
  Service Mode, subject to the selected interface and applicable NMRA
  definition.
- The application shall display the requested CV and the value returned by
  the interface, preserving the distinction between a valid value and a
  failed, unsupported, or timed-out read.
- The initial release shall support Service Mode only and shall identify that
  mode in the CV workflow.

### FR-3: CV writing

- The user shall enter a CV address and value within the limits supported by
  the applicable NMRA definition and selected interface.
- Before sending a write, the application shall show the target CV and value
  and require an explicit user confirmation.
- A write shall not be reported as successful unless a subsequent read-back
  confirms that the value matches the requested value. If read-back is
  unsupported or cannot complete, the result shall be reported as
  unverified/failed, not successful.
- The application shall report unsupported operations, invalid values,
  rejected writes, disconnections, and timeouts without a success-shaped
  fallback.

### FR-4: Standards-aligned CV handling

- CV terminology, address/value validation, and supported operation behavior
  shall be checked against the NMRA documents listed in Section 11.
- The application shall not silently clamp, reinterpret, or substitute a CV
  address or value.
- The interface capability and applicable programming mode shall constrain
  which operations are offered. Unsupported capabilities shall be identified
  rather than presented as available.

### FR-5: Platform-specific delivery

- The initial release shall provide a side-loadable Linux package for the
  approved operating-system and architecture combination(s).
- macOS shall be used for UI testing, but is not an initial release platform.
- Each supported package shall be tested for install/launch, serial-device
  discovery, permission handling, connect/disconnect, and at least one
  supported Service Mode read and verified-write workflow using the agreed
  DCC-EX test hardware.
- Unsupported platform/device combinations shall be documented before release.

## 7. Safety, reliability, and usability requirements

- CV writes can alter decoder behavior. The product shall require deliberate
  confirmation and clearly identify the exact CV/value being written.
- If an operation's outcome is uncertain (for example, the connection is lost
  after sending a request), the application shall report an unknown/failed
  outcome and shall not automatically repeat a write.
- Serial-port access shall be user-initiated and limited to the active
  connection and operation. The product shall clearly explain any platform
  permission request it needs.
- Core CV access shall work locally without requiring a network connection or
  account.
- Errors shall include a useful next step where known, such as checking the
  selected port, reconnecting the interface, or verifying the programming
  setup.

## 8. Success criteria

The initial release is acceptable when:

- A user can connect to each supported interface/platform combination and
  clearly see its connection state.
- A user can read a single CV and write a single CV in Service Mode using a
  DCC-EX command station.
- A write is only reported as successful after read-back confirms the
  requested value.
- Invalid inputs are rejected before transmission, and failed, unsupported,
  or uncertain outcomes are never shown as successful.
- All release packages pass the platform-specific acceptance tests in FR-5.
- The supported hardware, platform, and operation matrix is documented.
- The initial Linux package can be side-loaded, and the UI is exercised in
  macOS testing.

Specific performance targets, supported CV test cases, and release coverage
thresholds remain to be agreed during implementation planning.

## 9. Product constraints and project guidance

- Follow the supplied Nx project guidance: keep self-contained applications
  under `apps/`, and shared components/services in the common Angular library
  under `libs/`.
- For Angular applications, use Angular Material, organize code with Core and
  Feature areas, and prefer SCSS.
- Give each application or library its own `package.json`; keep root
  dependencies focused on Nx workspace needs.
- Do not add server-side rendering or example applications unless explicitly
  approved.
- Capacitor is the proposed cross-platform runtime. The serial connection
  capability may require a native plugin or platform-specific implementation;
  this PRD does not select a plugin or prescribe its implementation.
- The initial release targets Linux and uses side-loaded distribution;
  macOS is for UI testing only. Service Mode and single-CV read/write are the
  initial programming scope, writes require read-back verification, and
  operation history is not stored.

## 10. Decisions and remaining questions

### Decisions

- **Initial hardware/interface:** DCC-EX command station.
- **Release platform and testing:** Linux is the initial release platform;
  macOS is used for UI testing.
- **Distribution:** Side-loaded package for the initial release.
- **Programming mode:** Service Mode only.
- **CV workflow:** Read and write one CV at a time.
- **Write verification:** Read-back is always required to report a successful
  write.
- **History:** Do not store operation history in the initial release.
- **Standards baseline:** Use current NMRA standards for this release.

### Remaining questions

1. Which Linux distributions/versions and CPU architectures must the first
   package support?
2. What Linux package format(s) are required for side-loading?
3. Which DCC-EX hardware configuration and serial connection protocol are the
   acceptance-test target?
4. Which CVs and test setup should be used to validate Service Mode read and
   verified-write behavior?
5. Which current NMRA document revisions will be recorded as the release
   baseline when implementation begins?

## 11. References

- [NMRA Standards and Recommended Practices](https://www.nmra.org/index-nmra-standards-and-recommended-practices) — includes the DCC section, including S-9.2 DCC Communications Standard, S-9.2.2 DCC Configuration Variables, and S-9.2.3 Service Mode Programming. Consult the current NMRA documents directly when defining protocol behavior and validation.
- [Capacitor documentation](https://capacitorjs.com/docs) — describes Capacitor's native runtime and platform APIs.
- [Creating Capacitor plugins](https://capacitorjs.com/docs/plugins/creating-plugins) — documents the plugin model for bridging JavaScript to native APIs.
