export function parseInteger(
  rawValue: string | number | null,
  minimum: number
): number | null {
  if (rawValue === null || String(rawValue).trim() === '') {
    return null;
  }
  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= minimum ? value : null;
}
