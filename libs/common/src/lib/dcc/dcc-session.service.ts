import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  DCC_TRANSPORT,
  DccTransportError,
  SerialLogMessage,
  SerialPortInfo,
} from './dcc-transport';

const MAX_SERIAL_LOG_LINES = 1000;
const ADDRESS_CONFIRMATION_TIMEOUT_MS = 15000;

export type AddressConfirmationState =
  | { status: 'idle' }
  | { status: 'confirming'; address: number }
  | { status: 'confirmed' | 'error'; address: number; message: string };

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
  readonly canConfirmAddress =
    typeof this.transport.requestLocomotiveAddress === 'function' &&
    typeof this.transport.onSerialMessage === 'function';
  readonly addressConfirmation = signal<AddressConfirmationState>({ status: 'idle' });
  private addressResponse?: {
    resolve: (address: number) => void;
    reject: (error: Error) => void;
  };
  private addressFrame = '';
  private confirmationNeedsReconnect = false;

  constructor() {
    const removeDisconnectListener = this.transport.onDisconnected?.((message) =>
      this.handleConnectionLost(message)
    );
    const removeSerialListener = this.transport.onSerialMessage?.((message) => {
      this.serialLog.update((entries) =>
        [...entries, message].slice(-MAX_SERIAL_LOG_LINES)
      );
      if (message.direction === 'incoming') {
        this.receiveAddressResponse(message.message);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      removeDisconnectListener?.();
      removeSerialListener?.();
      this.addressResponse?.reject(new Error('Address confirmation cancelled.'));
    });
  }

  async confirmAddress(address: number): Promise<void> {
    if (this.addressConfirmation().status === 'confirming') {
      return;
    }
    const fail = (message: string) =>
      this.addressConfirmation.set({ status: 'error', address, message });
    if (!Number.isSafeInteger(address) || address < 1 || address > 10293) {
      fail('Enter a locomotive address from 1 to 10293.');
      return;
    }
    if (this.connection().status !== 'connected') {
      fail('Connect to a command station before confirming an address.');
      return;
    }
    if (!this.transport.requestLocomotiveAddress || !this.canConfirmAddress) {
      fail('Address confirmation is not available on this connection.');
      return;
    }
    if (['reading', 'writing', 'verifying'].includes(this.operation().kind)) {
      fail('Wait for the current CV operation to finish.');
      return;
    }
    if (this.confirmationNeedsReconnect) {
      fail('Reconnect before retrying confirmation to avoid using a delayed response.');
      return;
    }
    this.addressFrame = '';
    this.addressConfirmation.set({ status: 'confirming', address });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const response = new Promise<number>((resolve, reject) => {
      this.addressResponse = { resolve, reject };
      timer = setTimeout(() => reject(new DccTransportError(
        'timeout', 'Address confirmation timed out. Check the programming track and reconnect before retrying.'
      )), ADDRESS_CONFIRMATION_TIMEOUT_MS);
    });
    try {
      // Register the response listener before sending; replies may arrive immediately.
      const [, actualAddress] = await Promise.all([
        this.transport.requestLocomotiveAddress(),
        response,
      ]);
      if (actualAddress !== address) {
        fail(`Address mismatch: entered ${address}, decoder reported ${actualAddress}.`);
      } else {
        this.addressConfirmation.set({
          status: 'confirmed', address,
          message: `Address ${address} confirmed. Command station and decoder responded.`,
        });
      }
    } catch (error) {
      this.confirmationNeedsReconnect = true;
      fail(this.errorMessage(error, 'Address confirmation failed. Reconnect before retrying.'));
    } finally {
      clearTimeout(timer);
      this.addressResponse = undefined;
      this.addressFrame = '';
    }
  }

  private receiveAddressResponse(chunk: string): void {
    if (!this.addressResponse) {
      return;
    }
    for (const character of chunk) {
      if (character === '<') {
        this.addressFrame = '<';
      } else if (this.addressFrame) {
        this.addressFrame += character;
        if (character === '>') {
          const frame = this.addressFrame;
          this.addressFrame = '';
          if (!/^<r\s+LOCOID(?:\s|>)/.test(frame)) {
            continue;
          }
          const match = /^<r\s+LOCOID\s+(-?\d+)\s*>$/.exec(frame);
          const address = match ? Number(match[1]) : NaN;
          if (!Number.isSafeInteger(address) || address < 1 || address > 10293) {
            this.addressResponse.reject(new DccTransportError(
              'invalid-response',
              address === -1
                ? 'The decoder did not acknowledge the address read. Check the locomotive and programming track.'
                : 'The command station returned an invalid locomotive address.',
            ));
          } else {
            this.addressResponse.resolve(address);
          }
          return;
        }
        if (this.addressFrame.length > 128) {
          this.addressFrame = '';
        }
      }
    }
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
      this.confirmationNeedsReconnect = false;
      this.addressConfirmation.set({ status: 'idle' });
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
    this.addressResponse?.reject(new Error('Disconnected during address confirmation.'));
    try {
      await this.transport.disconnect();
      this.operation.set({ kind: 'idle' });
      this.connection.set({ status: 'disconnected' });
      if (this.addressConfirmation().status !== 'confirming') {
        this.addressConfirmation.set({ status: 'idle' });
      }
    } catch (error) {
      this.connection.set(this.connectionFailure(error));
    }
  }

  async readCv(address: number, cv: number): Promise<void> {
    if (this.addressConfirmation().status === 'confirming') {
      this.operation.set({ kind: 'read-failure', address, cv, message: 'Wait for address confirmation to finish.' });
      return;
    }
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
    if (this.addressConfirmation().status === 'confirming') {
      this.operation.set({ kind: 'write-failure', address, cv, value, message: 'Wait for address confirmation to finish.' });
      return;
    }
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
    this.addressResponse?.reject(new Error(message));
    const confirmation = this.addressConfirmation();
    if (confirmation.status === 'confirmed') {
      this.addressConfirmation.set({ status: 'error', address: confirmation.address, message });
    }
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
