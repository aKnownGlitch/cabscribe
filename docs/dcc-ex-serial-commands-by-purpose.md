# DCC-EX Serial Commands by Purpose

This design-oriented index reorganizes the command groups in
[DCC-EX Serial Command Reference](./dcc-ex-serial-commands.md) under two major
purposes: **Configuration** and **Operations**. The original command-group
names are retained below. Groups that contain both setup and runtime commands
are split across the two sections.

This is a review aid, not a protocol specification. Commands can depend on
hardware, build options, or EXRAIL support. See the
[full reference](./dcc-ex-serial-commands.md) for notation, source revision,
command details, and licensing.

## Configuration

### Track power and track configuration

| Command | Purpose |
| --- | --- |
| `<= track tracktype>` | Set a track mode, including `MAIN`, `MAIN_INV`, `MAIN_AUTO`, `PROG`, `OFF`, `NONE`, `EXT`, and build-dependent booster modes. |
| `<= track AUTO>` / `<= track INV>` / `<= track RAILCOM>` | Add auto-reverse, inverted-polarity, or RailCom modifiers to a track. |
| `<= track DC loco>` / `<= track DC_INV loco>` / `<= track DCX loco>` | Configure a track for DC operation. `DCX` is handled like `DC_INV` in the referenced source. |
| `<C PROGBOOST>` | Configure PROG-track boost. |
| `<C SPEED28>` / `<C SPEED128>` | Select the global DCC speed-step mode. |

### Turnouts, sensors, and outputs

| Command | Purpose |
| --- | --- |
| `<T id SERVO vpin closedValue thrownValue>` | Create a servo turnout with the default profile. |
| `<T id SERVO vpin closedValue thrownValue profile>` | Create a servo turnout with profile `1` (fast), `2` (medium), or `3` (slow). |
| `<T id VPIN vpin>` | Create a pin-controlled turnout. |
| `<T id DCC addr subAddr>` / `<T id DCC linearAddr>` | Create a DCC turnout by address/subaddress or linear address. |
| `<T id addr subAddr>` | Legacy DCC turnout creation form (deprecated). |
| `<T id vpin closedValue thrownValue>` | Legacy servo turnout creation form (deprecated). |
| `<T id>` | Delete a turnout. |
| `<S id vpin pullup>` | Create a sensor with the selected pull-up setting. |
| `<S id>` | Delete a sensor. |
| `<Z id pin iFlag>` | Create an output; `id` must be positive and `iFlag` is `0..7`. |
| `<Z id>` | Delete an output. |

### JMRI-compatible information and roster

| Command | Purpose |
| --- | --- |
| `<J R SAVE>` | Save the roster to persistent storage. |
| `<J R locoid DELETE>` | Delete a roster entry. |
| `<J R locoid name functionMap>` | Add or update a roster entry. Text arguments are quoted. |

### Turntables

| Command | Purpose |
| --- | --- |
| `<I id DCC homeAngle>` | Create a DCC turntable. |
| `<I id EXTT vpin homeAngle>` | Create an EXTT turntable. |
| `<I id ADD position value angle>` | Add a position to a turntable. |

### Network configuration and diagnostics

These settings and diagnostics are available only on supported
hardware/builds; some are restricted to USB serial.

