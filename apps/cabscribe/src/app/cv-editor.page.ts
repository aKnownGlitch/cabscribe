import {
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DccSessionService } from 'common';
import { CV_DEFINITIONS, CV_DEFINITIONS_SOURCE } from './cv-definitions';
import { parseInteger } from './parse-integer';

@Component({
  selector: 'app-cv-editor-page',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './cv-editor.page.html',
})
export class CvEditorPage {
  readonly session = inject(DccSessionService);
  readonly cvAddress = signal('');
  readonly cvValue = signal('');
  readonly cvDefinitions = CV_DEFINITIONS;
  readonly cvDefinitionsSource = CV_DEFINITIONS_SOURCE;
  readonly pendingWrite = signal<{
    address: number;
    cv: number;
    value: number;
  } | null>(null);
  readonly selectedCvDefinition = computed(() =>
    parseInteger(this.cvAddress(), 1)
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
  readonly isConnected = computed(
    () => this.session.connection().status === 'connected'
  );
  readonly canRead = computed(
    () =>
      this.connectionHasReadCapability() &&
      !this.session.operationInProgress() &&
      parseInteger(this.session.targetAddress(), 1) !== null &&
      parseInteger(this.cvAddress(), 1) !== null
  );
  readonly canWrite = computed(
    () =>
      this.connectionHasWriteCapabilities() &&
      !this.session.operationInProgress() &&
      parseInteger(this.session.targetAddress(), 1) !== null &&
      parseInteger(this.cvAddress(), 1) !== null &&
      parseInteger(this.cvValue(), 0) !== null
  );

  @ViewChild('writeDialog') private writeDialog?: ElementRef<HTMLDialogElement>;

  selectCvDefinition(address: number | null): void {
    this.cvAddress.set(address === null ? '' : String(address));
  }

  async read(): Promise<void> {
    const address = parseInteger(this.session.targetAddress(), 1);
    const cv = parseInteger(this.cvAddress(), 1);
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
    const address = parseInteger(this.session.targetAddress(), 1);
    const cv = parseInteger(this.cvAddress(), 1);
    const value = parseInteger(this.cvValue(), 0);
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
      await this.session.writeCv(pending.address, pending.cv, pending.value);
    }
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
