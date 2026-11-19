import { DccTransportError } from "./dcc-transport";

export interface DccTrack {
  id: string;
  mode: string;
}

export class DccTrackListReader {
  private frame = "";
  private readonly tracks = new Map<string, DccTrack>();

  receive(chunk: string): void {
    for (const char of chunk) {
      if (char === "<") {
        this.frame = "<";
      } else if (this.frame) {
        this.frame += char;
        if (char === ">") {
          const frame = this.frame;
          this.frame = "";
          if (frame === "<X>" && !this.tracks.size) {
            throw new DccTransportError("rejected", "The command station rejected the track list query.");
          }
          if (!frame.startsWith("<=")) continue;
          const row = /^<= ([A-Z]) ([A-Z][A-Z0-9_]*(?: [A-Z0-9]+)*|---)>$/.exec(frame);
          if (!row) {
            throw new DccTransportError("invalid-response", "The command station returned a malformed track row.");
          }
          const [, id, mode] = row;
          this.tracks.set(id, { id, mode });
        } else if (this.frame.length >= 512) {
          if (this.frame.startsWith("<=")) {
            throw new DccTransportError("invalid-response", "The track row was too long.");
          }
          this.frame = "";
        }
      }
    }
  }

  result(): readonly DccTrack[] | undefined {
    return this.tracks.size ? [...this.tracks.values()] : undefined;
  }
}
