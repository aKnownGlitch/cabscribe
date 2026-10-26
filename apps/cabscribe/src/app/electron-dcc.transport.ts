import {
  DccConnectionInfo,
  DccTransport,
  SerialPortInfo,
  UnavailableDccTransport,
} from 'common';

export interface CabscribeDesktopBridge {
  listPorts(): Promise<SerialPortInfo[]>;
  connect(portId: string): Promise<DccConnectionInfo>;
  disconnect(): Promise<void>;
  readCv(cv: number): Promise<number>;
  writeCv(cv: number, value: number): Promise<void>;
  onDisconnected(listener: (message: string) => void): () => void;
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

  readCv(cv: number): Promise<number> {
    return this.bridge.readCv(cv);
  }

  writeCv(cv: number, value: number): Promise<void> {
    return this.bridge.writeCv(cv, value);
  }

  onDisconnected(listener: (message: string) => void): () => void {
    return this.bridge.onDisconnected(listener);
  }
}

export function createDccTransport(): DccTransport {
  if (typeof window !== 'undefined' && window.cabscribeDesktop) {
    return new ElectronDccTransport(window.cabscribeDesktop);
  }

  return new UnavailableDccTransport();
}
