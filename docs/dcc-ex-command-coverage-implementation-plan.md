# DCC-EX command coverage and execution plan

## Goal and starting point

Complete the Extended Configuration and Operations catalog against the
[command inventory](./dcc-ex-serial-commands-by-purpose.md), and make verified
commands executable from CabScribe on Web Serial and Electron. This follows the
[original implementation plan](./extended-configuration-operations-plan.md);
preserve the existing tabs, CV editor, CV Table, and shared serial session.

The starting catalog had ten entries, including two views of the same `<s>`
request. `DccCommandService` only dispatches station status and only on a
connection that declares support.
The [USB bench result](./extended-configuration-operations-plan.md#hardware-verification-record)
confirms an identity and power-state reply on MEGA / EX8874 with DCC-EX 5.6.6;
it does not verify either app adapter, other commands, or newer firmware features.

## 1. Inventory, variants, and parameters

Track every inventory variant with a stable form ID, page/tab, source revision,
syntax, parameter schema, effects, prerequisites, reply contract, and disposition:
**live**, **preview-only**, **deprecated/hidden**, or **deferred** with a reason.
Give overloaded forms separate IDs where the operands or result change; use
keyword choices only for variants with the same contract. Reuse shared forms
by ID when they belong on both pages. Keep the existing `<s>` entries as two UI
views of one execution contract. Check syntax against the pinned
[protocol reference](./dcc-ex-serial-commands.md) and each target firmware;
resolve documentation and firmware disagreements before promotion.

| Page / tab | Coverage to reconcile | Parameter forms to add or extend |
| --- | --- | --- |
| Configuration / Power | Track modes/modifiers, DC modes, programming boost, global speed steps | Track IDs and mode keywords; conditional locomotive address for DC |
| Configuration / Turnouts | Create and delete turnouts, sensors, outputs | Separate DCC linear and address/subaddress forms, VPIN and servo forms; positions, profile, pull-up, flags |
| Configuration / Network | Hostname, node group/mode, Ethernet, Wi-Fi modes and diagnostics | Quoted names, toggle keywords, sensitive SSID/password, optional AP channel |
| Configuration / Diagnostics | NVS, RailCom, sniffer, ACK, analogue/servo/turntable tests, HAL, sensors, EXRAIL, development diagnostics | Integer vs. quoted NVS value; verified units and ranges for current/timing; optional profile and activity |
| Operations / Throttle | Station capacity/status, stop, pause/resume, locomotive state, speed, functions and removal | Loco ID, signed speed, direction, function/state and frequency |
| Operations / Track | All/MAIN/PROG/named track power, JOIN, track list and reset | Track selection and distinct no-argument variants |
| Operations / Turnouts | Turnout details/state, sensor lists, output lists/state | Turnout/output ID, explicit close/throw vs. numeric position, active state |
| Operations / JMRI | Automation, fast clock, gauge/current/display, stash, turntable, roster, signal and turnout queries or actions | Route/entity IDs, time and rate, display/row, stash ID and locomotive ID |
| Operations / Turntables | List/status and DCC/EXTT movement | Turntable ID, position and EXTT activity |
| Operations / Consists | Consist list/create/remove, momentum, MAIN/PROG raw-packet review | Bounded lists of signed locomotive IDs or bytes; separate symmetric/asymmetric momentum forms |

JMRI roster configuration and turntable setup are out of scope for CabScribe.
The inventory still documents those firmware commands; the JMRI and Turntables
tabs remain available on Operations only.
Operations no longer has dedicated Accessories, Pins, or Automation tabs.
Use the Single CV editor for decoder programming; the protocol inventory still
documents all three command families.

Extend [the catalog](../libs/common/src/lib/dcc/command-definitions.ts) and
[preview validation](../libs/common/src/lib/dcc/command-preview.ts) only as needed:
conditional and bounded repeatable fields, ordered optional arguments,
command-specific quoting and keyword/boolean encoding, and cross-field validation
such as index ranges and distinct consist members where required. Preserve zero
and false; never silently clamp, round, or guess a unit or default. Keep wire
serialization separate from display previews. Sensitive fields must never appear
in previews, serial logs, debug output, errors, analytics, or persisted state;
verify redaction for received echoes and diagnostics before enabling those forms.

**Exit:** Every variant is accounted for. Supported previews have exact byte
fixtures and invalid cases; unresolved forms have a documented blocker.

**First batch implemented:** 13 new read-only previews for capacity, turnout
details, sensors, outputs, fast clock, roster, JMRI turnout and turntable
queries, turntable status, and consists. The existing Service Mode CV preview
remains in Extended Configuration / Power and Operations / Track.
The new queries are Operations-only and are not on the execution allowlist.
The rest of the coverage table remains backlog.

## 2. Execute one verified read-only slice end to end

1. Extend [the transport contract](../libs/common/src/lib/dcc/dcc-transport.ts)
   and [session service](../libs/common/src/lib/dcc/dcc-session.service.ts) to
   dispatch approved requests by typed command ID and parameters. Keep serial
   ownership in the session across routes. Share arbitration with CV reads,
   scans, address confirmation and Debug so replies cannot cross workflows.
2. Replace the status-only branch in
   [the command service](../libs/common/src/lib/dcc/dcc-command.service.ts)
   with an explicit execution allowlist. Check connection, mode, hardware,
   firmware/build features, adapter, valid input, and confirmation at send time.
   In Electron, validate enabled operations and parameters at the restricted
   preload/main IPC boundary; do not expose a general-purpose serial writer.
   Keep Web Serial on the same typed application path.
3. Give each command an explicit reply matcher and end condition. Handle
   fragmented frames, unrelated broadcasts, empty lists, device errors,
   timeouts, disconnects, and late replies. Do not start a new ambiguous request
   until the session has recovered. Distinguish **sent**, **acknowledged**,
   **verified**, and **outcome unknown**; an acknowledgment is not proof of
   physical movement or persistence.
4. Wire [the shared form](../apps/cabscribe/src/app/command-form.component.html)
   to show actionable disabled reasons, exact or redacted previews, typed
   results, and recovery instructions. Preserve keyboard navigation and
   responsive layouts. Tab/page changes clear drafts and visible results,
   not in-flight serial ownership. Keep target fields command-specific.

Start with station identity/status on the bench-confirmed hardware. Verify
Web Serial and Electron independently, including physical unplug/reconnect.
Then add track, turnout and sensor lists and reconcile the programming-track
read forms with the existing CV workflow before adding additional query families.
Use a fixture and a real-device acceptance check for each newly enabled form.

**Adapter implementation:** Station identity and status now share a dedicated,
argument-free transport request. Electron uses a fixed IPC route, not a raw
serial writer. Automated tests cover the Web Serial write and the Electron
bridge, IPC handler, and serial drain with simulated devices. The user verified
station identity through Web Serial; Electron and physical unplug/reconnect
checks remain open.

**Track list:** Both adapters support the dedicated read-only `<=>` request.
The [Web Serial Debug trace](./extended-configuration-operations-plan.md#hardware-verification-record)
supplied the initial reply fixture. The pinned firmware emits one frame per
track and no terminator. The app collects rows for 500 ms after the first
recognized row, labels them as observed, and treats no rows before the deadline
as a timeout rather than an empty list. Real-device checks through the dedicated
form remain open.

**Exit:** Both adapters can exercise their approved read-only subset end to end;
unapproved commands cannot reach serial, even if they can be previewed.

## 3. Add mutations in reviewable batches

1. **Routine controls:** Start with reversible single-target operations on an
   isolated bench. Before enabling locomotive motion, verify a dedicated stop
   action and its behavior during busy/disconnected states; the UI must not
   imply a software stop can work without a connection.
2. **Persistent and physical changes:** Add track mode, turnout/sensor/output
   setup, roster, turntable setup, peripherals and automation in family-sized
   batches. Display the target and effect, distinguish save from runtime
   changes, and document verification and recovery for each family.
3. **High-impact and conditional forms:** Review CV/POM writes, track JOIN,
   resets/deletes, credentials, advanced diagnostics, automation overrides,
   and raw packets separately. Keep legacy or development-only forms disabled
   unless deliberately approved. Raw packets require a separate release decision
   and the existing second confirmation bound to the exact command and target;
   edits, navigation, or a connection change invalidate it. Other commands use
   an explicit action with their effect visible. Never auto-retry a mutation.

**Exit per batch:** Tests prove exact serialization, capability and confirmation
gates, expected response/side effect, and no retry on timeout or disconnect.
A bench result records adapter, board, firmware/build, layout prerequisites,
observed behavior and recovery before the form is marked live.

## 4. Release checks

- Run existing CV/editor/scan regressions plus browser and packaged Linux
  Electron checks for command selection, validation, execution, navigation,
  permissions, and reconnect. Verify a disabled form cannot send through a
  direct service or Electron bridge call.
- Verify common reply failures with replay fixtures; verify each enabled
  family's effects on approved hardware. Do not test mutations on a live
  layout or with real Wi-Fi credentials in captured fixtures.
- Publish the exact live/preview/deferred matrix, supported hardware, adapter
  and firmware combinations, and known limitations in the user guide and
  release notes. Do not gate on an inventory count alone: every variant must
  have a disposition, and every live form must have evidence.
