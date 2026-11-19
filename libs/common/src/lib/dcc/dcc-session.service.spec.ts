import { TestBed } from '@angular/core/testing';
import { DccSessionService } from './dcc-session.service';
import { DccCommandService } from './dcc-command.service';
import {
  DCC_TRANSPORT,
  DccTransport,
  DccTransportError,
  SerialLogMessage,
  SerialPortInfo,
} from './dcc-transport';

describe('DccSessionService', () => {
  const port: SerialPortInfo = { id: '/dev/ttyUSB0', label: 'DCC-EX' };

  async function createSession(transportOverrides: Partial<DccTransport> = {}) {
    const transport: DccTransport = {
      listPorts: vi.fn().mockResolvedValue([port]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: true },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn().mockResolvedValue(42),
      writeCv: vi.fn().mockResolvedValue(undefined),
      ...transportOverrides,
    };

    TestBed.configureTestingModule({
      providers: [
        DccSessionService,
        { provide: DCC_TRANSPORT, useValue: transport },
      ],
    });

    const session = TestBed.inject(DccSessionService);
    await session.discoverPorts();
    await session.connect(port.id);
    return { session, transport };
  }

  async function createConfirmableSession(stationStatus = false) {
    let publish!: (message: SerialLogMessage) => void;
    let disconnect!: (message: string) => void;
    const result = await createSession({
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: true, stationStatus },
      }),
      sendRawCommand: vi.fn().mockResolvedValue(undefined),
      requestLocomotiveAddress: vi.fn().mockResolvedValue(undefined),
      onSerialMessage: (listener) => {
        publish = listener;
        return vi.fn();
      },
      onDisconnected: (listener) => {
        disconnect = listener;
        return vi.fn();
      },
    });
    return {
      ...result,
      incoming: (message: string) => publish({ direction: 'incoming', message }),
      disconnect,
    };
  }

  it('previews valid catalog commands without sending on unverified connections', async () => {
    const { transport } = await createConfirmableSession();
    const commands = TestBed.inject(DccCommandService);
    expect(() => commands.startComposing('constructor')).toThrow('Unknown command');
    commands.startComposing('read-cv-service-mode');
    commands.setParameterValue('cv', '29');
    expect(commands.composing()?.preview).toEqual({ kind: 'ready', command: '<R 29>' });
    expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
    commands.setParameterValue('cv', '1025');
    expect(commands.composing()?.preview.kind).toBe('invalid');
    commands.startComposing('status-query');
    expect(commands.result()).toBeNull();
    expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
    expect(transport.sendRawCommand).not.toHaveBeenCalled();
  });

  it('does not send state-changing commands even on a connection approved for status reads', async () => {
    const { transport } = await createConfirmableSession(true);
    const commands = TestBed.inject(DccCommandService);
    commands.startComposing('raw-packet-main');
    commands.confirmRawPacket(true);
    expect(commands.rawPacketReviewed()).toBe(false);
    commands.setParameterValue('d0', '0');
    commands.setParameterValue('d1', '255');
    commands.confirmRawPacket(true);
    expect(commands.rawPacketReviewed()).toBe(true);
    expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
    commands.setParameterValue('d1', '254');
    expect(commands.rawPacketReviewed()).toBe(false);
    commands.confirmRawPacket(true);
    commands.clearComposition();
    expect(commands.rawPacketReviewed()).toBe(false);

    commands.startComposing('main-power-on');
    expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
    commands.startComposing('set-wifi-station');
    commands.setParameterValue('ssid', 'Example network');
    commands.setParameterValue('password', 'example password');
    expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
    expect(transport.sendRawCommand).not.toHaveBeenCalled();
  });

  it('separates fragmented identity and status broadcasts, and holds the shared session lock', async () => {
    vi.useFakeTimers();
    try {
      const { session, transport, incoming } = await createConfirmableSession(true);
      const commands = TestBed.inject(DccCommandService);
      commands.startComposing('version-query');
      const query = commands.sendComposedCommand();
      expect(commands.result()?.status).toBe('pending');
      expect(session.operationInProgress()).toBe(true);
      expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
      await session.readCv(3, 29);
      expect(transport.readCv).not.toHaveBeenCalled();
      incoming('<p0><iDCC-EX V-5.4.');
      incoming('0 / MEGA / STANDARD G-abc123><p1 MAIN><H 4 0><v 29 1>');
      incoming('<Q 7>');
      await vi.advanceTimersByTimeAsync(200);
      expect(await query).toMatchObject({
        status: 'confirmed',
        identity: { version: '5.4.0', board: 'MEGA', shield: 'STANDARD', build: 'abc123' },
        directResponse: '<iDCC-EX V-5.4.0 / MEGA / STANDARD G-abc123>',
        broadcasts: ['<p1 MAIN>', '<H 4 0>', '<Q 7>'],
      });
      expect(transport.sendRawCommand).toHaveBeenCalledExactlyOnceWith('<s>');
      expect(session.operationInProgress()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['<X>', 'rejected'],
    ['<iDCC-EX V-invalid>', 'invalid-response'],
    [undefined, 'disconnected'],
  ] as const)('reports an unsuccessful status query (%s) and unlocks the session', async (reply, status) => {
    const { session, incoming, disconnect } = await createConfirmableSession(true);
    const commands = TestBed.inject(DccCommandService);
    commands.startComposing('status-query');
    const query = commands.sendComposedCommand();
    if (reply) incoming(reply);
    else disconnect('Device removed');
    expect(await query).toMatchObject({ status });
    expect(session.operationInProgress()).toBe(false);
  });

  it('times out a stalled write, blocks late replies, and drops results after leaving the form', async () => {
    vi.useFakeTimers();
    try {
      const { session, transport, incoming } = await createConfirmableSession(true);
      vi.mocked(transport.sendRawCommand!).mockImplementationOnce(() => new Promise(() => undefined));
      const commands = TestBed.inject(DccCommandService);
      commands.startComposing('status-query');
      const query = commands.sendComposedCommand();
      commands.clearComposition();
      commands.clearResults();
      incoming('<iDCC-EX V-5.4.0 / MEGA / STANDARD G-abc123>');
      await vi.advanceTimersByTimeAsync(3000);
      expect(await query).toMatchObject({ status: 'timeout' });
      expect(commands.result()).toBeNull();
      expect(session.operationInProgress()).toBe(false);
      commands.startComposing('status-query');
      expect(commands.executionDisabledReason()).toContain('Reconnect');
      expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
      expect(transport.sendRawCommand).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not treat a completed write or unrelated traffic as a status reply', async () => {
    vi.useFakeTimers();
    try {
      const { session, transport, incoming } = await createConfirmableSession(true);
      const commands = TestBed.inject(DccCommandService);
      commands.startComposing('list-tracks');
      expect(await commands.sendComposedCommand()).toMatchObject({ status: 'unsupported' });
      expect(transport.sendRawCommand).not.toHaveBeenCalled();

      commands.startComposing('status-query');
      const query = commands.sendComposedCommand();
      incoming('<p1 MAIN><v 29 1>');
      await vi.advanceTimersByTimeAsync(2999);
      expect(commands.result()?.status).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      expect(await query).toMatchObject({ status: 'timeout' });
      expect(session.operationInProgress()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('confirms an actual locomotive address from fragmented frames and ignores other traffic', async () => {
    const { session, transport, incoming } = await createConfirmableSession();
    const confirming = session.confirmAddress(1234);
    expect(session.addressConfirmation()).toEqual({ status: 'confirming', address: 1234 });
    incoming('<iDCCEX><r 3><v 1 3><r LO');
    expect(session.addressConfirmation().status).toBe('confirming');
    incoming('COID 1234>');
    await confirming;
    expect(transport.requestLocomotiveAddress).toHaveBeenCalledOnce();
    expect(session.addressConfirmation()).toMatchObject({ status: 'confirmed', address: 1234 });
    expect(session.operation()).toEqual({ kind: 'idle' });
  });

  it('reports the actual address when it does not match the target', async () => {
    const { session, incoming } = await createConfirmableSession();
    const confirming = session.confirmAddress(3);
    incoming('<r LOCOID 7>');
    await confirming;
    expect(session.addressConfirmation()).toEqual({
      status: 'error', address: 3,
      message: 'Address mismatch: entered 3, decoder reported 7.',
    });
  });

  it.each(['-1', '0', '10294', 'invalid', '3 extra'])(
    'rejects failed or invalid address responses: %s', async (response) => {
      const { session, incoming } = await createConfirmableSession();
      const confirming = session.confirmAddress(3);
      incoming(`<r LOCOID ${response}>`);
      await confirming;
      expect(session.addressConfirmation().status).toBe('error');
    }
  );

  it('times out at 15 seconds and prevents a delayed reply from confirming a retry', async () => {
    vi.useFakeTimers();
    try {
      const { session, transport, incoming } = await createConfirmableSession();
      const confirming = session.confirmAddress(3);
      await vi.advanceTimersByTimeAsync(14999);
      expect(session.addressConfirmation().status).toBe('confirming');
      await vi.advanceTimersByTimeAsync(1);
      await confirming;
      expect(session.addressConfirmation()).toMatchObject({
        status: 'error', message: expect.stringContaining('timed out'),
      });
      incoming('<r LOCOID 3>');
      await session.confirmAddress(3);
      expect(transport.requestLocomotiveAddress).toHaveBeenCalledOnce();
      expect(session.addressConfirmation()).toMatchObject({
        status: 'error', message: expect.stringContaining('Reconnect'),
      });
      await session.disconnect();
      await session.connect(port.id);
      const retry = session.confirmAddress(3);
      incoming('<r LOCOID 3>');
      await retry;
      expect(session.addressConfirmation().status).toBe('confirmed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports transmission and disconnect failures, invalidates confirmed status on removal', async () => {
    const { session, transport, incoming, disconnect } = await createConfirmableSession();
    if (!transport.requestLocomotiveAddress) {
      throw new Error('Address read transport is required for this test.');
    }
    vi.mocked(transport.requestLocomotiveAddress).mockRejectedValueOnce(new Error('Send failed.'));
    await session.confirmAddress(3);
    expect(session.addressConfirmation()).toMatchObject({ status: 'error', message: 'Send failed.' });
    await session.disconnect();
    await session.connect(port.id);
    const confirming = session.confirmAddress(3);
    disconnect('Device removed.');
    await confirming;
    expect(session.addressConfirmation()).toMatchObject({ status: 'error', message: 'Device removed.' });
    await session.connect(port.id);
    const retry = session.confirmAddress(3);
    incoming('<r LOCOID 3>');
    await retry;
    disconnect('Device removed.');
    expect(session.addressConfirmation()).toMatchObject({ status: 'error', message: 'Device removed.' });
  });

  it('blocks invalid addresses, concurrent confirmation and CV operations without sending commands', async () => {
    const { session, transport, incoming } = await createConfirmableSession();
    for (const address of [0, 1.5, 10294]) {
      await session.confirmAddress(address);
      expect(session.addressConfirmation().status).toBe('error');
    }
    expect(transport.requestLocomotiveAddress).not.toHaveBeenCalled();
    const confirming = session.confirmAddress(3);
    await session.confirmAddress(4);
    await session.readCv(3, 1);
    await session.writeCv(3, 1, 7);
    expect(transport.readCv).not.toHaveBeenCalled();
    expect(transport.writeCv).not.toHaveBeenCalled();
    expect(transport.requestLocomotiveAddress).toHaveBeenCalledOnce();
    incoming('<r LOCOID 3>');
    await confirming;
    await session.disconnect();
    await session.confirmAddress(3);
    expect(session.addressConfirmation()).toMatchObject({
      status: 'error', message: expect.stringContaining('Connect'),
    });
  });

  it('reports a read result for the requested CV', async () => {
    const { session } = await createSession();

    await session.readCv(3, 29);

    expect(session.operation()).toEqual({
      kind: 'read-success',
      address: 3,
      cv: 29,
      value: 42,
    });
  });

  it('adds a browser-authorized port without connecting automatically', async () => {
    const chosen = { id: 'web-serial:chosen', label: 'Authorized port' };
    const { session, transport } = await createSession({
      requestPort: vi.fn().mockResolvedValue(chosen),
    });
    await session.disconnect();
    vi.mocked(transport.connect).mockClear();

    expect(session.canRequestPort).toBe(true);
    expect(await session.requestPort()).toEqual(chosen);
    expect(session.ports()).toContainEqual(chosen);
    expect(session.connection()).toEqual({ status: 'disconnected' });
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it('surfaces browser permission errors in connection state', async () => {
    const { session } = await createSession({
      requestPort: vi.fn().mockRejectedValue(
        new DccTransportError('permission-denied', 'Serial access blocked.')
      ),
    });
    await session.disconnect();
    expect(await session.requestPort()).toBeNull();
    expect(session.connection()).toEqual({
      status: 'error', message: 'Serial access blocked.',
    });
  });

  it('records incoming and outgoing serial messages for the debug view', async () => {
    let publishMessage: ((message: SerialLogMessage) => void) | undefined;
    const { session } = await createSession({
      onSerialMessage: (listener) => {
        publishMessage = listener;
        return () => undefined;
      },
    });

    if (!publishMessage) {
      throw new Error('Serial message listener was not registered.');
    }
    publishMessage({ direction: 'outgoing', message: '<READ 29>' });
    publishMessage({ direction: 'incoming', message: '<r 29|42>' });

    expect(session.serialLog()).toEqual([
      { direction: 'outgoing', message: '<READ 29>' },
      { direction: 'incoming', message: '<r 29|42>' },
    ]);
  });

  it('keeps CV operations disabled when the connection lacks capabilities', async () => {
    const { session, transport } = await createSession({
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: false,
          serviceModeWrite: false,
        },
      }),
    });

    await session.readCv(3, 29);
    expect(session.operation()).toEqual({
      kind: 'read-failure',
      address: 3,
      cv: 29,
      message: 'Service Mode CV reading is not available on this connection.',
    });

    await session.writeCv(3, 29, 77);
    expect(session.operation()).toEqual({
      kind: 'write-failure',
      address: 3,
      cv: 29,
      value: 77,
      message:
        'Service Mode CV writing and read-back are not available on this connection.',
    });
    expect(transport.readCv).not.toHaveBeenCalled();
    expect(transport.writeCv).not.toHaveBeenCalled();
  });

  it('reports verified write only after matching read-back', async () => {
    const { session, transport } = await createSession({
      readCv: vi.fn().mockResolvedValue(77),
    });

    await session.writeCv(3, 29, 77);

    expect(transport.writeCv).toHaveBeenCalledOnce();
    expect(transport.writeCv).toHaveBeenCalledWith(3, 29, 77);
    expect(transport.readCv).toHaveBeenCalledOnce();
    expect(transport.readCv).toHaveBeenCalledWith(3, 29);
    expect(session.operation()).toEqual({
      kind: 'write-verified',
      address: 3,
      cv: 29,
      value: 77,
    });
  });

  it('reports a mismatch instead of success when read-back differs', async () => {
    const { session } = await createSession({
      readCv: vi.fn().mockResolvedValue(12),
    });

    await session.writeCv(3, 29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-mismatch',
      address: 3,
      cv: 29,
      requestedValue: 77,
      readBackValue: 12,
    });
  });

  it('reports an unverified write when read-back fails', async () => {
    const { session } = await createSession({
      readCv: vi
        .fn()
        .mockRejectedValue(new DccTransportError('timeout', 'Read timed out.')),
    });

    await session.writeCv(3, 29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-unverified',
      address: 3,
      cv: 29,
      value: 77,
      message: 'Read timed out.',
    });
  });

  it('preserves an uncertain write outcome without retrying', async () => {
    const { session, transport } = await createSession({
      writeCv: vi.fn().mockRejectedValue(
        new DccTransportError(
          'disconnected',
          'Connection lost during write.',
          true
        )
      ),
    });

    await session.writeCv(3, 29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-unknown',
      address: 3,
      cv: 29,
      value: 77,
      message: 'Connection lost during write.',
    });
    expect(transport.writeCv).toHaveBeenCalledOnce();
    expect(transport.writeCv).toHaveBeenCalledWith(3, 29, 77);
    expect(transport.readCv).not.toHaveBeenCalled();
  });

  it('does not send a write while disconnected', async () => {
    const { session, transport } = await createSession();
    await session.disconnect();
    await session.writeCv(3, 29, 77);

    expect(transport.writeCv).not.toHaveBeenCalled();
    expect(session.operation()).toEqual({
      kind: 'write-failure',
      address: 3,
      cv: 29,
      value: 77,
      message: 'Connect to a command station before writing a CV.',
    });
  });
});
