import * as React from "react"

import { cn } from "@/lib/utils"

export interface AdminTableColumn<T> {
  key: string
  header: string
  className?: string
  render?: (row: T) => React.ReactNode
}

export interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
  loading?: boolean
  onRowClick?: (row: T) => void
  className?: string
}

export function AdminTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found.",
  loading = false,
  onRowClick,
  className,
}: AdminTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-sa-border bg-sa-surface",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sa-border bg-sa-raised/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sa-muted",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-sa-border">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 animate-pulse-soft rounded bg-sa-raised" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sa-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    "border-b border-sa-border transition-colors last:border-0",
                    onRowClick &&
                      "cursor-pointer hover:bg-sa-raised/60 focus-within:bg-sa-raised/60"
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-sa-text align-middle",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String(
                            (row as Record<string, unknown>)[col.key] ?? "—"
                          )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
