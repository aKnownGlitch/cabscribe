import {
  DccConnectionInfo,
  DccTransport,
  DccTransportError,
  SerialLogMessage,
  SerialPortInfo,
  UnavailableDccTransport,
} from "common";
import {
  BrowserSerial,
  WebSerialDccTransport,
} from "./web-serial-dcc.transport";
import { DccExCvReader } from "./dcc-ex-cv-reader";

export interface CabscribeDesktopBridge {
  requestLocomotiveAddress(): Promise<void>;
  listPorts(): Promise<SerialPortInfo[]>;
  connect(portId: string): Promise<DccConnectionInfo>;
  disconnect(): Promise<void>;
  readCv(cv: number): Promise<void>;
  writeCv(address: number, cv: number, value: number): Promise<void>;
  sendRawCommand?(command: string): Promise<void>;
  onDisconnected(listener: (message: string) => void): () => void;
  onSerialMessage(listener: (message: SerialLogMessage) => void): () => void;
}

declare global {
  interface Window {
    cabscribeDesktop?: CabscribeDesktopBridge;
  }
}

export class ElectronDccTransport implements DccTransport {
  private readonly cvReader = new DccExCvReader(
    (cv) => this.bridge.readCv(cv),
    (listener) => this.bridge.onSerialMessage(listener),
    (listener) => this.bridge.onDisconnected(listener),
  );
  constructor(private readonly bridge: CabscribeDesktopBridge) {}

  requestLocomotiveAddress(): Promise<void> {
    return this.bridge.requestLocomotiveAddress();
  }

  listPorts(): Promise<SerialPortInfo[]> {
    return this.bridge.listPorts();
  }

  async connect(portId: string): Promise<DccConnectionInfo> {
    const connection = await this.bridge.connect(portId);
    this.cvReader.reset();
    return connection;
  }

  disconnect(): Promise<void> {
    this.cvReader.disconnect();
    return this.bridge.disconnect();
  }

  readCv(address: number, cv: number): Promise<number> {
    if (!Number.isSafeInteger(address) || address < 1) {
      return Promise.reject(
        new DccTransportError(
          "rejected",
          "Enter a positive whole-number target address.",
        ),
      );
    }
    return this.cvReader.read(cv);
  }

  writeCv(address: number, cv: number, value: number): Promise<void> {
    return this.bridge.writeCv(address, cv, value);
  }

  sendRawCommand(command: string): Promise<void> {
    if (this.bridge.sendRawCommand) {
      return this.bridge.sendRawCommand(command);
    }
    return Promise.reject(new Error("sendRawCommand is not available"));
  }

  onDisconnected(listener: (message: string) => void): () => void {
    return this.bridge.onDisconnected(listener);
  }

  onSerialMessage(listener: (message: SerialLogMessage) => void): () => void {
    return this.bridge.onSerialMessage(listener);
  }
}

export function createDccTransport(): DccTransport {
  if (typeof window !== "undefined" && window.cabscribeDesktop) {
    return new ElectronDccTransport(window.cabscribeDesktop);
  }

  if (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serial" in navigator
  ) {
    return new WebSerialDccTransport(navigator.serial as BrowserSerial);
  }

  return new UnavailableDccTransport(
    "Browser serial access requires a Web Serial-capable Chromium browser on HTTPS or localhost. Check browser permissions and the serial Permissions Policy.",
  );
}
