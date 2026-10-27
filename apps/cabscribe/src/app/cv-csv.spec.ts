import { CvScanRow } from 'common';
import { buildCvCsv, cvCsvFileName, formatCvValue } from './cv-csv';

const row = (cv: number, status: CvScanRow['status'], value: number | null): CvScanRow =>
  ({ cv, status, value, message: '' }) as unknown as CvScanRow;

describe('cv-csv', () => {
  it('formats values', () => {
    expect(formatCvValue(10, 'decimal')).toBe('10');
    expect(formatCvValue(10, 'hex')).toBe('0x0A');
    expect(formatCvValue(5, 'binary')).toBe('0b00000101');
    expect(formatCvValue(null, 'hex')).toBe('');
  });

  it('builds quoted CSV with BOM and values only for read rows', () => {
    const csv = buildCvCsv(
      [row(1, 'value', 3), row(2, 'failed', null)],
      (cv) => (cv === 1 ? 'Address, "short"' : '')
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe(
      '\uFEFFCV,Value,Status,Description\r\n1,3,Value,"Address, ""short"""\r\n2,,Failed,\r\n'
    );
  });

  it('names the file', () => {
    expect(cvCsvFileName(3, new Date(2026, 0, 5))).toBe('cabscribe-cvs-target-3-2026-01-05.csv');
  });
});
