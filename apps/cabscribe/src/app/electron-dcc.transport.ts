import {
  DccConnectionInfo,
  DccTransport,
  SerialLogMessage,
  SerialPortInfo,
  UnavailableDccTransport,
} from 'common';
import { BrowserSerial, WebSerialDccTransport } from './web-serial-dcc.transport';

export interface CabscribeDesktopBridge {
  requestLocomotiveAddress(): Promise<void>;
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

  requestLocomotiveAddress(): Promise<void> {
    return this.bridge.requestLocomotiveAddress();
  }

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

  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serial' in navigator
  ) {
    return new WebSerialDccTransport(navigator.serial as BrowserSerial);
  }

  return new UnavailableDccTransport(
    'Browser serial access requires a Web Serial-capable Chromium browser on HTTPS or localhost. Check browser permissions and the serial Permissions Policy.'
  );
}