| Command | Purpose |
| --- | --- |
| `<C HOSTNAME hostname>` | Set the network hostname. |
| `<C NODEGROUP group>` | Set the node group (`1..254`). |
| `<C NODE ON>` | Enable node mode without throttle support (testing-oriented). |
| `<C ETHERNET onoff>` | Enable or disable Ethernet where supported. |
| `<C WIFI HOSTNAME hostname>` | Legacy hostname form (deprecated; use `C HOSTNAME`). |
| `<C WIFI DEFAULT>` | Restore default Wi-Fi credentials. |
| `<C WIFI ssid password>` | Set Wi-Fi station credentials. |
| `<C WIFI TEMP ssid password>` | Set temporary Wi-Fi station credentials. |
| `<C WIFI AP ssid password [channel]>` | Configure Wi-Fi access-point mode. |
| `<C WIFI HIDDENAP ssid password [channel]>` | Configure hidden access-point mode. |
| `<C WIFI onoff>` | Enable or disable Wi-Fi where supported. |
| `<D WIFI onoff>` / `<D ETHERNET onoff>` / `<D WIT onoff>` / `<D WEBSOCKET onoff>` / `<D NODE onoff>` | Toggle Wi-Fi, Ethernet, WiThrottle, WebSocket, or node diagnostics. |
| `<D WIFI SHOW>` / `<D ETHERNET SHOW>` | Show network status. |

### Configuration and diagnostics

These settings and diagnostic commands can be platform-dependent or restricted
to USB serial. Some change persistent state.

| Command | Purpose |
| --- | --- |
| `<C NVS nvsnumber nvsvalue>` | Set a non-volatile-storage value as an integer or quoted string. |
| `<C RAILCOM onoff>` | Enable or disable RailCom cutout where supported. |
| `<C SNIFFER onoff>` | Toggle sniffer output in supported builds. |
| `<D ACK onoff>` | Enable or disable PROG-track ACK diagnostics. |
| `<D ACK LIMIT value>` | Set the ACK detection limit in mA. |
| `<D ACK MIN value>` / `<D ACK MIN value MS>` | Set the minimum ACK pulse duration in microseconds or milliseconds. |
| `<D ACK MAX value>` / `<D ACK MAX value MS>` | Set the maximum ACK pulse duration in microseconds or milliseconds. |
| `<D ACK RETRY value>` | Set the ACK retry count. |
| `<D ANIN vpin>` | Read and display an analogue input. |
| `<D CMD onoff>` | Enable or disable command-input diagnostics. |
| `<D RAILCOM onoff>` | Enable or disable RailCom diagnostics. |
| `<D NVS>` / `<D NVS value>` | Show all non-zero values or one selected value. |
| `<D ANOUT vpin position>` / `<D ANOUT vpin position profile>` | Legacy analogue-output test commands (deprecated; use `z`). |
| `<D SERVO vpin position [profile]>` | Test a servo output. |
| `<D TT vpin steps [activity]>` | Test a turntable output. |
| `<D HAL SHOW>` / `<D HAL RESET>` | Show or reset hardware-abstraction-layer devices. |
| `<D SENSORS>` | Display sensor-task diagnostics. |
| `<D EXRAIL onoff>` | Enable or disable EXRAIL diagnostics when EXRAIL is built in. |
| `<D SHARE>` | Development/testing command for sharing nodes with the command station. |

## Operations

### Station and throttle

| Command | Purpose |
| --- | --- |
| `<#>` | Report the number of simultaneously supported locomotives. |
| `<!>` | Emergency-stop all locomotives. |
| `<! P>` / `<! R>` / `<! Q>` | Pause the layout, resume it, or report its paused state. |
| `<s>` | Report command-station identity/version and broadcast power, turnout, and sensor state. |
| `<t loco>` | Request the current state of a locomotive. |
| `<t loco tSpeed direction>` | Set locomotive speed and direction. Speed is `-1..127`; direction is `0` reverse or `1` forward. |
| `<f loco byte1>` / `<f loco group byte2>` | Set a legacy locomotive function group (deprecated; use `F`). |
| `<F loco function onoff>` | Set one locomotive function on or off. `onoff` accepts `ON`/`OFF` or `1`/`0`. |
| `<F loco DCCFREQ freqValue>` | Set a locomotive's DC frequency setting (`0..3`). |
| `<->` | Clear all locomotive state and reminders. |
| `<- loco>` | Remove one locomotive's state and reminders. |

### Track power and track configuration

