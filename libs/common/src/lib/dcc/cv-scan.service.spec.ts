import { TestBed } from '@angular/core/testing';
import { CvApplicabilityRules, CvScanService, validateCvScanRange } from './cv-scan.service';
import { DccSessionService } from './dcc-session.service';
import { DCC_TRANSPORT, DccTransport, DccTransportError } from './dcc-transport';

describe('CvScanService', () => {
  const port = { id: 'test', label: 'DCC-EX' };

  async function setup(readCv: DccTransport['readCv']) {
    const transport: DccTransport = {
      listPorts: vi.fn().mockResolvedValue([port]),
      connect: vi.fn().mockResolvedValue({
        capabilities: { serviceModeRead: true, serviceModeWrite: true },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(readCv),
      writeCv: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        DccSessionService,
        CvScanService,
        { provide: DCC_TRANSPORT, useValue: transport },
      ],
    });
    const session = TestBed.inject(DccSessionService);
    const scan = TestBed.inject(CvScanService);
    await session.discoverPorts();
    await session.connect(port.id);
    TestBed.tick();
    return { session, scan, transport };
  }

  it('validates the CV range', () => {
    expect(validateCvScanRange(1, 29)).toBeNull();
    expect(validateCvScanRange(null, 29)).not.toBeNull();
    expect(validateCvScanRange(0, 29)).not.toBeNull();
    expect(validateCvScanRange(1, 1025)).not.toBeNull();
    expect(validateCvScanRange(30, 29)).not.toBeNull();
  });

  it('reads the range in order and reports progress by CV count', async () => {
    const { scan, transport, session } = await setup(async (_address, cv) => cv * 2);
    const totals: number[] = [];
    const watch = setInterval(() => totals.push(scan.progress().completed), 0);
    await scan.scan(3, { first: 1, last: 4 });
    clearInterval(watch);

    expect(vi.mocked(transport.readCv).mock.calls).toEqual([
      [3, 1], [3, 2], [3, 3], [3, 4],
    ]);
    expect(scan.rows().map((row) => [row.cv, row.status, row.value])).toEqual([
      [1, 'value', 2], [2, 'value', 4], [3, 'value', 6], [4, 'value', 8],
    ]);
    expect(scan.progress()).toEqual({ completed: 4, total: 4 });
    expect(scan.percent()).toBe(100);
    expect(scan.outcome().kind).toBe('completed');
    expect(scan.scanning()).toBe(false);
    expect(session.bulkOperationActive()).toBe(false);
  });

  it('cancels between reads, keeps values and leaves unread rows unread', async () => {
    const ref: { scan?: CvScanService } = {};
    const { scan } = await setup(async (_address, cv) => {
      if (cv === 2) {
        ref.scan?.cancel();
      }
      return cv;
    });
    ref.scan = scan;
    await scan.scan(3, { first: 1, last: 5 });

    expect(scan.rows().map((row) => row.status)).toEqual([
      'value', 'value', 'not-read', 'not-read', 'not-read',
    ]);
    expect(scan.outcome().kind).toBe('cancelled');
    expect(scan.cancelling()).toBe(false);
    expect(scan.scanning()).toBe(false);
  });

  it('blocks other operations while scanning', async () => {
    let release!: () => void;
    const { scan, session } = await setup(
      () => new Promise<number>((resolve) => (release = () => resolve(1)))
    );
    const running = scan.scan(3, { first: 1, last: 1 });
    await vi.waitFor(() => expect(scan.scanning()).toBe(true));
    expect(session.operationInProgress()).toBe(true);
    await session.confirmAddress(3);
    expect(session.addressConfirmation().status).toBe('error');
    release();
    await running;
    expect(session.operationInProgress()).toBe(false);
  });

  it('marks unsupported reads and never reports them as values', async () => {
    const { scan } = await setup(async () => {
      throw new DccTransportError('unsupported', 'Not implemented');
    });
    await scan.scan(3, { first: 1, last: 5 });

    expect(scan.rows().every((row) => row.status === 'unsupported' && row.value === null)).toBe(true);
    expect(scan.outcome().kind).toBe('completed');
  });

  it('stops after 3 consecutive failures and keeps earlier values', async () => {
    const { scan, transport } = await setup(async (_address, cv) => {
      if (cv >= 3) {
        throw new DccTransportError('timeout', 'No response');
      }
      return cv;
    });
    await scan.scan(3, { first: 1, last: 10 });

    expect(vi.mocked(transport.readCv)).toHaveBeenCalledTimes(5);
    expect(scan.rows().map((row) => row.status)).toEqual([
      'value', 'value', 'failed', 'failed', 'failed',
      'not-read', 'not-read', 'not-read', 'not-read', 'not-read',
    ]);
    expect(scan.outcome()).toMatchObject({ kind: 'stopped' });
  });

  it('resets the failure count after a successful read', async () => {
    const { scan } = await setup(async (_address, cv) => {
      if (cv % 3 !== 0) {
        throw new DccTransportError('timeout', 'No response');
      }
      return cv;
    });
    await scan.scan(3, { first: 1, last: 9 });

    expect(scan.outcome().kind).toBe('completed');
    expect(scan.rows().filter((row) => row.status === 'value').map((row) => row.cv)).toEqual([3, 6, 9]);
  });

  it('stops when the connection is lost mid-scan', async () => {
    const ref: { session?: DccSessionService } = {};
    const { scan, session } = await setup(async (_address, cv) => {
      if (cv === 2) {
        ref.session?.connection.set({ status: 'error', message: 'Device removed' });
      }
      return cv;
    });
    ref.session = session;
    await scan.scan(3, { first: 1, last: 5 });

    expect(scan.rows().map((row) => row.status)).toEqual([
      'value', 'value', 'not-read', 'not-read', 'not-read',
    ]);
    expect(scan.outcome()).toMatchObject({ kind: 'stopped', message: 'Device removed' });
  });

  it('reads the controlling CV first and skips dependent CVs that do not apply', async () => {
    const rules: CvApplicabilityRules = new Map([
      [17, { dependsOn: 29, isApplicable: (value) => (value & 32) !== 0, reason: 'Short address in use' }],
    ]);
    const { scan, transport } = await setup(async (_address, cv) => (cv === 29 ? 0 : 5));
    await scan.scan(3, { first: 17, last: 18 }, rules);

    expect(vi.mocked(transport.readCv).mock.calls.map(([, cv]) => cv)).toEqual([29, 18]);
    expect(scan.rows()).toEqual([
      { cv: 17, status: 'not-applicable', value: null, message: 'Short address in use' },
      { cv: 18, status: 'value', value: 5 },
    ]);
    expect(scan.progress()).toEqual({ completed: 2, total: 2 });
  });

  it('reads dependent CVs when the controlling value allows them', async () => {
    const rules: CvApplicabilityRules = new Map([
      [17, { dependsOn: 29, isApplicable: (value) => (value & 32) !== 0, reason: 'x' }],
    ]);
    const { scan } = await setup(async (_address, cv) => (cv === 29 ? 32 : 7));
    await scan.scan(3, { first: 17, last: 29 }, rules);

    expect(scan.rows().find((row) => row.cv === 17)?.status).toBe('value');
    expect(scan.rows().find((row) => row.cv === 29)?.value).toBe(32);
  });

  it('clears the table on a new connection and when the target changes', async () => {
    const { scan, session } = await setup(async (_address, cv) => cv);
    await scan.scan(3, { first: 1, last: 2 });
    expect(scan.rows()).toHaveLength(2);

    session.targetAddress.set('4');
    TestBed.tick();
    expect(scan.rows()).toHaveLength(0);
    expect(scan.outcome().kind).toBe('none');

    await scan.scan(4, { first: 1, last: 2 });
    await session.disconnect();
    TestBed.tick();
    expect(scan.rows()).toHaveLength(2);
    await session.connect(port.id);
    TestBed.tick();
    expect(scan.rows()).toHaveLength(0);
  });

  it('rejects an invalid range without reading', async () => {
    const { scan, transport } = await setup(async () => 1);
    await scan.scan(3, { first: 10, last: 5 });
    expect(vi.mocked(transport.readCv)).not.toHaveBeenCalled();
    expect(scan.outcome().kind).toBe('stopped');
  });
});
