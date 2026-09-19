import { Fragment, type ReactNode } from 'react'

import { SkeletonRows } from './Skeleton'

export interface Column<T> {
  /** Stable identity, also the sort key reported back to the caller. */
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  /** Providing this makes the column sortable. */
  sortValue?: (row: T) => number | string
  align?: 'left' | 'right'
  /** Tailwind width class, e.g. "w-[140px]". */
  width?: string
  headerClassName?: string
  cellClassName?: string
}

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  /** When set, rows become clickable *and* keyboard-activatable. */
  onRowClick?: (row: T, index: number) => void
  /** Key of the currently expanded row; pairs with renderExpanded. */
  expandedKey?: string | null
  renderExpanded?: (row: T) => ReactNode
  loading?: boolean
  skeletonRows?: number
  /** Rendered in place of the body when rows is empty (and not loading). */
  empty?: ReactNode
  maxHeight?: string
  className?: string
}

/**
 * Dense data table.
 *
 * Rows are focusable and respond to Enter/Space when clickable, so the expandable reasoning
 * view is reachable without a mouse. `aria-sort` is set on the active header.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  onRowClick,
  expandedKey,
  renderExpanded,
  loading = false,
  skeletonRows = 8,
  empty,
  maxHeight,
  className = '',
}: TableProps<T>) {
  const interactive = Boolean(onRowClick)

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue || !onSortChange) return
    const nextDir = sort?.key === column.key && sort.dir === 'asc' ? 'desc' : 'asc'
    onSortChange({ key: column.key, dir: nextDir })
  }

  const columnCount = columns.length

  return (
    <div
      className={`scroll-thin min-h-0 overflow-auto ${className}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key
              const sortable = Boolean(column.sortValue && onSortChange)

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`sticky top-0 z-10 border-b border-border bg-surface-2 px-2.5 py-2 ${
                    column.width ?? ''
                  } ${column.headerClassName ?? ''}`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={`flex w-full items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide transition-colors ${
                        column.align === 'right' ? 'justify-end' : 'justify-start'
                      } ${active ? 'text-blue' : 'text-ink-muted hover:text-ink'}`}
                    >
                      {column.header}
                      <span aria-hidden="true" className="text-[8px]">
                        {active ? (sort?.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    <span
                      className={`flex text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted ${
                        column.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {column.header}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan={columnCount} className="p-0">
                <SkeletonRows rows={skeletonRows} columns={Math.min(columnCount, 5)} />
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columnCount}>{empty}</td>
            </tr>
          )}

          {!loading &&
            rows.map((row, index) => {
              const key = rowKey(row, index)
              const expanded = expandedKey === key && Boolean(renderExpanded)

              return (
                <Fragment key={key}>
                  <tr
                    {...(interactive
                      ? {
                          tabIndex: 0,
                          role: 'button',
                          'aria-expanded': renderExpanded ? expanded : undefined,
                          onClick: () => onRowClick?.(row, index),
                          onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onRowClick?.(row, index)
                            }
                          },
                        }
                      : {})}
                    className={`border-b border-border transition-colors ${
                      interactive ? 'cursor-pointer hover:bg-surface-2' : ''
                    } ${expanded ? 'bg-surface-2' : ''}`}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-2.5 py-1.5 align-middle ${
                          column.align === 'right' ? 'text-right' : ''
                        } ${column.cellClassName ?? ''}`}
                      >
                        {column.cell(row, index)}
                      </td>
                    ))}
                  </tr>

                  {expanded && (
                    <tr className="border-b border-border bg-surface-2">
                      <td colSpan={columnCount} className="px-4 py-3">
                        {renderExpanded?.(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
