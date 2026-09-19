export interface CsvColumn<T> {
  key: string
  /** Header text written to the file. */
  label: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Quote when the value contains a delimiter, a quote, or a newline; double any quotes.
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** RFC 4180-ish CSV. CRLF line endings so Excel opens it without complaint. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.label)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  )
  return [header, ...body].join('\r\n')
}

/** Triggers a browser download without a server round-trip. */
export function downloadCsv(filename: string, csv: string): void {
  // The BOM makes Excel read it as UTF-8, which matters for the "—" in empty cells.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Filename stamp, e.g. "trials-agentic-2026-09-18.csv". */
export function csvFilename(prefix: string, suffix?: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `${prefix}${suffix ? `-${suffix}` : ''}-${stamp}.csv`
}
