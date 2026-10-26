import { SerialLogMessage } from 'common';
import {
  BrowserSerialPort,
  WebSerialDccTransport,
} from './web-serial-dcc.transport';
import { createDccTransport, ElectronDccTransport } from './electron-dcc.transport';

describe('WebSerialDccTransport', () => {
  function createTransport() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const write = vi.fn().mockResolvedValue(undefined);
    const port: BrowserSerialPort = {
      writable: new WritableStream<Uint8Array>({ write }),
      readable: new ReadableStream<Uint8Array>({
        start: (streamController) => { controller = streamController; },
      }),
      getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const serial = {
      getPorts: vi.fn().mockResolvedValue([port]),
      requestPort: vi.fn().mockResolvedValue(port),
    };
    return { port, serial, controller, write, transport: new WebSerialDccTransport(serial) };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the address read command and logs it after successful transmission', async () => {
    const { transport, port, write } = createTransport();
    const messages: SerialLogMessage[] = [];
    transport.onSerialMessage((message) => messages.push(message));
    await expect(transport.requestLocomotiveAddress()).rejects.toMatchObject({ code: 'not-connected' });
    const [info] = await transport.listPorts();
    await transport.connect(info.id);
    await transport.requestLocomotiveAddress();
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toEqual(new TextEncoder().encode('<R LOCOID>'));
    expect(messages).toEqual([{ direction: 'outgoing', message: '<R LOCOID>' }]);
    expect(port.writable?.locked).toBe(false);
    await transport.disconnect();
  });

  it('surfaces write failure without producing a successful outgoing log', async () => {
    const { transport, port, write } = createTransport();
    const messages: SerialLogMessage[] = [];
    transport.onSerialMessage((message) => messages.push(message));
    write.mockRejectedValueOnce(new Error('Write failed'));
    const [info] = await transport.listPorts();
    await transport.connect(info.id);
    await expect(transport.requestLocomotiveAddress()).rejects.toThrow('Write failed');
    expect(messages).toEqual([]);
    expect(port.writable?.locked).toBe(false);
    await transport.disconnect();
  });

  it('lists authorized ports and retains their identity within a session', async () => {
    const { transport, serial } = createTransport();
    const ports = await transport.listPorts();
    expect(ports).toHaveLength(1);
    expect(await transport.requestPort()).toEqual(ports[0]);
    expect(serial.requestPort).toHaveBeenCalledOnce();
  });

  it('opens at 115200, logs incoming bytes and releases the reader on disconnect', async () => {
    const { transport, port, controller } = createTransport();
    const messages: SerialLogMessage[] = [];
    const disconnected = vi.fn();
    transport.onSerialMessage((message) => messages.push(message));
    transport.onDisconnected(disconnected);
    const [info] = await transport.listPorts();
    const connection = await transport.connect(info.id);
    expect(port.open).toHaveBeenCalledWith({ baudRate: 115200 });
    expect(connection.capabilities).toEqual({
      serviceModeRead: false, serviceModeWrite: false,
    });
    controller.enqueue(new TextEncoder().encode('<iDCC-EX>'));
    await vi.waitFor(() => expect(messages).toEqual([
      { direction: 'incoming', message: '<iDCC-EX>' },
    ]));
    await transport.disconnect();
    expect(port.readable?.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
    expect(disconnected).not.toHaveBeenCalled();
  });

  it('notifies the session when the serial stream fails', async () => {
    const { transport, controller, port } = createTransport();
    const disconnected = vi.fn();
    transport.onDisconnected(disconnected);
    const [info] = await transport.listPorts();
    await transport.connect(info.id);
    controller.error(new Error('Device removed'));
    await vi.waitFor(() => expect(disconnected).toHaveBeenCalledWith(
      'Serial connection lost: Device removed'
    ));
    expect(port.close).toHaveBeenCalledOnce();
  });

  it('reports failed close instead of a successful disconnect', async () => {
    const { transport, port } = createTransport();
    vi.mocked(port.close).mockRejectedValueOnce(new Error('Close failed'));
    const [info] = await transport.listPorts();
    await transport.connect(info.id);
    await expect(transport.disconnect()).rejects.toThrow('Close failed');
    expect(port.readable?.locked).toBe(false);
  });

  it('surfaces open failures without claiming a connection', async () => {
    const { transport, port } = createTransport();
    vi.mocked(port.open).mockRejectedValueOnce(new Error('Port busy'));
    const [info] = await transport.listPorts();
    await expect(transport.connect(info.id)).rejects.toThrow('Port busy');
    expect(port.close).not.toHaveBeenCalled();
  });

  it('treats chooser cancellation as cancellation, and surfaces permission errors', async () => {
    const { transport, serial } = createTransport();
    serial.requestPort.mockRejectedValueOnce(new DOMException('Cancelled', 'NotFoundError'));
    expect(await transport.requestPort()).toBeNull();
    serial.requestPort.mockRejectedValueOnce(new DOMException('Blocked', 'SecurityError'));
    await expect(transport.requestPort()).rejects.toMatchObject({
      code: 'permission-denied', message: 'Blocked',
    });
  });

  it('does not report unsupported CV operations as successful', async () => {
    const { transport } = createTransport();
    await expect(transport.readCv()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(transport.writeCv()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('selects Web Serial only in a secure supported browser and prefers Electron', () => {
    const { serial } = createTransport();
    vi.stubGlobal('navigator', { serial });
    vi.stubGlobal('isSecureContext', true);
    expect(createDccTransport()).toBeInstanceOf(WebSerialDccTransport);
    vi.stubGlobal('isSecureContext', false);
    expect(createDccTransport()).not.toBeInstanceOf(WebSerialDccTransport);
    const bridge = {
      listPorts: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
      readCv: vi.fn(), writeCv: vi.fn(), onDisconnected: vi.fn(),
      onSerialMessage: vi.fn(),
    };
    vi.stubGlobal('cabscribeDesktop', bridge);
    expect(createDccTransport()).toBeInstanceOf(ElectronDccTransport);
  });

  it('routes address confirmation through the fixed Electron bridge method', async () => {
    const bridge = {
      requestLocomotiveAddress: vi.fn().mockResolvedValue(undefined),
      listPorts: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
      readCv: vi.fn(), writeCv: vi.fn(), onDisconnected: vi.fn(),
      onSerialMessage: vi.fn(),
    };
    const transport = new ElectronDccTransport(bridge);
    await transport.requestLocomotiveAddress();
    expect(bridge.requestLocomotiveAddress).toHaveBeenCalledOnce();
    expect(bridge.readCv).not.toHaveBeenCalled();
    expect(bridge.writeCv).not.toHaveBeenCalled();
  });
});
