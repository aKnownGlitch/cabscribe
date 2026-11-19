/**
 * DCC-EX Command Definitions
 *
 * This module defines the typed, reviewable catalog of DCC-EX serial commands
 * supported by CabScribe. Each command definition captures:
 * - Stable command identifier and display metadata
 * - Parameter definitions with types, constraints, and enumerated choices
 * - Command safety classification (read-only, mutating, persistent, destructive, etc.)
 * - Required connection mode, firmware features, and transport capabilities
 * - Expected direct responses, broadcasts, and timeout behavior
 * - Confirmation policy
 *
 * The UI calls an application-level command service that checks this catalog
 * against the target hardware/firmware before transmission. Commands not listed
 * here cannot be sent.
 *
 * This catalog is the executable allowlist and must be verified against the
 * selected DCC-EX source revision and target firmware before each increment.
 */

/**
 * Safety classification of a command's effects.
 */
export enum CommandSafetyClass {
  /**
   * Read-only query that does not modify state.
   */
  ReadOnly = "read-only",

  /**
   * Applies runtime configuration that does not persist across resets.
   */
  RuntimeMutating = "runtime-mutating",

  /**
   * Persists state to non-volatile storage.
   */
  Persistent = "persistent",

  /**
   * Destructive operation that cannot be undone (deletion, reset, etc.).
   */
  Destructive = "destructive",

  /**
   * Diagnostic/testing command with platform or USB-serial restrictions.
   */
  Diagnostic = "diagnostic",

  /**
   * Raw DCC packet transmission requiring strict confirmation.
   */
  RawPacket = "raw-packet",
}

/**
 * Connection mode(s) in which a command is valid.
 */
export enum CommandConnectionMode {
  /**
   * Supported in Service Mode (programming track, single-CV editor).
   */
  ServiceMode = "service-mode",

  /**
   * Supported in Ops Mode (main track DCC operations).
   */
  OpsMode = "ops-mode",

  /**
   * Supported regardless of mode (configuration, diagnostics).
   */
  Any = "any",
}

/**
 * Transport capabilities required by a command.
 */
export enum CommandTransportCapability {
  /**
   * Supported on any transport (serial, Web Serial API, Electron).
   */
  Any = "any",

  /**
   * USB-serial only (some diagnostics, Wi-Fi, Ethernet commands).
   */
  UsbSerial = "usb-serial",

  /**
   * Requires specific firmware feature support.
   */
  FeatureDependent = "feature-dependent",
}

/**
 * Parameter type for form field rendering and validation.
 */
export enum ParameterType {
  Numeric = "numeric",
  Integer = "integer",
  Enumerated = "enumerated",
  Boolean = "boolean",
  String = "string",
}

/**
 * Definition of a single command parameter.
 */
export interface CommandParameter {
  /**
   * Stable identifier for this parameter.
   */
  id: string;

  /**
   * Display name shown in the form.
   */
  label: string;

  /**
   * Descriptive help text, units, and constraints.
   */
  description: string;

  /**
   * Parameter type for form field rendering.
   */
  type: ParameterType;

  /**
   * Whether this parameter is required.
   */
  required: boolean;

  /**
   * For numeric/integer parameters: [min, max] inclusive.
   */
  range?: [number, number];

  /**
   * For enumerated parameters: array of {value, label} choices.
   */
  choices?: Array<{ value: string | number; label: string }>;

  /**
   * Default value if not provided.
   */
  defaultValue?: string | number | boolean;

  /**
   * Pattern for string validation (regex string).
   */
  pattern?: string;

  /**
   * Maximum string length for string parameters.
   */
  maxLength?: number;

  /** Mask the input and omit its value from previews. */
  sensitive?: boolean;
}

/**
 * Complete definition of a supported DCC-EX command.
 */
export interface CommandDefinition {
  /**
   * Stable command identifier (e.g., "track-set-mode", "turnout-create-servo").
   */
  id: string;

  /**
   * Category within the page (e.g., "Track power and track configuration").
   */
  category: string;

  /**
   * Display name shown in command selector.
   */
  displayName: string;

