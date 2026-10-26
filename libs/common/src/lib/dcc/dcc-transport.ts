import { InjectionToken } from '@angular/core';

export interface SerialPortInfo {
  id: string;
  label: string;
}

export interface DccConnectionInfo {
  capabilities: {
    serviceModeRead: boolean;
    serviceModeWrite: boolean;
  };
  message?: string;
}

export interface SerialLogMessage {
  direction: 'outgoing' | 'incoming';
  message: string;
}

export type DccTransportErrorCode =
  | 'unavailable'
  | 'permission-denied'
  | 'not-connected'
  | 'unsupported'
  | 'timeout'
  | 'disconnected'
  | 'rejected'
  | 'invalid-response';

export class DccTransportError extends Error {
  constructor(
    readonly code: DccTransportErrorCode,
    message: string,
    readonly writeOutcomeUnknown = false
  ) {
    super(message);
    this.name = 'DccTransportError';
  }
}

export interface DccTransport {
  requestPort?(): Promise<SerialPortInfo | null>;
  listPorts(): Promise<SerialPortInfo[]>;
  connect(portId: string): Promise<DccConnectionInfo>;
  disconnect(): Promise<void>;
  readCv(address: number, cv: number): Promise<number>;
  writeCv(address: number, cv: number, value: number): Promise<void>;
  onDisconnected?(listener: (message: string) => void): () => void;
  onSerialMessage?(listener: (message: SerialLogMessage) => void): () => void;
}

export const DCC_TRANSPORT = new InjectionToken<DccTransport>('DCC_TRANSPORT');

export class UnavailableDccTransport implements DccTransport {
  constructor(
    private readonly message = 'Serial communication is not configured in this build.'
  ) {}

  private unavailable(): DccTransportError {
    return new DccTransportError(
      'unavailable',
      this.message
    );
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    throw this.unavailable();
  }

  async connect(): Promise<DccConnectionInfo> {
    throw this.unavailable();
  }

  async disconnect(): Promise<void> {
    throw this.unavailable();
  }

  async readCv(): Promise<number> {
    throw this.unavailable();
  }

  async writeCv(): Promise<void> {
    throw this.unavailable();
  }
}
