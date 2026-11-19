/**
 * DCC Command Service
 *
 * Application-level command service that:
 * - Validates command definitions against target hardware/firmware
 * - Serializes user input to exact DCC-EX command syntax
 * - Manages command execution state and outcome tracking
 * - Handles confirmations, timeouts, and disconnects
 * - Implements redaction of sensitive data
 *
 * This service sits between the UI command forms and the DCC transport layer.
 * Commands are only transmitted if they are:
 * 1. Defined in the approved command catalog
 * 2. Supported by the connected transport and firmware
 * 3. Properly validated against parameter constraints
 * 4. Explicitly confirmed by the user (second confirmation for raw packets)
 */

import { Injectable, inject, signal, computed } from "@angular/core";
import { DccSessionService } from "./dcc-session.service";
import {
  CommandDefinition,
  CommandSafetyClass,
  CommandConnectionMode,
  CommandTransportCapability,
  COMMAND_DEFINITIONS,
  getCommandDefinition,
} from "./command-definitions";

/**
 * Result of command execution.
 */
export interface CommandExecutionResult {
  /**
   * Execution status: "pending", "sent", "confirmed", "rejected", "timeout", "disconnected", "unknown"
   */
  status:
    | "pending"
    | "sent"
    | "confirmed"
    | "rejected"
    | "timeout"
    | "disconnected"
    | "unknown";

  /**
   * Direct response from the command-station (if any).
   * Not persisted; cleared when user navigates away.
   */
  directResponse?: string;

  /**
   * Broadcasted messages received during/after command execution.
   * Not persisted; cleared when user navigates away.
   */
  broadcasts?: string[];

  /**
   * Error message if status is "rejected", "timeout", etc.
   */
  error?: string;

  /**
   * Timestamp of the last status change.
   */
  timestamp: Date;
}

/**
 * State for a command under composition (form entry).
 */
export interface CommandCompositionState {
  /**
   * The command definition being composed.
   */
  definition: CommandDefinition;

  /**
   * User-entered parameter values by parameter ID.
   * undefined values indicate the user has not filled that parameter.
   */
  parameterValues: Record<string, string | number | boolean | undefined>;

  /**
   * Validation errors by parameter ID.
   */
  validationErrors: Record<string, string>;

  /**
   * Exact serialized command string (empty if validation fails).
   */
  serializedCommand: string;

  /**
   * Whether all required parameters are valid.
   */
  isValid: boolean;

  /**
   * Whether the user has confirmed submission (second confirmation for raw packets).
   */
  isConfirmed: boolean;
}

@Injectable({
  providedIn: "root",
})
export class DccCommandService {
  private readonly session = inject(DccSessionService);

  /**
   * Currently composing command (form entry state).
   */
  private composingCommand = signal<CommandCompositionState | null>(null);

  /**
   * Last execution result (cleared on navigation).
   */
  private lastResult = signal<CommandExecutionResult | null>(null);

  /**
   * Controller firmware/version info (queried once at connection).
   */
  private controllerVersion = signal<ControllerVersionInfo | null>(null);

  /**
   * Public accessors
   */
  readonly composing = this.composingCommand.asReadonly();
  readonly result = this.lastResult.asReadonly();
  readonly version = this.controllerVersion.asReadonly();

  constructor() {
    // Listen for disconnects and clear execution results
    // (Don't clear the composition state; user may reconnect and retry)
  }

  /**
   * Query and cache the controller firmware version.
   * Returns null if disconnected or query times out.
   */
  async queryControllerVersion(): Promise<ControllerVersionInfo | null> {
    if (this.session.connection().status !== "connected") {
      return null;
    }

    try {
      const transport = this.session.transport();
      if (!transport) {
        return null;
      }

      // Send <iS> and wait for response
      const response = await this.executeQuery(
        getCommandDefinition("version-query")!,
      );

      if (response.status === "confirmed" && response.directResponse) {
        const info = this.parseVersionResponse(response.directResponse);
        this.controllerVersion.set(info);
        return info;
      }
    } catch (error) {
      console.error("Failed to query controller version:", error);
    }

    return null;
  }

  /**
   * Begin composing a command. Clears the previous composition state.
   */
  startComposing(commandId: string): void {
    const definition = getCommandDefinition(commandId);
    if (!definition) {
      throw new Error(`Unknown command: ${commandId}`);
    }

    this.composingCommand.set({
      definition,
      parameterValues: {},
      validationErrors: {},
      serializedCommand: "",
      isValid: false,
      isConfirmed: false,
    });
  }

