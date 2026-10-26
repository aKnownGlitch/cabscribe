import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { DccSessionService } from 'common';
import { CV_DEFINITIONS, CV_DEFINITIONS_SOURCE } from './cv-definitions';

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private static readonly selectedPortStorageKey = 'cabscribe.selectedSerialPort';
  readonly session = inject(DccSessionService);
  readonly targetAddress = signal('');
  readonly cvAddress = signal('');
  readonly cvDefinitions = CV_DEFINITIONS;
  readonly cvDefinitionsSource = CV_DEFINITIONS_SOURCE;
  readonly selectedCvDefinition = computed(() =>
    this.parseInteger(this.cvAddress(), 1)
  );
  readonly isCustomCvAddress = computed(() => {
    const address = this.selectedCvDefinition();
    return address !== null &&
      !this.cvDefinitions.some((definition) => definition.address === address);
  });
  readonly selectedCvLabel = computed(() => {
    const address = this.selectedCvDefinition();
    const definition = this.cvDefinitions.find((entry) => entry.address === address);
    return address === null
      ? ''
      : `CV ${address} — ${definition?.label ?? 'Manual address'}`;
  });
  readonly cvValue = signal('');
  readonly selectedPortId = signal('');
  private readonly viewReady = signal(false);
  readonly debugLogVisible = signal(true);
  readonly pendingWrite = signal<{
    address: number;
    cv: number;
    value: number;
  } | null>(null);
  readonly serialLogText = computed(() =>
    this.session
      .serialLog()
      .map(({ direction, message }) => {
        const prefix = direction === 'outgoing' ? 'CS> ' : 'DC< ';
        return message
          .replace(/\r\n?/g, '\n')
          .split('\n')
          .filter((line) => line.length > 0)
          .map((line) => `${prefix}${line}`)
          .join('\n');
      })
      .join('\n')
  );
  readonly isConnected = computed(
    () => this.session.connection().status === 'connected'
  );
  readonly hasSelectedPort = computed(() =>
    this.session.ports().some((port) => port.id === this.selectedPortId())
  );
  readonly confirmingAddress = computed(
    () => this.session.addressConfirmation().status === 'confirming'
  );
  readonly canConfirmAddress = computed(() => {
    const address = this.parseInteger(this.targetAddress(), 1);
    return this.hasSelectedPort() && this.isConnected() && this.session.canConfirmAddress &&
      !this.operationInProgress() && address !== null && address <= 10293;
  });
  readonly operationInProgress = computed(() => this.confirmingAddress() ||
    ['reading', 'writing', 'verifying'].includes(
      this.session.operation().kind
    )
  );
  readonly canConnect = computed(
    () =>
      !this.isConnected() &&
      !this.operationInProgress() &&
      this.session.ports().some((port) => port.id === this.selectedPortId()) &&
      !['scanning', 'connecting'].includes(
        this.session.connection().status
      )
  );
  readonly canRead = computed(
    () =>
      this.connectionHasReadCapability() &&
      this.hasSelectedPort() &&
      !this.operationInProgress() &&
      this.parseInteger(this.targetAddress(), 1) !== null &&
      this.parseInteger(this.cvAddress(), 1) !== null
  );
  readonly canWrite = computed(
    () =>
      this.connectionHasWriteCapabilities() &&
      this.hasSelectedPort() &&
      !this.operationInProgress() &&
      this.parseInteger(this.targetAddress(), 1) !== null &&
      this.parseInteger(this.cvAddress(), 1) !== null &&
      this.parseInteger(this.cvValue(), 0) !== null
  );

  @ViewChild('writeDialog') private writeDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('connectionDialog')
  private connectionDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('debugOutput')
  private debugOutput?: ElementRef<HTMLTextAreaElement>;

  constructor() {
    afterNextRender(() => {
      this.viewReady.set(true);
    });
    effect(() => {
      if (this.viewReady() && !this.isConnected()) {
        this.openConnectionDialog();
      }
    });
    effect(() => {
      this.serialLogText();
      const visible = this.debugLogVisible();
      const textarea = this.debugOutput?.nativeElement;
      if (visible && textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    });
  }

  ngOnInit(): void {
    const storedPortId = this.readStoredPortId();
    if (storedPortId) {
      this.selectedPortId.set(storedPortId);
    }
    if (!this.isConnected()) {
      void this.session.discoverPorts();
    }
  }

  async refreshPorts(): Promise<void> {
    await this.session.discoverPorts();
  }

  updateTargetAddress(value: string | number | null): void {
    this.targetAddress.set(value === null ? '' : String(value));
    this.session.addressConfirmation.set({ status: 'idle' });
  }

  async confirmAddress(): Promise<void> {
    const address = this.parseInteger(this.targetAddress(), 1);
    if (address !== null) {
      await this.session.confirmAddress(address);
    }
  }

  selectCvDefinition(address: number | null): void {
    this.cvAddress.set(address === null ? '' : String(address));
  }

  async authorizePort(): Promise<void> {
    const port = await this.session.requestPort();
    if (port) {
      this.selectPort(port.id);
    }
  }

  selectPort(portId: string): void {
    this.selectedPortId.set(portId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        App.selectedPortStorageKey,
        portId
      );
    }
  }

  openConnectionDialog(): void {
    const dialog = this.connectionDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  closeConnectionDialog(): void {
    if (this.isConnected()) {
      this.connectionDialog?.nativeElement.close();
    }
  }

  cancelConnectionDialog(event: Event): void {
    if (!this.isConnected()) {
      event.preventDefault();
    }
  }

  async connect(): Promise<void> {
    await this.session.connect(this.selectedPortId());
    if (this.isConnected()) {
      this.closeConnectionDialog();
    }
  }

  async disconnect(): Promise<void> {
    await this.session.disconnect();
    if (this.session.connection().status === 'disconnected') {
      this.closeConnectionDialog();
    }
  }

  async read(): Promise<void> {
    const address = this.parseInteger(this.targetAddress(), 1);
    const cv = this.parseInteger(this.cvAddress(), 1);
    if (address !== null && cv !== null) {
      this.cvValue.set('');
      await this.session.readCv(address, cv);
      const operation = this.session.operation();
      if (
        operation.kind === 'read-success' &&
        operation.address === address &&
        operation.cv === cv
      ) {
        this.cvValue.set(String(operation.value));
      }
    }
  }

  requestWrite(): void {
    const address = this.parseInteger(this.targetAddress(), 1);
    const cv = this.parseInteger(this.cvAddress(), 1);
    const value = this.parseInteger(this.cvValue(), 0);
    if (
      address === null ||
      cv === null ||
      value === null ||
      !this.connectionHasWriteCapabilities()
    ) {
      return;
    }

    this.pendingWrite.set({ address, cv, value });
    this.writeDialog?.nativeElement.showModal();
  }

  cancelWrite(): void {
    this.writeDialog?.nativeElement.close();
    this.pendingWrite.set(null);
  }

  async confirmWrite(): Promise<void> {
    const pending = this.pendingWrite();
    this.writeDialog?.nativeElement.close();
    this.pendingWrite.set(null);
    if (pending) {
      await this.session.writeCv(
        pending.address,
        pending.cv,
        pending.value
      );
    }
  }

  private readStoredPortId(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(App.selectedPortStorageKey) ?? '';
  }

  private parseInteger(rawValue: string | number | null, minimum: number): number | null {
    if (rawValue === null || String(rawValue).trim() === '') {
      return null;
    }

    const value = Number(rawValue);
    return Number.isSafeInteger(value) && value >= minimum ? value : null;
  }

  private connectionHasReadCapability(): boolean {
    const connection = this.session.connection();
    return (
      connection.status === 'connected' &&
      connection.capabilities.serviceModeRead
    );
  }

  private connectionHasWriteCapabilities(): boolean {
    const connection = this.session.connection();
    return (
      connection.status === 'connected' &&
      connection.capabilities.serviceModeRead &&
      connection.capabilities.serviceModeWrite
    );
  }
}
