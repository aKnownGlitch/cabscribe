import { DccTransportError } from "./dcc-transport";

export interface DccStationStatus {
  identity: { version: string; board: string; shield: string; build: string };
  directResponse: string;
  broadcasts: readonly string[];
}

export class DccStationStatusReader {
  private frame = "";
  private identity?: DccStationStatus["identity"];
  private directResponse = "";
  private readonly broadcasts: string[] = [];

  receive(chunk: string): void {
    for (const char of chunk) {
      if (char === "<") {
        this.frame = "<";
      } else if (this.frame) {
        this.frame += char;
        if (char === ">") {
          const frame = this.frame;
          this.frame = "";
          this.receiveFrame(frame);
        } else if (this.frame.length >= 512) {
          if (this.frame.startsWith("<iDCC-EX")) {
            throw new DccTransportError("invalid-response", "The station identity reply was too long.");
          }
          this.frame = "";
        }
      }
    }
  }

  result(): DccStationStatus | undefined {
    return this.identity && {
      identity: this.identity,
      directResponse: this.directResponse,
      broadcasts: [...this.broadcasts],
    };
  }

  private receiveFrame(frame: string): void {
    if (!this.identity && frame === "<X>") {
      throw new DccTransportError("rejected", "The command station rejected the status query.");
    }
    if (!this.identity && frame.startsWith("<iDCC-EX")) {
      const match = /^<iDCC-EX V-(\d+\.\d+\.\d+(?:[-+][\w.+-]+)?) \/ ([^<>\r\n]+) \/ ([^<>\r\n]+) G-([\w.-]+)>$/.exec(frame);
      if (!match) {
        throw new DccTransportError("invalid-response", "The command station returned a malformed identity reply.");
      }
      const [, version, board, shield, build] = match;
      this.identity = { version, board, shield, build };
      this.directResponse = frame;
    } else if (this.identity && this.broadcasts.length < 100 &&
      /^(?:<p[01](?: [^<>\r\n]+)?>|<H \d+ [01]>|<[Qq] \d+>)$/.test(frame)) {
      this.broadcasts.push(frame);
    }
  }
}
