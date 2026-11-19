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
   * Full command syntax template with parameter placeholders.
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
 * Phase 0 implementation: Minimal set of verified read-only commands.
 * Before moving to Phase 1, review this list against the target firmware,
 * document hardware/version support, and verify responses in test.
 *
 * Early phases use only read-only commands; state-changing operations are
 * added in later phases with explicit hardware verification.
 */
export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  // Phase 0: Read-only status commands for discovery and verification

  "version-query": {
    id: "version-query",
    category: "Configuration and diagnostics",
    displayName: "Query command-station version",
    syntax: "<iS>",
    description:
      "Query the DCC-EX command-station version. Used to identify the connected firmware and validate command support.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    directResponse: "<iS PLATFORM VERSION BUILD FEATURES>",
    confirmationPolicy: "explicit-form",
    consequences:
      "No side effects. Response identifies firmware version and available features.",
  },

  "status-query": {
    id: "status-query",
    category: "Station and throttle",
    displayName: "Query command-station status",
    syntax: "<s>",
    description:
      "Query overall command-station status including power state and track configuration.",
    parameters: [],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.Any,
    transportCapability: CommandTransportCapability.Any,
    directResponse:
      "<p TRACK_NUMBER POWER_STATE> for each track, <> for end of list",
    confirmationPolicy: "explicit-form",
    consequences: "No side effects. Displays current power and track states.",
  },

  "read-cv-service-mode": {
    id: "read-cv-service-mode",
    category: "Track power and track configuration",
    displayName: "Read a configuration variable (Service Mode)",
    syntax: "<R CV CALLSIGN>",
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
      {
        id: "callsign",
        label: "Callsign (optional)",
        description:
          "Optional callsign identifier (up to 20 characters). Returned in the response.",
        type: ParameterType.String,
        required: false,
        maxLength: 20,
      },
    ],
    safetyClass: CommandSafetyClass.ReadOnly,
    connectionMode: CommandConnectionMode.ServiceMode,
    transportCapability: CommandTransportCapability.Any,
    directResponse: "<r CV CALLSIGN VALUE>",
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
  return COMMAND_DEFINITIONS[id];
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
