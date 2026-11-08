import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { DccSessionService } from "common";

@Component({
  selector: "app-debug-page",
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: "./debug.page.html",
})
export class DebugPage {
  readonly session = inject(DccSessionService);
  readonly commandInput = signal("");
  readonly commandSending = signal(false);
  readonly serialLogText = computed(() =>
    this.session
      .serialLog()
      .map(({ direction, message, timestamp }) => {
        const prefix = direction === "outgoing" ? "CS> " : "DC< ";
        const time = timestamp ? `[${timestamp.toLocaleTimeString()}] ` : "";
        return message
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => `${time}${prefix}${line}`)
          .join("\n");
      })
      .join("\n"),
  );
  readonly isConnected = computed(
    () => this.session.connection().status === "connected",
  );
  private readonly debugOutput =
    viewChild<ElementRef<HTMLTextAreaElement>>("debugOutput");

  constructor() {
    effect(() => {
      this.serialLogText();
      const textarea = this.debugOutput()?.nativeElement;
      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    });
  }

  async sendCommand(): Promise<void> {
    const command = this.commandInput().trim();
    if (!command) {
      return;
    }
    this.commandSending.set(true);
    const timestamp = new Date().toLocaleTimeString();
    try {
      await this.session.sendCommand(command);
      this.commandInput.set("");
      this.session.serialLog.update((entries) => [
        ...entries,
        {
          direction: "outgoing",
          message: `[${timestamp}] User command sent: ${command}`,
        },
      ]);
    } catch (error) {
      console.error("Failed to send command:", error);
      this.session.serialLog.update((entries) => [
        ...entries,
        {
          direction: "incoming",
          message: `[${timestamp}] Error: ${error instanceof Error ? error.message : "Failed to send command"}`,
        },
      ]);
    } finally {
      this.commandSending.set(false);
    }
  }
}
