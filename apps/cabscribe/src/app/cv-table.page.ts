import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  CvScanService,
  DccSessionService,
  SERVICE_MODE_CV_LIMITS,
  validateCvScanRange,
} from 'common';
import { CV_APPLICABILITY_RULES, describeCv } from './cv-applicability';
import {
  buildCvCsv,
  CV_STATUS_LABELS,
  CvValueFormat,
  cvCsvFileName,
  downloadTextFile,
  formatCvValue,
} from './cv-csv';
import { CV_DEFINITIONS_SOURCE } from './cv-definitions';
import { parseInteger } from './parse-integer';

const DEFAULT_RANGE = { first: '1', last: '29' };

@Component({
  selector: 'app-cv-table-page',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './cv-table.page.html',
})
export class CvTablePage {
  readonly session = inject(DccSessionService);
  readonly scan = inject(CvScanService);
  readonly cvDefinitionsSource = CV_DEFINITIONS_SOURCE;
  readonly cvLimits = SERVICE_MODE_CV_LIMITS;
  readonly statusLabels = CV_STATUS_LABELS;
  readonly firstCv = signal(DEFAULT_RANGE.first);
  readonly lastCv = signal(DEFAULT_RANGE.last);
  readonly valueFormat = signal<CvValueFormat>('decimal');

  readonly rangeError = computed(() =>
    validateCvScanRange(
      parseInteger(this.firstCv(), 0),
      parseInteger(this.lastCv(), 0)
    )
  );
  readonly cvCount = computed(() =>
    this.rangeError() === null
      ? Number(this.lastCv()) - Number(this.firstCv()) + 1
      : 0
  );
  readonly isConnected = computed(
    () => this.session.connection().status === 'connected'
  );
  readonly canStart = computed(() => {
    const connection = this.session.connection();
    return (
      connection.status === 'connected' &&
      connection.capabilities.serviceModeRead &&
      !this.session.operationInProgress() &&
      parseInteger(this.session.targetAddress(), 1) !== null &&
      this.rangeError() === null
    );
  });
  readonly canToggleScan = computed(() =>
    this.scan.scanning() ? !this.scan.cancelling() : this.canStart()
  );
  readonly displayRows = computed(() => {
    const format = this.valueFormat();
    return this.scan.rows().map((row) => ({
      ...row,
      description: describeCv(row.cv),
      display: formatCvValue(row.value, format),
    }));
  });
  readonly statusMessage = computed(() => {
    const { completed, total } = this.scan.progress();
    const current = this.scan.currentCv();
    if (this.scan.cancelling()) {
      return 'Cancelling after the current read…';
    }
    if (this.scan.scanning()) {
      return `Reading CV ${current ?? ''} — ${completed} of ${total} CVs read.`;
    }
    const outcome = this.scan.outcome();
    if (outcome.kind === 'none') {
      return '';
    }
    const time = outcome.finishedAt.toLocaleTimeString();
    return `${outcome.message} CV ${outcome.range.first}–${outcome.range.last}, target ${outcome.address}, ${time}.`;
  });

  async toggleScan(): Promise<void> {
    if (this.scan.scanning()) {
      this.scan.cancel();
      return;
    }
    const address = parseInteger(this.session.targetAddress(), 1);
    const first = parseInteger(this.firstCv(), 1);
    const last = parseInteger(this.lastCv(), 1);
    if (this.canStart() && address !== null && first !== null && last !== null) {
      await this.scan.scan(address, { first, last }, CV_APPLICABILITY_RULES);
    }
  }

  exportCsv(): void {
    const outcome = this.scan.outcome();
    const address =
      outcome.kind === 'none'
        ? parseInteger(this.session.targetAddress(), 1)
        : outcome.address;
    if (address === null || this.scan.rows().length === 0) {
      return;
    }
    downloadTextFile(
      cvCsvFileName(address, new Date()),
      buildCvCsv(this.scan.rows(), describeCv)
    );
  }
}
