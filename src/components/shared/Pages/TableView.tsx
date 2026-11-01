import { createElement, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CircleChevronDown,
  ExternalLink,
  Hash,
  Link2,
  Plus,
  Search,
  SquareCheck,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  newId,
  type TableCellValue,
  type TableColumn,
  type TableColumnType,
  type TableContent,
} from "@/lib/workspace"

const COLUMN_TYPES: {
  type: TableColumnType
  label: string
  icon: LucideIcon
}[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "number", label: "Number", icon: Hash },
  { type: "checkbox", label: "Checkbox", icon: SquareCheck },
  { type: "select", label: "Select", icon: CircleChevronDown },
  { type: "date", label: "Date", icon: Calendar },
  { type: "url", label: "URL", icon: Link2 },
]

const typeIcon = (type: TableColumnType) =>
  COLUMN_TYPES.find((item) => item.type === type)?.icon ?? Type

// Select options get a stable colour from their position.
const OPTION_STYLES = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
]

type Sort = { columnId: string; direction: 1 | -1 } | null

const asNumber = (value: TableCellValue) =>
  value === null || value === "" ? null : Number(value)

function compare(column: TableColumn, a: TableCellValue, b: TableCellValue) {
  if (column.type === "checkbox") return Number(a === true) - Number(b === true)
  if (column.type === "number")
    return (asNumber(a) ?? -Infinity) - (asNumber(b) ?? -Infinity)
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
  })
}

const emptyTable = (): TableContent => ({
  columns: [{ id: newId(), name: "Name", type: "text" }],
  rows: [],
})