| Command | Purpose |
| --- | --- |
| `<1>` / `<0>` | Turn power on/off for all tracks. |
| `<1 MAIN>` / `<0 MAIN>` | Turn MAIN track power on/off. |
| `<1 PROG>` / `<0 PROG>` | Turn PROG track power on/off; PROG support is build-dependent. |
| `<1 JOIN>` | Join PROG to MAIN and power both tracks; PROG support is build-dependent. |
| `<1 track>` / `<0 track>` | Turn power on/off for the named track. |
| `<=>` | List track-manager state. |
| `<C RESET>` / `<D RESET>` | Turn track power off and restart the command station. |

### Turnouts, sensors, and outputs

| Command | Purpose |
| --- | --- |
| `<T>` | List turnout definitions and states. |
| `<T id X>` | Show turnout details. |
| `<T id T>` / `<T id C>` | Throw or close a turnout. |
| `<T id value>` | Set turnout position using a numeric value (`0` closes). |
| `<S>` | List sensor states in the JMRI `<q ...>` representation. |
| `<Q>` | List sensor states in the JMRI `<Q ...>` representation. |
| `<Z>` | List output definitions. |
| `<Z id active>` | Set an output's active state. |

### JMRI-compatible information and roster

| Command | Purpose |
| --- | --- |
| `<J A>` | List automation/route IDs. |
| `<J A id>` | Get automation details and, when supported, route state/caption. |
| `<J C>` / `<J C mmmm nn>` | Get or set fast-clock time. |
| `<J G>` | Report track gauge limits. |
| `<J I>` | Report track current. |
| `<J L display row>` | Direct current information to a display. |
| `<J M>` / `<J M stashId>` | List stash entries or get one entry. |
| `<J M stashId loco>` | Set a stash entry to a locomotive. |
| `<J M CLEAR ALL>` / `<J M CLEAR stashId>` | Clear all stash entries or one entry. |
| `<J M CLEAR ANY loco>` | Clear stash entries containing a locomotive. |
| `<J O>` / `<J O id>` | List turntables or get one turntable's state. |
| `<J P id>` | List positions for a turntable. |
| `<J R>` / `<J R locoid>` | List roster IDs or get a roster entry. |
| `<J S>` / `<J S signal_id>` | List signal IDs or get a signal state and description. |
| `<J T>` / `<J T id>` | List turnout IDs or get a turnout state and description. |

### Turntables

| Command | Purpose |
| --- | --- |
| `<I>` | List turntables and their states. |
| `<I id>` | Report turntable type and current position. |
| `<I id position>` | Move a DCC turntable to a position. |
| `<I id position activity>` | Move an EXTT turntable to a position with an activity value. |

### DCC accessory and programming commands

| Command | Purpose |
| --- | --- |
| `<a address subAddr activate>` | Send a DCC accessory command by address/subaddress. `activate`: `0` off, `1` on. |
| `<a address subAddr activate onoff>` | Accessory command with on/off control (`0` off, `1` on, `2` toggle). |
| `<a address activate>` | Send an accessory command using a linear address. |
| `<A address aspect>` | Send an extended accessory aspect command (`0..31`). |
| `<w loco cv value>` | Write a locomotive CV on the main track (POM). |
| `<r loco cv>` | Read a locomotive CV on the main track (POM); requires RailCom. |
| `<b loco cv bitPosition bitValue>` | Write one locomotive CV bit on the main track (POM). |
| `<w A linearaddress cv value>` | Write a basic accessory decoder CV on the main track. |
| `<w E linearaddress cv value>` | Write an extended accessory decoder CV on the main track. |
| `<W loco>` | Program a locomotive address on the PROG track. |
| `<W CONSIST loco>` / `<W CONSIST loco REVERSE>` | Program a consist address, optionally reversed, on the PROG track. |
| `<W cv cValue>` / `<W cv bitPosition bitValue>` | Write a CV byte or bit on the PROG track. |
| `<V cv cValue>` / `<V cv bitPosition bitValue>` | Verify a CV byte or bit against an expected value. |
| `<B cv bitPosition bitValue>` | Write a CV bit using the byte/bit programming operation. |
| `<R>` | Read the driveable locomotive ID on the PROG track. |
| `<R LOCOID>` / `<R CONSIST>` | Read the locomotive ID while ignoring consist information, or read the consist ID. |
| `<R cv>` | Read a CV on the PROG track. |