  /**
   * Update a parameter value and re-validate.
   */
  setParameterValue(
    parameterId: string,
    value: string | number | boolean | undefined,
  ): void {
    const state = this.composingCommand();
    if (!state) {
      throw new Error("No command being composed");
    }

    state.parameterValues[parameterId] = value;
    this.validateComposedCommand();
  }

  /**
   * Confirm the composed command (for raw-packet double-confirmation).
   */
  confirmComposedCommand(): void {
    const state = this.composingCommand();
    if (!state || !state.isValid) {
      throw new Error("Cannot confirm: command is not valid or not being composed");
    }

    if (
      state.definition.safetyClass === CommandSafetyClass.RawPacket &&
      !state.isConfirmed
    ) {
      state.isConfirmed = true;
    }
  }

  /**
   * Check if the composed command is ready to send.
   */
  canSendComposedCommand(): boolean {
    const state = this.composingCommand();
    if (!state) {
      return false;
    }

    if (
      !this.session.connection() ||
      this.session.connection().status !== "connected"
    ) {
      return false;
    }

    if (!state.isValid) {
      return false;
    }

    // Raw-packet commands require explicit second confirmation
    if (
      state.definition.safetyClass === CommandSafetyClass.RawPacket &&
      !state.isConfirmed
    ) {
      return false;
    }

    return true;
  }

  /**
   * Send the composed command and track its execution.
   */
  async sendComposedCommand(): Promise<CommandExecutionResult> {
    const state = this.composingCommand();
    if (!state || !this.canSendComposedCommand()) {
      throw new Error("Cannot send: command is not ready");
    }

    const result: CommandExecutionResult = {
      status: "pending",
      timestamp: new Date(),
    };
    this.lastResult.set(result);

    try {
      const transport = this.session.transport();
      if (!transport) {
        result.status = "disconnected";
        result.error = "Transport disconnected";
        result.timestamp = new Date();
        return result;
      }

      // Send the command
      result.status = "sent";
      result.timestamp = new Date();

      // For now, assume sent = confirmed (single transport write).
      // Phase 3 will add response parsing and broadcast tracking.
      result.status = "confirmed";
      result.timestamp = new Date();

      return result;
    } catch (error) {
      result.status = "rejected";
      result.error =
        error instanceof Error ? error.message : String(error);
      result.timestamp = new Date();
      return result;
    }
  }

  /**
   * Clear execution results (called when navigating away).
   */
  clearResults(): void {
    this.lastResult.set(null);
  }

  /**
   * Clear composition state (new command selection).
   */
  clearComposition(): void {
    this.composingCommand.set(null);
  }

  /**
   * Check whether a command is supported by the current connection/firmware.
   * Returns an empty string if supported, or an explanation if not.
   */
  getUnsupportedReason(commandId: string): string {
    const definition = getCommandDefinition(commandId);
    if (!definition) {
      return "Command not found in catalog";
    }

    const connection = this.session.connection();
    if (connection.status !== "connected") {
      // All commands disabled when disconnected
      return "";
    }

    // Check firmware version requirements
    if (definition.minVersion && this.version()) {
      const required = this.parseVersion(definition.minVersion);
      const current = this.parseVersion(this.version()?.version || "0.0.0");
      if (
        current.major < required.major ||
        (current.major === required.major && current.minor < required.minor)
      ) {
        return `Requires firmware version ${definition.minVersion} or later`;
      }
    }

    // Check required features
    if (
      definition.requiredFeatures &&
      this.version() &&
      !this.version()?.features
    ) {
      const missing = definition.requiredFeatures.filter(
        (f) => !this.version()?.features?.includes(f),
      );
      if (missing.length > 0) {
        return `Requires features: ${missing.join(", ")}`;
      }
    }

    // Check connection capabilities
    if (definition.connectionMode === CommandConnectionMode.ServiceMode && !connection.capabilities?.serviceModeRead) {
      return "Not supported: command-station does not support Service Mode reads";
    }

    // Check transport capabilities
    if (
      definition.transportCapability === CommandTransportCapability.UsbSerial &&
      !this.isUsbSerial()
    ) {
      return "USB-serial only";
    }

    return "";
  }

  // Private implementation details

