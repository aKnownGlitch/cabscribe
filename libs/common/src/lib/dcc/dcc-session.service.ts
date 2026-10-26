import { inject, Injectable, signal } from '@angular/core';
import {
  DCC_TRANSPORT,
  DccTransportError,
  SerialLogMessage,
  SerialPortInfo,
} from './dcc-transport';

const MAX_SERIAL_LOG_LINES = 1000;

export type ConnectionState =
  | { status: 'scanning' | 'connecting' }
  | { status: 'disconnected' }
  | {
      status: 'connected';
      port: SerialPortInfo;
      capabilities: {
        serviceModeRead: boolean;
        serviceModeWrite: boolean;
      };
      message?: string;
    }
  | { status: 'unavailable' | 'error'; message: string };

export type OperationState =
  | { kind: 'idle' }
  | { kind: 'reading'; address: number; cv: number }
  | { kind: 'read-success'; address: number; cv: number; value: number }
  | { kind: 'read-failure'; address: number; cv: number; message: string }
  | { kind: 'writing'; address: number; cv: number; value: number }
  | { kind: 'verifying'; address: number; cv: number; value: number }
  | { kind: 'write-verified'; address: number; cv: number; value: number }
  | {
      kind: 'write-mismatch';
      address: number;
      cv: number;
      requestedValue: number;
      readBackValue: number;
    }
  | {
      kind: 'write-unverified';
      address: number;
      cv: number;
      value: number;
      message: string;
    }
  | {
      kind: 'write-failure';
      address: number;
      cv: number;
      value: number;
      message: string;
    }
  | {
      kind: 'write-unknown';
      address: number;
      cv: number;
      value: number;
      message: string;
    };

@Injectable()
export class DccSessionService {
  private readonly transport = inject(DCC_TRANSPORT);

  readonly ports = signal<SerialPortInfo[]>([]);
  readonly serialLog = signal<SerialLogMessage[]>([]);
  readonly connection = signal<ConnectionState>({
    status: 'unavailable',
    message: 'Serial communication is not configured in this build.',
  });
  readonly operation = signal<OperationState>({ kind: 'idle' });
  readonly canRequestPort = typeof this.transport.requestPort === 'function';

  constructor() {
    this.transport.onDisconnected?.((message) =>
      this.handleConnectionLost(message)
    );
    this.transport.onSerialMessage?.((message) => {
      this.serialLog.update((entries) =>
        [...entries, message].slice(-MAX_SERIAL_LOG_LINES)
      );
    });
  }

  async discoverPorts(): Promise<void> {
    this.connection.set({ status: 'scanning' });

    try {
      this.ports.set(await this.transport.listPorts());
      this.connection.set({ status: 'disconnected' });
    } catch (error) {
      this.ports.set([]);
      this.connection.set(this.connectionFailure(error));
    }
  }

  async requestPort(): Promise<SerialPortInfo | null> {
    if (!this.transport.requestPort) {
      return null;
    }
    this.connection.set({ status: 'scanning' });
    try {
      const port = await this.transport.requestPort();
      if (port) {
        this.ports.update((ports) => [
          ...ports.filter((candidate) => candidate.id !== port.id),
          port,
        ]);
      }
      this.connection.set({ status: 'disconnected' });
      return port;
    } catch (error) {
      this.connection.set(this.connectionFailure(error));
      return null;
    }
  }

  async connect(portId: string): Promise<void> {
    const port = this.ports().find((candidate) => candidate.id === portId);
    if (!port) {
      this.connection.set({
        status: 'error',
        message: 'Select an available serial port before connecting.',
      });
      return;
    }

    this.connection.set({ status: 'connecting' });
    try {
      const connectionInfo = await this.transport.connect(portId);
      this.connection.set({
        status: 'connected',
        port,
        ...connectionInfo,
      });
    } catch (error) {
      this.connection.set(this.connectionFailure(error));
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.transport.disconnect();
      this.operation.set({ kind: 'idle' });
      this.connection.set({ status: 'disconnected' });
    } catch (error) {
      this.connection.set(this.connectionFailure(error));
    }
  }

  async readCv(address: number, cv: number): Promise<void> {
    const connection = this.connection();
    if (connection.status !== 'connected') {
      this.operation.set({
        kind: 'read-failure',
        address,
        cv,
        message: 'Connect to a command station before reading a CV.',
      });
      return;
    }
    if (!connection.capabilities.serviceModeRead) {
      this.operation.set({
        kind: 'read-failure',
        address,
        cv,
        message: 'Service Mode CV reading is not available on this connection.',
      });
      return;
    }

    this.operation.set({ kind: 'reading', address, cv });
    try {
      const value = await this.transport.readCv(address, cv);
      this.operation.set({ kind: 'read-success', address, cv, value });
    } catch (error) {
      this.operation.set({
        kind: 'read-failure',
        address,
        cv,
        message: this.errorMessage(error, 'The CV could not be read.'),
      });
    }
  }

  async writeCv(address: number, cv: number, value: number): Promise<void> {
    const connection = this.connection();
    if (connection.status !== 'connected') {
      this.operation.set({
        kind: 'write-failure',
        address,
        cv,
        value,
        message: 'Connect to a command station before writing a CV.',
      });
      return;
    }
    if (!connection.capabilities.serviceModeRead || !connection.capabilities.serviceModeWrite) {
      this.operation.set({
        kind: 'write-failure',
        address,
        cv,
        value,
        message:
          'Service Mode CV writing and read-back are not available on this connection.',
      });
      return;
    }

    this.operation.set({ kind: 'writing', address, cv, value });
    try {
      await this.transport.writeCv(address, cv, value);
    } catch (error) {
      const message = this.errorMessage(error, 'The CV write failed.');
      this.operation.set({
        kind:
          error instanceof DccTransportError && error.writeOutcomeUnknown
            ? 'write-unknown'
            : 'write-failure',
        address,
        cv,
        value,
        message,
      });
      return;
    }

    this.operation.set({ kind: 'verifying', address, cv, value });
    try {
      const readBackValue = await this.transport.readCv(address, cv);
      this.operation.set(
        readBackValue === value
          ? { kind: 'write-verified', address, cv, value }
          : {
              kind: 'write-mismatch',
              address,
              cv,
              requestedValue: value,
              readBackValue,
            }
      );
    } catch (error) {
      this.operation.set({
        kind: 'write-unverified',
        address,
        cv,
        value,
        message: this.errorMessage(
          error,
          'The write was sent, but read-back could not verify it.'
        ),
      });
    }
  }

  private connectionFailure(error: unknown): ConnectionState {
    const message = this.errorMessage(error, 'The serial connection failed.');
    return {
      status:
        error instanceof DccTransportError && error.code === 'unavailable'
          ? 'unavailable'
          : 'error',
      message,
    };
  }

  private handleConnectionLost(message: string): void {
    const currentOperation = this.operation();
    if (currentOperation.kind === 'writing' || currentOperation.kind === 'verifying') {
      this.operation.set({
        kind: 'write-unknown',
        address: currentOperation.address,
        cv: currentOperation.cv,
        value: currentOperation.value,
        message,
      });
    } else if (currentOperation.kind === 'reading') {
      this.operation.set({
        kind: 'read-failure',
        address: currentOperation.address,
        cv: currentOperation.cv,
        message,
      });
    }

    this.connection.set({ status: 'error', message });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }
}
