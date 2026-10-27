import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DccSessionService } from './dcc-session.service';

/** CV addresses a DCC-EX Service Mode read can address. */
export const SERVICE_MODE_CV_LIMITS = { min: 1, max: 1024 } as const;
export const MAX_CONSECUTIVE_SCAN_FAILURES = 3;

export type CvScanRowStatus =
  | 'not-read'
  | 'reading'
  | 'value'
  | 'unsupported'
  | 'failed'
  | 'not-applicable';

export interface CvScanRow {
  cv: number;
  status: CvScanRowStatus;
  value: number | null;
  message?: string;
}

/** A CV that only applies depending on the value of another (controlling) CV. */
export interface CvApplicabilityRule {
  dependsOn: number;
  isApplicable(controllingValue: number): boolean;
  reason: string;
}

export type CvApplicabilityRules = ReadonlyMap<number, CvApplicabilityRule>;

export interface CvScanRange {
  first: number;
  last: number;
}

export type CvScanOutcome =
  | { kind: 'none' }
  | {
      kind: 'completed' | 'cancelled' | 'stopped';
      message: string;
      address: number;
      range: CvScanRange;
      finishedAt: Date;
    };

export function validateCvScanRange(
  first: number | null,
  last: number | null
): string | null {
  const { min, max } = SERVICE_MODE_CV_LIMITS;
  if (first === null || last === null) {
    return 'Enter the first and last CV to read.';
  }
  if (first < min || last > max) {
    return `CV addresses must be from ${min} to ${max}.`;
  }
  if (first > last) {
    return 'The first CV must not be greater than the last CV.';
  }
  return null;
}

@Injectable()
export class CvScanService {
  private readonly session = inject(DccSessionService);

  readonly rows = signal<CvScanRow[]>([]);
  readonly scanning = signal(false);
  readonly cancelling = signal(false);
  readonly progress = signal({ completed: 0, total: 0 });
  readonly currentCv = signal<number | null>(null);
  readonly outcome = signal<CvScanOutcome>({ kind: 'none' });
  readonly percent = computed(() => {
    const { completed, total } = this.progress();
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  });
  readonly hasReadValues = computed(() =>
    this.rows().some((row) => row.status === 'value')
  );

  private cancelRequested = false;
  private lastConnectionStatus = this.session.connection().status;
  private lastTargetAddress = this.session.targetAddress();

  constructor() {
    effect(() => {
      const status = this.session.connection().status;
      untracked(() => {
        if (status !== 'connected') {
          this.cancel();
        } else if (this.lastConnectionStatus !== 'connected') {
          this.clear();
        }
        this.lastConnectionStatus = status;
      });
    });
    effect(() => {
      const address = this.session.targetAddress();
      untracked(() => {
        if (address !== this.lastTargetAddress) {
          this.lastTargetAddress = address;
          this.clear();
        }
      });
    });
  }

  clear(): void {
    if (this.scanning()) {
      return;
    }
    this.rows.set([]);
    this.progress.set({ completed: 0, total: 0 });
    this.outcome.set({ kind: 'none' });
  }

  cancel(): void {
    if (this.scanning()) {
      this.cancelRequested = true;
      this.cancelling.set(true);
    }
  }

