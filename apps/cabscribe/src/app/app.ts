import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
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
  readonly session = inject(DccSessionService);
  readonly readAddress = signal('');
  readonly writeAddress = signal('');
  readonly writeValue = signal('');
  readonly selectedPortId = signal('');
  readonly pendingWrite = signal<{ cv: number; value: number } | null>(null);
  readonly isConnected = computed(
    () => this.session.connection().status === 'connected'
  );
  readonly operationInProgress = computed(() =>
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
      !this.operationInProgress() &&
      this.parseInteger(this.readAddress(), 1) !== null
  );
  readonly canWrite = computed(
    () =>
      this.connectionHasWriteCapabilities() &&
      !this.operationInProgress() &&
      this.parseInteger(this.writeAddress(), 1) !== null &&
      this.parseInteger(this.writeValue(), 0) !== null
  );

  @ViewChild('writeDialog') private writeDialog?: ElementRef<HTMLDialogElement>;

  ngOnInit(): void {
    void this.session.discoverPorts();
  }

  connectionLabel(): string {
    switch (this.session.connection().status) {
      case 'connected':
        return this.connectionHasWriteCapabilities()
          ? 'DCC-EX ready'
          : 'Serial port open · protocol pending';
      case 'connecting':
        return 'Connecting';
      case 'scanning':
        return 'Checking serial support';
      case 'disconnected':
        return 'Not connected';
      case 'unavailable':
        return 'Serial support unavailable';
      case 'error':
        return 'Connection error';
    }
  }

  async refreshPorts(): Promise<void> {
    await this.session.discoverPorts();
  }

  async connect(): Promise<void> {
    await this.session.connect(this.selectedPortId());
  }

  async disconnect(): Promise<void> {
    await this.session.disconnect();
  }

  async read(): Promise<void> {
    const cv = this.parseInteger(this.readAddress(), 1);
    if (cv !== null) {
      await this.session.readCv(cv);
    }
  }

  requestWrite(): void {
    const cv = this.parseInteger(this.writeAddress(), 1);
    const value = this.parseInteger(this.writeValue(), 0);
    if (cv === null || value === null || !this.connectionHasWriteCapabilities()) {
      return;
    }

    this.pendingWrite.set({ cv, value });
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
      await this.session.writeCv(pending.cv, pending.value);
    }
  }

  private parseInteger(rawValue: string, minimum: number): number | null {
    if (rawValue.trim() === '') {
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