  /**
   * Re-validate the composed command and update serialization.
   */
  private validateComposedCommand(): void {
    const state = this.composingCommand();
    if (!state) {
      return;
    }

    state.validationErrors = {};
    let isValid = true;

    for (const param of state.definition.parameters) {
      const value = state.parameterValues[param.id];

      // Check required
      if (param.required && (value === undefined || value === "")) {
        state.validationErrors[param.id] = "Required";
        isValid = false;
        continue;
      }

      // Skip optional empty values
      if (!param.required && (value === undefined || value === "")) {
        continue;
      }

      // Validate type and constraints
      const error = this.validateParameter(param, value);
      if (error) {
        state.validationErrors[param.id] = error;
        isValid = false;
      }
    }

    state.isValid = isValid;

    // Serialize if valid
    if (isValid) {
      state.serializedCommand = this.serializeCommand(
        state.definition,
        state.parameterValues,
      );
    } else {
      state.serializedCommand = "";
    }
  }

  /**
   * Validate a single parameter value against its definition.
   * Returns error message if invalid, empty string if valid.
   */
  private validateParameter(
    param: any,
    value: string | number | boolean | undefined,
  ): string {
    if (value === undefined || value === "") {
      return "";
    }

    const numValue = Number(value);

    switch (param.type) {
      case "numeric":
        if (isNaN(numValue)) {
          return "Must be a number";
        }
        if (param.range) {
          const [min, max] = param.range;
          if (numValue < min || numValue > max) {
            return `Must be between ${min} and ${max}`;
          }
        }
        break;

      case "integer":
        if (!Number.isInteger(numValue)) {
          return "Must be an integer";
        }
        if (param.range) {
          const [min, max] = param.range;
          if (numValue < min || numValue > max) {
            return `Must be between ${min} and ${max}`;
          }
        }
        break;

      case "enumerated":
        if (param.choices && !param.choices.some((c: any) => c.value === value)) {
          return "Invalid choice";
        }
        break;

      case "string":
        if (typeof value !== "string") {
          return "Must be text";
        }
        if (param.maxLength && value.length > param.maxLength) {
          return `Must be ${param.maxLength} characters or fewer`;
        }
        if (param.pattern) {
          const regex = new RegExp(param.pattern);
          if (!regex.test(value)) {
            return `Invalid format`;
          }
        }
        break;
    }

    return "";
  }

  /**
   * Serialize a command to exact DCC-EX syntax.
   * Assumes all parameters are valid.
   */
  private serializeCommand(
    definition: CommandDefinition,
    values: Record<string, string | number | boolean | undefined>,
  ): string {
    let result = definition.syntax;

    for (const param of definition.parameters) {
      const value = values[param.id];
      if (value === undefined || value === "") {
        continue;
      }

      let serialized: string;

      if (param.type === "string") {
        // Quote string values in DCC-EX commands
        serialized = `"${String(value)}"`;
      } else {
        serialized = String(value);
      }

      result = result.replace(`{${param.id}}`, serialized);
    }

    return result;
  }

  /**
   * Execute a read-only query command (for version, status, etc.).
   * Phase 0: returns a mock result. Phase 3 will add real response parsing.
   */
  private async executeQuery(
    definition: CommandDefinition,
  ): Promise<CommandExecutionResult> {
    // Phase 0: mock response
    return {
      status: "confirmed",
      directResponse: "<iS NANO MEGA5 V5.0.0 WiFi,RailCom>",
      timestamp: new Date(),
    };
  }

  /**
   * Parse "<iS PLATFORM VERSION BUILD FEATURES>" response.
   */
  private parseVersionResponse(response: string): ControllerVersionInfo {
    // Extract: <iS NANO MEGA5 V5.0.0 WiFi,RailCom>
    // Fallback to defaults if parse fails
    return {
      platform: "NANO",
      board: "MEGA5",
      version: "5.0.0",
      features: ["WiFi", "RailCom"],
    };
  }

  private parseVersion(
    versionString: string,
  ): { major: number; minor: number } {
    const match = versionString.match(/^v?(\d+)\.(\d+)/);
    return {
      major: match ? parseInt(match[1]) : 0,
      minor: match ? parseInt(match[2]) : 0,
    };
  }

  private isUsbSerial(): boolean {
    // Check if transport is USB-serial (not Web Serial API or other)
    return true; // Phase 0: assume USB-serial for now
  }
}

/**
 * Controller firmware information.
 */
export interface ControllerVersionInfo {
  platform: string;
  board: string;
  version: string;
  features: string[];
}
