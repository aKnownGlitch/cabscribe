import { TestBed } from '@angular/core/testing';
import { DccSessionService } from './dcc-session.service';
import {
  DCC_TRANSPORT,
  DccTransport,
  DccTransportError,
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

  it('reports a read result for the requested CV', async () => {
    const { session } = await createSession();

    await session.readCv(29);

    expect(session.operation()).toEqual({
      kind: 'read-success',
      cv: 29,
      value: 42,
    });
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

    await session.readCv(29);
    expect(session.operation()).toEqual({
      kind: 'read-failure',
      cv: 29,
      message: 'Service Mode CV reading is not available on this connection.',
    });

    await session.writeCv(29, 77);
    expect(session.operation()).toEqual({
      kind: 'write-failure',
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

    await session.writeCv(29, 77);

    expect(transport.writeCv).toHaveBeenCalledOnce();
    expect(transport.writeCv).toHaveBeenCalledWith(29, 77);
    expect(transport.readCv).toHaveBeenCalledOnce();
    expect(transport.readCv).toHaveBeenCalledWith(29);
    expect(session.operation()).toEqual({
      kind: 'write-verified',
      cv: 29,
      value: 77,
    });
  });

  it('reports a mismatch instead of success when read-back differs', async () => {
    const { session } = await createSession({
      readCv: vi.fn().mockResolvedValue(12),
    });

    await session.writeCv(29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-mismatch',
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

    await session.writeCv(29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-unverified',
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

    await session.writeCv(29, 77);

    expect(session.operation()).toEqual({
      kind: 'write-unknown',
      cv: 29,
      value: 77,
      message: 'Connection lost during write.',
    });
    expect(transport.writeCv).toHaveBeenCalledOnce();
    expect(transport.writeCv).toHaveBeenCalledWith(29, 77);
    expect(transport.readCv).not.toHaveBeenCalled();
  });

  it('does not send a write while disconnected', async () => {
    const { session, transport } = await createSession();
    await session.disconnect();
    await session.writeCv(29, 77);

    expect(transport.writeCv).not.toHaveBeenCalled();
    expect(session.operation()).toEqual({
      kind: 'write-failure',
      cv: 29,
      value: 77,
      message: 'Connect to a command station before writing a CV.',
    });
  });
});
