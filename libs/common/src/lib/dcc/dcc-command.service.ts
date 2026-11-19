import { computed, inject, Injectable, signal } from "@angular/core";
import { CommandDefinition, CommandSafetyClass, getCommandDefinition } from "./command-definitions";
import { CommandParameterValue, CommandParameterValues, previewCommand } from "./command-preview";
import { DccSessionService } from "./dcc-session.service";
import { DccStationStatus } from "./dcc-station-status";
import { DccTransportError } from "./dcc-transport";

export type CommandExecutionResult =
  | { status: "pending"; timestamp: Date }
  | ({ status: "confirmed"; timestamp: Date } & DccStationStatus)
  | { status: "unsupported" | "rejected" | "timeout" | "disconnected" | "invalid-response" | "unknown"; timestamp: Date; error: string };

interface CommandDraft {
  definition: CommandDefinition;
  values: CommandParameterValues;
}

@Injectable({ providedIn: "root" })
export class DccCommandService {
  private readonly session = inject(DccSessionService);
  private readonly draft = signal<CommandDraft | null>(null);
  private readonly lastResult = signal<CommandExecutionResult | null>(null);
  private readonly reviewedPacket = signal<CommandDraft | null>(null);

  readonly composing = computed(() => {
    const draft = this.draft();
    return draft && { ...draft, preview: previewCommand(draft.definition, draft.values) };
  });
  readonly result = this.lastResult.asReadonly();
  readonly rawPacketReviewed = computed(() => {
    const reviewed = this.reviewedPacket();
    return reviewed !== null && reviewed === this.draft();
  });
  readonly executionDisabledReason = computed(() => this.executionBlock()?.message);

  startComposing(commandId: string): void {
    const definition = getCommandDefinition(commandId);
    if (!definition) {
      throw new Error(`Unknown command: ${commandId}`);
    }
    const values = Object.fromEntries(definition.parameters.map(
      ({ id, defaultValue }) => [id, defaultValue],
    ));
    this.clearResults();
    this.reviewedPacket.set(null);
    this.draft.set({ definition, values });
  }

  setParameterValue(parameterId: string, value: CommandParameterValue): void {
    this.draft.update((draft) => {
      if (!draft?.definition.parameters.some(({ id }) => id === parameterId)) {
        throw new Error(`Unexpected command parameter: ${parameterId}`);
      }
      return { ...draft, values: { ...draft.values, [parameterId]: value } };
    });
    this.reviewedPacket.set(null);
    this.clearResults();
  }

  confirmRawPacket(confirmed: boolean): void {
    const draft = this.composing();
    if (confirmed && (!draft || draft.definition.safetyClass !== CommandSafetyClass.RawPacket ||
        draft.preview.kind !== "ready" || !draft.definition.target)) {
      return;
    }
    this.reviewedPacket.set(confirmed ? this.draft() : null);
  }

  canSendComposedCommand(): boolean {
    return !this.executionDisabledReason();
  }

  async sendComposedCommand(): Promise<CommandExecutionResult> {
    const block = this.executionBlock();
    if (block) {
      const result = this.failure(block);
      if (this.result()?.status !== "pending") this.lastResult.set(result);
      return result;
    }

    const pending = { status: "pending", timestamp: new Date() } as const;
    this.lastResult.set(pending);
    let result: CommandExecutionResult;
    try {
      const status = await this.session.readStationStatus();
      result = { ...status, status: "confirmed", timestamp: new Date() };
    } catch (error) {
      result = this.failure(error);
    }
    if (this.result() === pending) this.lastResult.set(result);
    return result;
  }

  private executionBlock(): DccTransportError | undefined {
    const draft = this.composing();
    if (!draft || draft.preview.kind === "invalid" || draft.preview.kind === "unsupported") {
      return new DccTransportError("unsupported", "Select a command and complete its required fields.");
    }
    if (draft.preview.kind !== "ready" ||
        !["status-query", "version-query"].includes(draft.definition.id) ||
        draft.definition.safetyClass !== CommandSafetyClass.ReadOnly ||
        draft.definition.confirmationPolicy === "raw-packet-only" ||
        draft.preview.command !== "<s>") {
      return new DccTransportError("unsupported", "Preview only: this command is not enabled for transmission.");
    }
    return this.session.stationStatusBlock();
  }

  private failure(error: unknown): CommandExecutionResult {
    const code = error instanceof DccTransportError ? error.code : undefined;
    const status = code === "not-connected" ? "disconnected"
      : code === "disconnected" || code === "timeout" || code === "rejected" ||
        code === "unsupported" || code === "invalid-response" ? code
      : "unknown";
    return {
      status,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "The station status query failed.",
    };
  }

  clearResults(): void {
    this.lastResult.set(null);
  }

  clearComposition(): void {
    this.reviewedPacket.set(null);
    this.draft.set(null);
  }
}
