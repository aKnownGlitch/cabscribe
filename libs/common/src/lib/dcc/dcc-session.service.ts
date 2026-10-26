import { inject, Injectable, signal } from '@angular/core';
import {
  DCC_TRANSPORT,
  DccTransportError,
  SerialPortInfo,
} from './dcc-transport';

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
  | { kind: 'reading'; cv: number }
  | { kind: 'read-success'; cv: number; value: number }
  | { kind: 'read-failure'; cv: number; message: string }
  | { kind: 'writing'; cv: number; value: number }
  | { kind: 'verifying'; cv: number; value: number }
  | { kind: 'write-verified'; cv: number; value: number }
  | {
      kind: 'write-mismatch';
      cv: number;
      requestedValue: number;
      readBackValue: number;
    }
  | { kind: 'write-unverified'; cv: number; value: number; message: string }
  | { kind: 'write-failure'; cv: number; value: number; message: string }
  | { kind: 'write-unknown'; cv: number; value: number; message: string };

@Injectable()
export class DccSessionService {
  private readonly transport = inject(DCC_TRANSPORT);

  readonly ports = signal<SerialPortInfo[]>([]);
  readonly connection = signal<ConnectionState>({
    status: 'unavailable',
    message: 'Serial communication is not configured in this build.',
  });
  readonly operation = signal<OperationState>({ kind: 'idle' });

  constructor() {
    this.transport.onDisconnected?.((message) =>
      this.handleConnectionLost(message)
    );
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

  async readCv(cv: number): Promise<void> {
    const connection = this.connection();
    if (connection.status !== 'connected') {
      this.operation.set({
        kind: 'read-failure',
        cv,
        message: 'Connect to a command station before reading a CV.',
      });
      return;
    }
    if (!connection.capabilities.serviceModeRead) {
      this.operation.set({
        kind: 'read-failure',
        cv,
        message: 'Service Mode CV reading is not available on this connection.',
      });
      return;
    }

    this.operation.set({ kind: 'reading', cv });
    try {
      const value = await this.transport.readCv(cv);
      this.operation.set({ kind: 'read-success', cv, value });
    } catch (error) {
      this.operation.set({
        kind: 'read-failure',
        cv,
        message: this.errorMessage(error, 'The CV could not be read.'),
      });
    }
  }

  async writeCv(cv: number, value: number): Promise<void> {
    const connection = this.connection();
    if (connection.status !== 'connected') {
      this.operation.set({
        kind: 'write-failure',
        cv,
        value,
        message: 'Connect to a command station before writing a CV.',
      });
      return;
    }
    if (!connection.capabilities.serviceModeRead || !connection.capabilities.serviceModeWrite) {
      this.operation.set({
        kind: 'write-failure',
        cv,
        value,
        message:
          'Service Mode CV writing and read-back are not available on this connection.',
      });
      return;
    }

    this.operation.set({ kind: 'writing', cv, value });
    try {
      await this.transport.writeCv(cv, value);
    } catch (error) {
      const message = this.errorMessage(error, 'The CV write failed.');
      this.operation.set({
        kind:
          error instanceof DccTransportError && error.writeOutcomeUnknown
            ? 'write-unknown'
            : 'write-failure',
        cv,
        value,
        message,
      });
      return;
    }

    this.operation.set({ kind: 'verifying', cv, value });
    try {
      const readBackValue = await this.transport.readCv(cv);
      this.operation.set(
        readBackValue === value
          ? { kind: 'write-verified', cv, value }
          : {
              kind: 'write-mismatch',
              cv,
              requestedValue: value,
              readBackValue,
            }
      );
    } catch (error) {
      this.operation.set({
        kind: 'write-unverified',
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
        cv: currentOperation.cv,
        value: currentOperation.value,
        message,
      });
    } else if (currentOperation.kind === 'reading') {
      this.operation.set({
        kind: 'read-failure',
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
