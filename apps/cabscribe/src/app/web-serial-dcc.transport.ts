import {
  DccConnectionInfo,
  DccTransport,
  DccTransportError,
  SerialLogMessage,
  SerialPortInfo,
} from 'common';

// Web Serial is not included in TypeScript's standard DOM declarations.
export interface BrowserSerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserSerial {
  getPorts(): Promise<BrowserSerialPort[]>;
  requestPort(): Promise<BrowserSerialPort>;
}

export class WebSerialDccTransport implements DccTransport {
  private readonly ports = new Map<string, BrowserSerialPort>();
  private activePort?: BrowserSerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private readTask?: Promise<void>;
  private cleanupFailure?: string;
  private closing = false;
  private readonly disconnectListeners = new Set<(message: string) => void>();
  private readonly serialListeners = new Set<(message: SerialLogMessage) => void>();

  constructor(private readonly serial: BrowserSerial) {}

  async listPorts(): Promise<SerialPortInfo[]> {
    try {
      const ports = await this.serial.getPorts();
      return ports.map((port) => this.describePort(port));
    } catch (error) {
      throw this.connectionError(error);
    }
  }

  async requestPort(): Promise<SerialPortInfo | null> {
    try {
      // Keep this call before any await: the chooser requires a user gesture.
      return this.describePort(await this.serial.requestPort());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw this.connectionError(error);
    }
  }

  async connect(portId: string): Promise<DccConnectionInfo> {
    if (this.activePort) {
      throw new DccTransportError('rejected', 'Disconnect before opening another serial port.');
    }
    const port = this.ports.get(portId);
    if (!port) {
      throw new DccTransportError('not-connected', 'Choose an authorized serial port first.');
    }
    try {
      await port.open({ baudRate: 115200 });
    } catch (error) {
      throw this.connectionError(error);
    }
    this.activePort = port;
    this.closing = false;
    this.cleanupFailure = undefined;
    this.readTask = this.readSerial(port);
    return {
      capabilities: { serviceModeRead: false, serviceModeWrite: false },
      message:
        'The serial port is open at 115200 baud. DCC-EX readiness and Service Mode commands are not enabled yet.',
    };
  }

  async disconnect(): Promise<void> {
    if (!this.activePort) {
      return;
    }
    this.closing = true;
    try {
      await this.reader?.cancel();
      await this.readTask;
      if (this.cleanupFailure) {
        throw new DccTransportError('disconnected', this.cleanupFailure);
      }
    } catch (error) {
      throw this.connectionError(error);
    }
  }

  async readCv(): Promise<number> {
    throw new DccTransportError(
      'unsupported',
      'DCC-EX Service Mode CV reading is not implemented; no command was sent.'
    );
  }

  async writeCv(): Promise<void> {
    throw new DccTransportError(
      'unsupported',
      'DCC-EX Service Mode CV writing is not implemented; no command was sent.'
    );
  }

  onDisconnected(listener: (message: string) => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  onSerialMessage(listener: (message: SerialLogMessage) => void): () => void {
    this.serialListeners.add(listener);
    return () => this.serialListeners.delete(listener);
  }

  private describePort(port: BrowserSerialPort): SerialPortInfo {
    let id = [...this.ports].find(([, candidate]) => candidate === port)?.[0];
    if (!id) {
      // Browsers expose no unique hardware identity; never guess from USB IDs.
      id = `web-serial:${crypto.randomUUID()}`;
      this.ports.set(id, port);
    }
    const info = port.getInfo();
    const usb = info.usbVendorId === undefined
      ? ''
      : ` (USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)})`;
    const index = [...this.ports.keys()].indexOf(id) + 1;
    return { id, label: `Serial port ${index}${usb}` };
  }

  private async readSerial(port: BrowserSerialPort): Promise<void> {
    let failure = 'The serial device disconnected.';
    try {
      if (!port.readable) {
        throw new Error('The serial port has no readable stream.');
      }
      const reader = port.readable.getReader();
      this.reader = reader;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          const message = done ? decoder.decode() : decoder.decode(value, { stream: true });
          if (message) {
            for (const listener of this.serialListeners) {
              listener({ direction: 'incoming', message });
            }
          }
          if (done) {
            break;
          }
        }
      } finally {
        reader.releaseLock();
        this.reader = undefined;
      }
    } catch (error) {
      failure = `Serial connection lost: ${this.connectionError(error).message}`;
    }
    try {
      await port.close();
    } catch (error) {
      failure = `Could not close the serial port: ${this.connectionError(error).message}`;
      this.cleanupFailure = failure;
    } finally {
      this.activePort = undefined;
    }
    if (!this.closing) {
      for (const listener of this.disconnectListeners) {
        listener(failure);
      }
    }
  }

  private connectionError(error: unknown): DccTransportError {
    return new DccTransportError(
      error instanceof DOMException && error.name === 'SecurityError'
        ? 'permission-denied'
        : 'rejected',
      error instanceof Error || error instanceof DOMException
        ? error.message
        : 'The browser serial connection failed.'
    );
  }
}