  /** Read-only scan of `range` from the target; never writes a CV. */
  async scan(
    address: number,
    range: CvScanRange,
    rules: CvApplicabilityRules = new Map()
  ): Promise<void> {
    if (this.scanning() || this.session.operationInProgress()) {
      return;
    }
    const rangeError = validateCvScanRange(range.first, range.last);
    if (rangeError) {
      this.outcome.set({
        kind: 'stopped',
        message: rangeError,
        address,
        range,
        finishedAt: new Date(),
      });
      return;
    }

    const cvs = Array.from(
      { length: range.last - range.first + 1 },
      (_, index) => range.first + index
    );
    // Controlling CVs are read first so dependent rows can be judged.
    const controllers = new Set<number>();
    for (const cv of cvs) {
      const rule = rules.get(cv);
      if (rule) {
        controllers.add(rule.dependsOn);
      }
    }
    const plan = [
      ...controllers,
      ...cvs.filter((cv) => !controllers.has(cv)),
    ];

    this.cancelRequested = false;
    this.cancelling.set(false);
    this.scanning.set(true);
    this.session.bulkOperationActive.set(true);
    this.outcome.set({ kind: 'none' });
    this.rows.set(
      cvs.map((cv) => ({ cv, status: 'not-read', value: null }))
    );
    this.progress.set({ completed: 0, total: plan.length });

    const values = new Map<number, number>();
    let completed = 0;
    let skipped = 0;
    let consecutiveFailures = 0;
    let end: { kind: 'completed' | 'cancelled' | 'stopped'; message: string } = {
      kind: 'completed',
      message: `Read CV ${range.first} to ${range.last} from target ${address}.`,
    };

    try {
      for (const cv of plan) {
        if (this.cancelRequested) {
          end = { kind: 'cancelled', message: 'Scan cancelled. Values already read are kept.' };
          break;
        }
        const connection = this.session.connection();
        if (connection.status !== 'connected') {
          end = {
            kind: 'stopped',
            message:
              ('message' in connection && connection.message) ||
              'The connection was lost. Values already read are kept.',
          };
          break;
        }

        const rule = rules.get(cv);
        const controllingValue = rule ? values.get(rule.dependsOn) : undefined;
        if (rule && controllingValue !== undefined && !rule.isApplicable(controllingValue)) {
          this.updateRow(cv, { status: 'not-applicable', value: null, message: rule.reason });
          skipped++;
          this.progress.set({ completed, total: plan.length - skipped });
          continue;
        }

        this.currentCv.set(cv);
        this.updateRow(cv, { status: 'reading', value: null });
        await this.session.readCv(address, cv);
        const operation = this.session.operation();
        completed++;

        if (
          operation.kind === 'read-success' &&
          operation.cv === cv &&
          operation.address === address
        ) {
          consecutiveFailures = 0;
          values.set(cv, operation.value);
          this.updateRow(cv, { status: 'value', value: operation.value });
        } else if (operation.kind === 'read-failure' && operation.cv === cv) {
          const unsupported = operation.code === 'unsupported';
          if (!unsupported) {
            consecutiveFailures++;
          }
          this.updateRow(cv, {
            status: unsupported ? 'unsupported' : 'failed',
            value: null,
            message: operation.message,
          });
        } else {
          consecutiveFailures++;
          this.updateRow(cv, {
            status: 'failed',
            value: null,
            message: 'The read did not return a result.',
          });
        }
        this.progress.set({ completed, total: plan.length - skipped });

        if (consecutiveFailures >= MAX_CONSECUTIVE_SCAN_FAILURES) {
          end = {
            kind: 'stopped',
            message: `Scan stopped after ${MAX_CONSECUTIVE_SCAN_FAILURES} consecutive failed reads. Check the locomotive and programming track.`,
          };
          break;
        }
      }
    } finally {
      this.rows.update((rows) =>
        rows.map((row) =>
          row.status === 'reading' ? { ...row, status: 'not-read' } : row
        )
      );
      this.currentCv.set(null);
      this.outcome.set({ ...end, address, range, finishedAt: new Date() });
      this.cancelRequested = false;
      this.cancelling.set(false);
      this.scanning.set(false);
      this.session.bulkOperationActive.set(false);
    }
  }

  private updateRow(cv: number, change: Partial<CvScanRow>): void {
    this.rows.update((rows) => {
      const index = rows.findIndex((row) => row.cv === cv);
      if (index === -1) {
        return rows;
      }
      const next = [...rows];
      next[index] = { cv, status: 'not-read', value: null, ...change };
      return next;
    });
  }
}
