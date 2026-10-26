import { TestBed } from '@angular/core/testing';
import { App } from './app';
import {
  DCC_TRANSPORT,
  DccSessionService,
  UnavailableDccTransport,
} from 'common';

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.removeItem('cabscribe.selectedSerialPort');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        DccSessionService,
        {
          provide: DCC_TRANSPORT,
          useClass: UnavailableDccTransport,
        },
      ],
    }).compileComponents();
  });

  it('explains that serial communication is not configured', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.mode-chip')?.textContent).toContain(
      'Disconnected'
    );
    expect(
      compiled.querySelector<HTMLButtonElement>(
        '.connection-settings-button'
      )?.getAttribute('aria-label')
    ).toBe('Serial connection settings');
    expect(compiled.querySelector('#connectionDialog')).not.toBeNull();
    expect(compiled.textContent).toContain('Locomotive or Accessory ID');
    const debugOutput = compiled.querySelector<HTMLTextAreaElement>(
      '#serial-debug-output'
    );
    expect(debugOutput?.readOnly).toBe(true);
    expect(compiled.querySelector('input[role="switch"]')).not.toBeNull();
    expect(compiled.textContent).not.toContain('Hardware connection');
    expect(compiled.querySelector('h1')?.textContent).toBe(
      'Read or write a configuration variable'
    );
    expect(compiled.querySelector('.page-heading .intro')).toBeNull();
    expect(
      compiled.querySelector(
        '.operation-card .card-description, .operation-card mat-hint, .verification-note'
      )
    ).toBeNull();
    expect(compiled.textContent).not.toContain('DECODER CONFIGURATION');
    expect(compiled.textContent).not.toContain('No operation history is saved');
    expect(compiled.textContent).toContain(
      'Serial communication is not configured in this build.'
    );
    expect(
      compiled.querySelector<HTMLButtonElement>('.operation-button')?.disabled
    ).toBe(true);
  });

  it('shows Service Mode after the selected serial port connects', async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([
        { id: '/dev/ttyUSB0', label: 'DCC-EX' },
      ]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: false,
          serviceModeWrite: false,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.selectPort('/dev/ttyUSB0');
    const dialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>('#connectionDialog');
    if (!dialog) {
      throw new Error('Connection settings dialog was not rendered.');
    }
    const closeDialog = vi.fn();
    Object.defineProperty(dialog, 'close', { value: closeDialog });

    await fixture.componentInstance.connect();
    fixture.detectChanges();

    expect(transport.connect).toHaveBeenCalledWith('/dev/ttyUSB0');
    expect(closeDialog).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.mode-chip')?.textContent).toContain(
      'Service Mode'
    );
  });

  it('persists the selected serial port and restores it without reconnecting', async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([
        { id: '/dev/ttyUSB0', label: 'DCC-EX' },
      ]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: false,
          serviceModeWrite: false,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi.fn(),
      writeCv: vi.fn(),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const firstFixture = TestBed.createComponent(App);
    await firstFixture.whenStable();
    firstFixture.componentInstance.selectPort('/dev/ttyUSB0');
    expect(window.localStorage.getItem('cabscribe.selectedSerialPort')).toBe(
      '/dev/ttyUSB0'
    );
    firstFixture.destroy();

    const secondFixture = TestBed.createComponent(App);
    await secondFixture.whenStable();

    expect(secondFixture.componentInstance.selectedPortId()).toBe(
      '/dev/ttyUSB0'
    );
    expect(secondFixture.nativeElement.querySelector('.mode-chip')?.textContent).toContain(
      'Disconnected'
    );
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it('puts a successful read in the editable value used for the write review', async () => {
    const transport = {
      listPorts: vi.fn().mockResolvedValue([
        { id: '/dev/ttyUSB0', label: 'DCC-EX' },
      ]),
      connect: vi.fn().mockResolvedValue({
        capabilities: {
          serviceModeRead: true,
          serviceModeWrite: true,
        },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readCv: vi
        .fn()
        .mockResolvedValueOnce(42)
        .mockRejectedValueOnce(new Error('Read failed.'))
        .mockResolvedValueOnce(77),
      writeCv: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.overrideProvider(DCC_TRANSPORT, { useValue: transport });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.selectPort('/dev/ttyUSB0');
    const connectionDialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>('#connectionDialog');
    if (!connectionDialog) {
      throw new Error('Connection settings dialog was not rendered.');
    }
    Object.defineProperty(connectionDialog, 'close', { value: vi.fn() });
    await fixture.componentInstance.connect();

    fixture.componentInstance.targetAddress.set('3');
    fixture.componentInstance.cvAddress.set('29');
    await fixture.componentInstance.read();
    expect(fixture.componentInstance.cvValue()).toBe('42');
    expect(transport.readCv).toHaveBeenCalledWith(3, 29);

    fixture.componentInstance.cvValue.set('99');
    await fixture.componentInstance.read();
    expect(fixture.componentInstance.cvValue()).toBe('');

    fixture.componentInstance.cvValue.set('77');
    const writeDialog = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLDialogElement>('.write-dialog');
    if (!writeDialog) {
      throw new Error('Write confirmation dialog was not rendered.');
    }
    const showWriteDialog = vi.fn();
    const closeWriteDialog = vi.fn();
    Object.defineProperty(writeDialog, 'showModal', {
      value: showWriteDialog,
    });
    Object.defineProperty(writeDialog, 'close', {
      value: closeWriteDialog,
    });
    fixture.componentInstance.requestWrite();

    expect(showWriteDialog).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.pendingWrite()).toEqual({
      address: 3,
      cv: 29,
      value: 77,
    });

    await fixture.componentInstance.confirmWrite();
    expect(transport.writeCv).toHaveBeenCalledWith(3, 29, 77);
    expect(transport.readCv).toHaveBeenLastCalledWith(3, 29);
  });

  it('formats incoming and outgoing serial data in the visible debug log', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.componentInstance.session.serialLog.set([
      { direction: 'outgoing', message: '<READ 29>' },
      { direction: 'incoming', message: '<r 29|42>\r\n' },
    ]);
    fixture.detectChanges();

    const debugOutput = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLTextAreaElement>('#serial-debug-output');
    expect(debugOutput?.value).toBe('CS> <READ 29>\nDC< <r 29|42>');

    fixture.componentInstance.debugLogVisible.set(false);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.debug-panel'
      )
    ).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'input[role="switch"]'
      )
    ).not.toBeNull();
  });
});