  /**
   * Full command syntax template with space-separated tokens. Placeholders
   * occupy whole tokens; optional tokens may only be omitted at the end.
   * Example: "<= track {tracktype}>" or "<T {id} SERVO {vpin} {closedValue} {thrownValue}>"
   */
  syntax: string;

  /**
   * Description of what the command does.
   */
  description: string;

  /**
   * Array of parameter definitions in order.
   */
  parameters: CommandParameter[];

  /**
   * Safety classification determining confirmation/warning behavior.
   */
  safetyClass: CommandSafetyClass;

  /**
   * Connection mode(s) in which this command is valid.
   */
  connectionMode: CommandConnectionMode;

  /**
   * Transport capability requirements.
   */
  transportCapability: CommandTransportCapability;

  /**
   * Minimum DCC-EX version required (e.g., "5.0.0").
   */
  minVersion?: string;

  /**
   * Firmware features required (e.g., ["WIFI", "RAILCOM"]).
   */
  requiredFeatures?: string[];

  /**
   * Hardware platforms this command is restricted to (e.g., ["Mega", "SAMD21"]).
   * If undefined, works on all supported hardware.
   */
  restrictedHardware?: string[];

  /**
   * Direct serial response format expected (e.g., "<p1 addr cvnum value>" or "<iS>").
   * undefined means no direct response, only broadcasts.
   */
  directResponse?: string;

  /**
   * Broadcast formats that may be emitted (e.g., ["<L addr cv value>", "<q addr>"]).
   * These are informational side effects, not the command outcome.
   */
  broadcasts?: string[];

  /**
   * Timeout behavior: "complete" if command guarantees completion,
   * "uncertain" if timeout does not indicate final state.
   */
  timeoutBehavior?: "complete" | "uncertain";

  /**
   * Confirmation policy: "explicit-form" (default) or "raw-packet-only".
   * Raw-packet commands require a second confirmation with specific wording.
   */
  confirmationPolicy?: "explicit-form" | "raw-packet-only";

  /** Human-readable destination shown during command review. */
  target?: string;

  /**
   * Side effects or consequences of running this command.
   */
  consequences?: string;

  /**
   * Recovery instructions if the command times out or disconnects mid-operation.
   */
  recoverySteps?: string;
}

/**
 * Command catalog. Syntax follows the source revision in
 * docs/dcc-ex-serial-commands.md. Hardware verification is pending.
 */
const mainPacketParameters: CommandParameter[] = Array.from({ length: 15 }, (_, index) => ({
  id: `d${index}`,
  label: `Byte ${index + 1}`,
  description: "Decimal byte value (0–255).",
  type: ParameterType.Integer,
  required: index < 2,
  range: [0, 255],
}));

