import { CvScanRow, CvScanRowStatus } from 'common';

export type CvValueFormat = 'decimal' | 'hex' | 'binary';

export const CV_STATUS_LABELS: Record<CvScanRowStatus, string> = {
  'not-read': 'Not read',
  reading: 'Reading',
  value: 'Value',
  unsupported: 'Unsupported',
  failed: 'Failed',
  'not-applicable': 'Not applicable',
};

export function formatCvValue(
  value: number | null,
  format: CvValueFormat
): string {
  if (value === null) {
    return '';
  }
  switch (format) {
    case 'hex':
      return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
    case 'binary':
      return `0b${value.toString(2).padStart(8, '0')}`;
    default:
      return String(value);
  }
}

function csvField(field: string | number): string {
  const text = String(field);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a UTF-8 byte-order mark so Excel detects the encoding. */
export function buildCvCsv(
  rows: readonly CvScanRow[],
  describe: (cv: number) => string
): string {
  const lines = [
    ['CV', 'Value', 'Status', 'Description'],
    ...rows.map((row) => [
      row.cv,
      row.status === 'value' && row.value !== null ? row.value : '',
      CV_STATUS_LABELS[row.status],
      describe(row.cv),
    ]),
  ].map((line) => line.map(csvField).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function cvCsvFileName(address: number, date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `cabscribe-cvs-target-${address}-${day}.csv`;
}

export function downloadTextFile(
  fileName: string,
  content: string,
  type = 'text/csv;charset=utf-8'
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