### Consists, momentum, and raw packets

| Command | Purpose |
| --- | --- |
| `<^>` | List consists. |
| `<^ loco>` | Remove the consist containing a locomotive. |
| `<^ leadLoco follower [follower2..7]>` | Create a consist; negative locomotive IDs indicate reverse orientation. |
| `<m LINEAR>` / `<m POWER>` | Select the global momentum algorithm. |
| `<m loco momentum>` | Set equal acceleration and braking momentum for a locomotive. |
| `<m loco accelerating braking>` | Set separate acceleration and braking momentum. |
| `<M ignore d0 d1 [d2..d14]>` | Send a raw DCC packet on MAIN. Data bytes are numeric byte values; `ignore` is retained for compatibility. |
| `<P ignore d0 d1 [d2..d5]>` | Send a raw DCC packet on PROG. This form is present in the generated reference but may be hidden in a given build. |

### Pins, displays, sound, and peripherals

| Command | Purpose |
| --- | --- |
| `<z signedVpin>` | Set a pin high for a positive value or low for a negative value. |
| `<z vpin analogue>` | Write an analogue/PWM value immediately. |
| `<z vpin analogue profile>` | Write an analogue value using a profile; source profiles include immediate, fast, medium, slow, and bounce. Add `128` to keep power on after movement. |
| `<z vpin analogue profile duration>` | Change an analogue value over a specified duration. |
| `<o vpin>` / `<o vpin count>` | Turn one or multiple NeoPixels on/off; sign selects the state. |
| `<o vpin r g b>` / `<o vpin r g b count>` | Set one or multiple NeoPixels to an RGB color (`0..255` per channel). |
| `<@>` | Request virtual messages for the client. |
| `<@ display row text>` | Display quoted text on a virtual LCD row. |
| `<y vpin PLAY trackNumber [volume]>` / `<y vpin REPEAT trackNumber [volume]>` | Play or repeat a sound track, optionally with a volume. |
| `<y vpin FOLDER folder>` | Select a sound folder. |
| `<y vpin STOP>` / `<y vpin PAUSE>` / `<y vpin RESUME>` | Stop, pause, or resume sound playback. |
| `<y vpin VOL volume>` / `<y vpin EQ eq>` | Set sound volume or equalizer. |
| `<y vpin RESET>` | Reset the sound module. |
| `<N>` / `<N Q>` / `<N cmd value>` | SensorCam commands described by the reference; handling depends on the SensorCam HAL parser. |

### EXRAIL automation

EXRAIL commands require a build with EXRAIL enabled.

| Command | Purpose |
| --- | --- |
| `</>` | Stream EXRAIL status. |
| `</ PAUSE>` / `</ RESUME>` | Pause or resume EXRAIL tasks. |
| `</ START route>` / `</ START loco route>` | Start a route or start an automation/sequence for a locomotive. |
| `</ KILL ALL>` / `</ KILL taskid>` | Stop all EXRAIL tasks or the task with the specified ID. |
| `</ RESERVE section>` / `</ FREE section>` | Reserve or free a section. |
| `</ FREEALL>` | Free all section reservations. |
| `</ LATCH latch>` / `</ UNLATCH latch>` | Set or clear a pin latch. |
| `</ RED signal>` / `</ AMBER signal>` / `</ GREEN signal>` | Set a signal aspect. |
| `<K blockId loco>` / `<k blockId loco>` | Report a locomotive entering or exiting a block. |
| `<L>` / `<L eventId>` | Introduce the LCC/CBUS adapter or deliver an incoming LCC event. |