export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  "version-query": {
    id: "version-query",
    category: "Configuration and diagnostics",
    displayName: "Query command-station version",
    syntax: "<s>",
    description:
      "Request command-station identity and firmware version. This query also broadcasts layout state.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    directResponse: "<iDCC-EX V-VERSION / BOARD / SHIELD G-BUILD>",
    confirmationPolicy: "explicit-form",
    consequences:
      "Broadcasts current layout state without changing it.",
  },

  "status-query": {
    id: "status-query",
    category: "Station and throttle",
    displayName: "Query command-station status",
    syntax: "<s>",
    description:
      "Query the command station and broadcast power, turnout, and sensor state.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    directResponse: "<iDCC-EX V-VERSION / BOARD / SHIELD G-BUILD>",
    confirmationPolicy: "explicit-form",
    consequences: "Broadcasts current layout state without changing it.",
  },

  "list-tracks": {
    id: "list-tracks",
    category: "Track power and track configuration",
    displayName: "List track-manager state",
    syntax: "<=>",
    description: "List the configured tracks and their modes.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
  },

  "list-turnouts": {
    id: "list-turnouts",
    category: "Turnouts, sensors, and outputs",
    displayName: "List turnouts",
    syntax: "<T>",
    description: "List turnout definitions and states.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
  },

  "main-power-on": {
    id: "main-power-on",
    category: "Track power and track configuration",
    displayName: "Turn on MAIN track power",
    syntax: "<1 MAIN>",
    description: "Energizes the main track; locomotives may move.",
    parameters: [],
    safetyClass: CommandSafetyClass.RuntimeMutating,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    timeoutBehavior: "uncertain",
  },

  "main-power-off": {
    id: "main-power-off",
    category: "Track power and track configuration",
    displayName: "Turn off MAIN track power",
    syntax: "<0 MAIN>",
    description: "Cuts power to the main track.",
    parameters: [],
    safetyClass: CommandSafetyClass.RuntimeMutating,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    timeoutBehavior: "uncertain",
  },

  "set-node-group": {
    id: "set-node-group",
    category: "Network configuration and diagnostics",
    displayName: "Set network node group",
    syntax: "<C NODEGROUP {group}>",
    description: "Saves the node group in the command station's network preferences.",
    parameters: [{
      id: "group",
      label: "Node group",
      description: "Group number (1–254).",
      type: ParameterType.Integer,
      required: true,
      range: [1, 254],
    }],
    safetyClass: CommandSafetyClass.Persistent,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.FeatureDependent,
    minVersion: "6.0.0",
    timeoutBehavior: "uncertain",
  },

  "set-wifi-station": {
    id: "set-wifi-station",
    category: "Network configuration and diagnostics",
    displayName: "Set Wi-Fi station credentials",
    syntax: "<C WIFI {ssid} {password}>",
    description: "Saves Wi-Fi credentials and reconfigures the command station's network connection. Use sample values for this preview.",
    parameters: [
      { id: "ssid", label: "Network name", description: "Wi-Fi network name (SSID).", type: ParameterType.String, required: true, sensitive: true },
      { id: "password", label: "Password", description: "Wi-Fi network password.", type: ParameterType.String, required: true, sensitive: true },
    ],
    safetyClass: CommandSafetyClass.Persistent,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.FeatureDependent,
    minVersion: "6.0.0",
    timeoutBehavior: "uncertain",
  },

  "raw-packet-main": {
    id: "raw-packet-main",
    category: "Consists, momentum, and raw packets",
    displayName: "Review a raw DCC packet (MAIN)",
    syntax: `<M 0 ${mainPacketParameters.map(({ id }) => `{${id}}`).join(" ")}>`,
    description: "Compose a packet of 2–15 bytes for the main track. Raw packets can change decoder or locomotive behavior.",
    parameters: mainPacketParameters,
    safetyClass: CommandSafetyClass.RawPacket,
    connectionMode: CommandConnectionMode.OpsMode,
    transportCapability: CommandTransportCapability.FeatureDependent,
    confirmationPolicy: "raw-packet-only",
    target: "MAIN track",
    timeoutBehavior: "uncertain",
  },

  "read-cv-service-mode": {
    id: "read-cv-service-mode",
    category: "Track power and track configuration",
    displayName: "Read a configuration variable (Service Mode)",
    syntax: "<R {cv}>",
    description:
      "Read a configuration variable (CV) in Service Mode. The decoder must be on the programming track.",
    parameters: [
      {
        id: "cv",
        label: "CV number",
        description: "Configuration variable number (1–1024).",
        type: ParameterType.Integer,
        required: true,
        range: [1, 1024],
      },
    ],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.ServiceMode,
    transportCapability: CommandTransportCapability.Any,
    directResponse: "<v CV VALUE>",
    timeoutBehavior: "uncertain",
    confirmationPolicy: "explicit-form",
    consequences:
      "No side effects. Reads and displays the CV value from the connected decoder.",
  },
};

/**
 * Get a command definition by ID.
 */
export function getCommandDefinition(id: string): CommandDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(COMMAND_DEFINITIONS, id)
    ? COMMAND_DEFINITIONS[id]
    : undefined;
}

/**
 * Get all command definitions.
 */
export function getAllCommandDefinitions(): CommandDefinition[] {
  return Object.values(COMMAND_DEFINITIONS);
}

/**
 * Get commands by category.
 */
export function getCommandsByCategory(category: string): CommandDefinition[] {
  return Object.values(COMMAND_DEFINITIONS).filter(
    (cmd) => cmd.category === category,
  );
}

/**
 * Get unique categories from all commands, in display order.
 */
export function getCommandCategories(): string[] {
  const categories = new Set<string>();
  Object.values(COMMAND_DEFINITIONS).forEach((cmd) => {
    categories.add(cmd.category);
  });
  return Array.from(categories);
}
