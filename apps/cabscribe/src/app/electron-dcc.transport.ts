import {
  DccConnectionInfo,
  DccTransport,
  SerialLogMessage,
  SerialPortInfo,
  UnavailableDccTransport,
} from 'common';

export interface CabscribeDesktopBridge {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(portId: string): Promise<DccConnectionInfo>;
  disconnect(): Promise<void>;
  readCv(address: number, cv: number): Promise<number>;
  writeCv(address: number, cv: number, value: number): Promise<void>;
  onDisconnected(listener: (message: string) => void): () => void;
  onSerialMessage(listener: (message: SerialLogMessage) => void): () => void;
}

declare global {
  interface Window {
    cabscribeDesktop?: CabscribeDesktopBridge;
  }
}

export class ElectronDccTransport implements DccTransport {
  constructor(private readonly bridge: CabscribeDesktopBridge) {}

  listPorts(): Promise<SerialPortInfo[]> {
    return this.bridge.listPorts();
  }

  connect(portId: string): Promise<DccConnectionInfo> {
    return this.bridge.connect(portId);
  }

  disconnect(): Promise<void> {
    return this.bridge.disconnect();
  }

  readCv(address: number, cv: number): Promise<number> {
    return this.bridge.readCv(address, cv);
  }

  writeCv(address: number, cv: number, value: number): Promise<void> {
    return this.bridge.writeCv(address, cv, value);
  }

  onDisconnected(listener: (message: string) => void): () => void {
    return this.bridge.onDisconnected(listener);
  }

  onSerialMessage(listener: (message: SerialLogMessage) => void): () => void {
    return this.bridge.onSerialMessage(listener);
  }
}

export function createDccTransport(): DccTransport {
  if (typeof window !== 'undefined' && window.cabscribeDesktop) {
    return new ElectronDccTransport(window.cabscribeDesktop);
  }

  return new UnavailableDccTransport();
}