export function TableView({
  initial,
  onChange,
}: {
  initial?: TableContent
  onChange: (table: TableContent) => void
}) {
  const [table, setTable] = useState<TableContent>(
    () => initial ?? emptyTable()
  )
  const [sort, setSort] = useState<Sort>(null)
  const [search, setSearch] = useState("")

  const update = (next: TableContent) => {
    setTable(next)
    onChange(next)
  }

  const updateColumn = (columnId: string, changes: Partial<TableColumn>) =>
    update({
      ...table,
      columns: table.columns.map((column) =>
        column.id === columnId ? { ...column, ...changes } : column
      ),
    })

  const deleteColumn = (columnId: string) => {
    if (sort?.columnId === columnId) setSort(null)
    update({
      columns: table.columns.filter((column) => column.id !== columnId),
      rows: table.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).filter(([key]) => key !== columnId)
        ),
      })),
    })
  }

  const addColumn = () =>
    update({
      ...table,
      columns: [
        ...table.columns,
        {
          id: newId(),
          name: `Column ${table.columns.length + 1}`,
          type: "text",
        },
      ],
    })

  const addRow = () =>
    update({ ...table, rows: [...table.rows, { id: newId(), cells: {} }] })

  const setCell = (rowId: string, columnId: string, value: TableCellValue) =>
    update({
      ...table,
      rows: table.rows.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [columnId]: value } }
          : row
      ),
    })

  const deleteRow = (rowId: string) =>
    update({ ...table, rows: table.rows.filter((row) => row.id !== rowId) })

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    let rows = query
      ? table.rows.filter((row) =>
          Object.values(row.cells).some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(query)
          )
        )
      : table.rows
    const sortColumn =
      sort && table.columns.find((column) => column.id === sort.columnId)
    if (sort && sortColumn)
      rows = [...rows].sort(
        (a, b) =>
          compare(
            sortColumn,
            a.cells[sortColumn.id] ?? null,
            b.cells[sortColumn.id] ?? null
          ) * sort.direction
      )
    return rows
  }, [table, sort, search])

  const summary = (column: TableColumn) => {
    const values = table.rows.map((row) => row.cells[column.id] ?? null)
    if (column.type === "number") {
      const numbers = values
        .map(asNumber)
        .filter(
          (value): value is number => value !== null && !Number.isNaN(value)
        )
      return numbers.length
        ? `Sum ${numbers.reduce((sum, value) => sum + value, 0).toLocaleString()}`
        : ""
    }
    if (column.type === "checkbox")
      return `${values.filter((value) => value === true).length} of ${values.length} checked`
    const filled = values.filter(
      (value) => value !== null && value !== ""
    ).length
    return filled ? `${filled} filled` : ""
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rows…"
            className="h-9 rounded-xl pl-9"
          />
        </div>
        {sort && (
          <button
            type="button"
            onClick={() => setSort(null)}
            className="text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Clear sort
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/70">
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  className="min-w-40 border-r border-border/50 p-0 text-left font-semibold"
                >
                  <ColumnHeader
                    column={column}
                    sort={sort?.columnId === column.id ? sort.direction : null}
                    canDelete={table.columns.length > 1}
                    onChange={(changes) => updateColumn(column.id, changes)}
                    onSort={(direction) =>
                      setSort({ columnId: column.id, direction })
                    }
                    onDelete={() => deleteColumn(column.id)}
                  />
                </th>
              ))}
              <th className="w-10 p-0">
                <button
                  type="button"
                  onClick={addColumn}
                  title="Add column"
                  aria-label="Add column"
                  className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-border/50 last:border-b-0 hover:bg-muted/30"
              >
                {table.columns.map((column) => (
                  <td
                    key={column.id}
                    className="border-r border-border/50 p-0 align-middle"
                  >
                    <Cell
                      column={column}
                      value={row.cells[column.id] ?? null}
                      onChange={(value) => setCell(row.id, column.id, value)}
                    />
                  </td>
                ))}
                <td className="w-10 p-0 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    aria-label="Delete row"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={table.columns.length + 1}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {search ? "No rows match your search." : "No rows yet."}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/70 text-xs text-muted-foreground">
              {table.columns.map((column) => (
                <td
                  key={column.id}
                  className="px-3 py-2 font-semibold tabular-nums"
                >
                  {summary(column)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-lg text-muted-foreground"
        onClick={addRow}
      >
        <Plus className="h-4 w-4" /> New row
      </Button>
    </div>
  )
}

function ColumnHeader({
  column,
  sort,
  canDelete,
  onChange,
  onSort,
  onDelete,
}: {
  column: TableColumn
  sort: 1 | -1 | null
  canDelete: boolean
  onChange: (changes: Partial<TableColumn>) => void
  onSort: (direction: 1 | -1) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2 px-3 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {createElement(typeIcon(column.type), {
            className: "h-3.5 w-3.5 shrink-0",
          })}
          <span className="truncate text-foreground">
            {column.name || "Untitled"}
          </span>
          {sort &&
            (sort === 1 ? (
              <ArrowUp className="ml-auto h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="ml-auto h-3.5 w-3.5" />
            ))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 rounded-xl p-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`column-name-${column.id}`} className="text-xs">
            Name
          </Label>
          <Input
            id={`column-name-${column.id}`}
            value={column.name}
            onChange={(event) => onChange({ name: event.target.value })}
            maxLength={60}
            className="h-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Type</Label>
          <div className="grid grid-cols-3 gap-1">
            {COLUMN_TYPES.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() =>
                  onChange({
                    type: option.type,
                    options:
                      option.type === "select"
                        ? (column.options ?? ["Option 1"])
                        : column.options,
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold",
                  column.type === option.type
                    ? "border-foreground/40 bg-muted"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50"
                )}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {column.type === "select" && (
          <div className="grid gap-1.5">
            <Label htmlFor={`column-options-${column.id}`} className="text-xs">
              Options (comma separated)
            </Label>
            <Input
              id={`column-options-${column.id}`}
              defaultValue={(column.options ?? []).join(", ")}
              onBlur={(event) =>
                onChange({
                  options: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              className="h-9"
            />
          </div>
        )}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={() => {
              onSort(1)
              setOpen(false)
            }}
          >
            <ArrowUp className="h-3.5 w-3.5" /> Sort A→Z
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={() => {
              onSort(-1)
              setOpen(false)
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" /> Sort Z→A
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-xs text-destructive hover:text-destructive"
          disabled={!canDelete}
          onClick={() => {
            onDelete()
            setOpen(false)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete column
        </Button>
      </PopoverContent>
    </Popover>
  )
}

const cellInput =
  "h-10 w-full bg-transparent px-3 text-sm font-normal outline-none focus:bg-muted/40"

function Cell({
  column,
  value,
  onChange,
}: {
  column: TableColumn
  value: TableCellValue
  onChange: (value: TableCellValue) => void
}) {
  switch (column.type) {
    case "checkbox":
      return (
        <div className="flex h-10 items-center px-3">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-foreground"
            aria-label={column.name}
          />
        </div>
      )
    case "number":
      return (
        <input
          type="number"
          value={
            value === null || value === "" || Number.isNaN(Number(value))
              ? ""
              : Number(value)
          }
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value)
            )
          }
          className={cn(cellInput, "text-right tabular-nums")}
          aria-label={column.name}
        />
      )
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={cellInput}
          aria-label={column.name}
        />
      )
    case "select": {
      const options = column.options ?? []
      const current = typeof value === "string" ? value : ""
      const index = options.indexOf(current)
      return (
        <div className="flex h-10 items-center px-2">
          <select
            value={current}
            onChange={(event) => onChange(event.target.value || null)}
            className={cn(
              "max-w-full cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold outline-none",
              index >= 0
                ? OPTION_STYLES[index % OPTION_STYLES.length]
                : "bg-transparent text-muted-foreground"
            )}
            aria-label={column.name}
          >
            <option value="">—</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {current && index < 0 && <option value={current}>{current}</option>}
          </select>
        </div>
      )
    }
    case "url": {
      const text = typeof value === "string" ? value : ""
      const href = /^https?:\/\//i.test(text) ? text : `https://${text}`
      return (
        <div className="flex items-center">
          <input
            type="url"
            value={text}
            onChange={(event) => onChange(event.target.value || null)}
            placeholder="https://"
            className={cellInput}
            aria-label={column.name}
          />
          {text && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="px-2 text-muted-foreground hover:text-foreground"
              aria-label="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )
    }
    default:
      return (
        <input
          type="text"
          value={value === null ? "" : String(value)}
          onChange={(event) => onChange(event.target.value)}
          className={cellInput}
          aria-label={column.name}
        />
      )
  }
}
