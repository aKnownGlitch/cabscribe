import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { DccSessionService } from 'common';
import { APP_RELEASE_DATE, APP_VERSION } from './app-version';
import { CV_TABLE_PATH } from './app.routes';
import { parseInteger } from './parse-integer';

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
    RouterOutlet,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  // Page components render inside this shell and share its stylesheet.
  encapsulation: ViewEncapsulation.None,
})
export class App implements OnInit {
  private static readonly selectedPortStorageKey = 'cabscribe.selectedSerialPort';
  private readonly router = inject(Router);
  readonly version = APP_VERSION;
  readonly releaseDate = APP_RELEASE_DATE;
  readonly session = inject(DccSessionService);
  readonly targetAddress = this.session.targetAddress;
  private readonly currentUrl = toSignal(
    this.router.events.pipe(map(() => this.router.url)),
    { initialValue: this.router.url }
  );
  readonly onTablePage = computed(
    () => this.currentUrl().split(/[?#]/)[0] === `/${CV_TABLE_PATH}`
  );
  readonly pageTitle = computed(() =>
    this.onTablePage()
      ? 'Read configuration variables'
      : 'Read or write a configuration variable'
  );
  readonly selectedPortId = signal('');
  private readonly viewReady = signal(false);
  readonly debugLogVisible = signal(true);
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
    const address = parseInteger(this.targetAddress(), 1);
    return this.hasSelectedPort() && this.isConnected() && this.session.canConfirmAddress &&
      !this.operationInProgress() && address !== null && address <= 10293;
  });
  readonly operationInProgress = this.session.operationInProgress;
  readonly canConnect = computed(
    () =>
      !this.isConnected() &&
      !this.operationInProgress() &&
      this.session.ports().some((port) => port.id === this.selectedPortId()) &&
      !['scanning', 'connecting'].includes(
        this.session.connection().status
      )
  );

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
    const address = parseInteger(this.targetAddress(), 1);
    if (address !== null) {
      await this.session.confirmAddress(address);
    }
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

  toggleCvTable(): void {
    void this.router.navigateByUrl(this.onTablePage() ? '/' : `/${CV_TABLE_PATH}`);
  }

  private readStoredPortId(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(App.selectedPortStorageKey) ?? '';
  }
}
