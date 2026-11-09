import { DccTransportError, SerialLogMessage } from "common";

const READ_TIMEOUT_MS = 15000;

export class DccExCvReader {
  private busy = false;
  private needsReconnect = false;
  private cancelRead?: (message: string) => void;

  constructor(
    private readonly send: (cv: number) => Promise<void>,
    private readonly onMessage: (
      listener: (message: SerialLogMessage) => void,
    ) => () => void,
    private readonly onDisconnect: (
      listener: (message: string) => void,
    ) => () => void,
  ) {}

  reset(): void {
    this.needsReconnect = false;
  }

  disconnect(): void {
    this.cancelRead?.("The serial connection was closed during the CV read.");
  }

  async read(cv: number): Promise<number> {
    if (!Number.isSafeInteger(cv) || cv < 1 || cv > 1024) {
      throw new DccTransportError(
        "rejected",
        "Enter a CV address from 1 to 1024.",
      );
    }
    if (this.busy) {
      throw new DccTransportError(
        "rejected",
        "Wait for the current CV read to finish.",
      );
    }
    if (this.needsReconnect) {
      throw new DccTransportError(
        "rejected",
        "Reconnect before reading another CV to avoid a delayed response.",
      );
    }
    this.busy = true;
    try {
      return await new Promise<number>((resolve, reject) => {
        let frame = "";
        let settled = false;
        const finish = (error?: unknown, value?: number) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          removeMessage();
          removeDisconnect();
          this.cancelRead = undefined;
          if (error) reject(error);
          else resolve(value as number);
        };
        const removeMessage = this.onMessage((entry) => {
          if (entry.direction !== "incoming") return;
          for (const character of entry.message) {
            if (character === "<") frame = "<";
            else if (frame) {
              frame += character;
              if (character === ">") {
                const match = /^<v\s+(\d+)\s+(-?\d+)\s*>$/.exec(frame);
                frame = "";
                if (!match || Number(match[1]) !== cv) continue;
                const value = Number(match[2]);
                if (value === -1) {
                  finish(
                    new DccTransportError(
                      "rejected",
                      `CV ${cv} could not be read. Check the decoder and programming track.`,
                    ),
                  );
                } else if (
                  !Number.isInteger(value) ||
                  value < 0 ||
                  value > 255
                ) {
                  finish(
                    new DccTransportError(
                      "invalid-response",
                      `The command station returned an invalid value for CV ${cv}.`,
                    ),
                  );
                } else finish(undefined, value);
              } else if (frame.length > 128) frame = "";
            }
          }
        });
        const removeDisconnect = this.onDisconnect((message) =>
          finish(new DccTransportError("disconnected", message)),
        );
        this.cancelRead = (message) =>
          finish(new DccTransportError("disconnected", message));
        const timer = setTimeout(() => {
          this.needsReconnect = true;
          finish(
            new DccTransportError(
              "timeout",
              `CV ${cv} timed out. Check the programming track and reconnect before retrying.`,
            ),
          );
        }, READ_TIMEOUT_MS);
        Promise.resolve()
          .then(() => (settled ? undefined : this.send(cv)))
          .catch((error) => {
            this.needsReconnect = true;
            const message =
              error instanceof Error
                ? error.message
                : "Serial transmission failed.";
            finish(
              new DccTransportError(
                "disconnected",
                `${message} Reconnect before retrying.`,
              ),
            );
          });
      });
    } finally {
      this.busy = false;
    }
  }
}
