// Neutralize formula prefixes (=, +, -, @) even after leading whitespace or control chars,
// as well as leading tabs/carriage returns.
// eslint-disable-next-line no-control-regex
const FORMULA_PREFIX_REGEX = /^[\s\u0000-\u001F\u007F]*[=+\-@]|^[\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_PREFIX_REGEX.test(str)) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}
