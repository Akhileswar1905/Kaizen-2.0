import { useEffect, useMemo, useRef, useState } from "react"
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns"
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useTodos } from "@/hooks/useTodos"
import {
  BLOCK_COLORS,
  fromMinutes,
  toMinutes,
  useTimeBlocks,
  type BlockColor,
  type TimeBlock,
} from "@/hooks/useTimeBlocks"

const HOUR_HEIGHT = 52 // px per hour
const SNAP_MIN = 15
const GRID_HEIGHT = HOUR_HEIGHT * 24
const MIN_BLOCK_PX = 22
const FIRST_VISIBLE_HOUR = 7 // where the grid scrolls to on open

const COLOR_CLASSES: Record<BlockColor, string> = {
  blue: "bg-blue-600 text-white",
  green: "bg-emerald-600 text-white",
  amber: "bg-amber-400 text-amber-950",
  rose: "bg-rose-600 text-white",
  violet: "bg-violet-600 text-white",
  slate: "bg-slate-600 text-white",
}

const WEEK_OPTIONS = { weekStartsOn: 1 as const }

const minToPx = (min: number) => (min / 60) * HOUR_HEIGHT
const snap = (min: number, mode: "floor" | "ceil" | "round" = "round") =>
  Math[mode](min / SNAP_MIN) * SNAP_MIN

function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "pm" : "am"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return ""
  const suffix = hour >= 12 && hour < 24 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12} ${suffix}`
}

function formatHours(minutes: number): string {
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}

interface Placed {
  block: TimeBlock
  col: number
  cols: number
}

/** Side-by-side columns for blocks that overlap in time (Google Calendar style). */
function layoutDay(blocks: TimeBlock[]): Placed[] {
  const sorted = [...blocks].sort(
    (a, b) =>
      toMinutes(a.start) - toMinutes(b.start) ||
      toMinutes(b.end) - toMinutes(a.end)
  )
  const placed: Placed[] = []
  let cluster: Placed[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1

  const closeCluster = () => {
    for (const p of cluster) p.cols = columnEnds.length
    placed.push(...cluster)
    cluster = []
    columnEnds = []
  }

  for (const block of sorted) {
    const start = toMinutes(block.start)
    const end = toMinutes(block.end)
    if (cluster.length > 0 && start >= clusterEnd) closeCluster()
    let col = columnEnds.findIndex((e) => e <= start)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[col] = end
    }
    clusterEnd = cluster.length === 0 ? end : Math.max(clusterEnd, end)
    cluster.push({ block, col, cols: 1 })
  }
  if (cluster.length > 0) closeCluster()
  return placed
}

interface DraftBlock {
  id: string | null
  title: string
  date: string
  start: string
  end: string
  color: string
}

interface DragState {
  date: string
  anchor: number
  current: number
}

export function TimeBlockWeek() {
  const { addTodo } = useTodos()
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), WEEK_OPTIONS)
  )
  const { blocks, loading, error, addBlock, updateBlock, deleteBlock } =
    useTimeBlocks(weekStart)

  const [draft, setDraft] = useState<DraftBlock | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [now, setNow] = useState(() => new Date())

  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to the morning on first paint.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = minToPx(FIRST_VISIBLE_HOUR * 60) - 8
    }
  }, [])

  // Keep the "now" line current.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const byDay = useMemo(() => {
    const map: Record<string, Placed[]> = {}
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd")
      map[key] = layoutDay(blocks.filter((b) => b.date === key))
    }
    return map
  }, [blocks, days])

  const minutesByDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of blocks) {
      map[b.date] = (map[b.date] ?? 0) + toMinutes(b.end) - toMinutes(b.start)
    }
    return map
  }, [blocks])
  const weekMinutes = Object.values(minutesByDay).reduce((a, b) => a + b, 0)

  const openNew = (date: string, startMin: number, endMin: number) => {
    setFormError(null)
    setDraft({
      id: null,
      title: "",
      date,
      start: fromMinutes(startMin),
      end: fromMinutes(Math.min(endMin, 24 * 60 - 1)),
      color: "blue",
    })
  }

  const openExisting = (block: TimeBlock) => {
    setFormError(null)
    setDraft({ ...block })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const title = draft.title.trim()
    if (!title) {
      setFormError("Give the block a title.")
      return
    }
    if (toMinutes(draft.end) <= toMinutes(draft.start)) {
      setFormError("End time must be after the start time.")
      return
    }
    setSaving(true)
    const input = {
      title,
      date: draft.date,
      start: draft.start,
      end: draft.end,
      color: draft.color,
    }
    const isNewBlock = !draft.id
    const ok = draft.id
      ? await updateBlock(draft.id, input)
      : await addBlock(input)
    setSaving(false)
    if (ok) {
      setDraft(null)
      if (isNewBlock) {
        const task = await addTodo(title, "", draft.date)
        if (!task) {
          setLinkError("Time block saved, but its task could not be added. Check your task list connection and try again.")
        } else {
          setLinkError(null)
        }
      }
    }
  }

  const handleDelete = async () => {
    if (!draft?.id) return
    const id = draft.id
    setDraft(null)
    await deleteBlock(id)
  }

  // --- drag to create -------------------------------------------------------
  const minutesAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60
    return Math.max(0, Math.min(24 * 60, raw))
  }

  const onColumnDown = (e: React.PointerEvent<HTMLDivElement>, date: string) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const at = minutesAt(e)
    setDrag({ date, anchor: at, current: at })
  }

  const onColumnMove = (e: React.PointerEvent<HTMLDivElement>, date: string) => {
    if (!drag || drag.date !== date) return
    setDrag({ ...drag, current: minutesAt(e) })
  }

  const onColumnUp = (e: React.PointerEvent<HTMLDivElement>, date: string) => {
    if (!drag || drag.date !== date) return
    const at = minutesAt(e)
    const lo = Math.min(drag.anchor, at)
    const hi = Math.max(drag.anchor, at)
    setDrag(null)

    let start = snap(lo, "floor")
    let end = snap(hi, "ceil")
    if (end - start < 30) {
      // A plain click: default to a one hour block from the nearest half hour.
      start = Math.floor(lo / 30) * 30
      end = start + 60
    }
    openNew(date, start, end)
  }

  const dragPreview = drag
    ? {
        date: drag.date,
        top: minToPx(snap(Math.min(drag.anchor, drag.current), "floor")),
        height: Math.max(
          minToPx(
            snap(Math.max(drag.anchor, drag.current), "ceil") -
              snap(Math.min(drag.anchor, drag.current), "floor")
          ),
          minToPx(SNAP_MIN)
        ),
      }
    : null

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const rangeLabel = `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}`
  const isCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(new Date(), WEEK_OPTIONS)
  )

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-sm font-bold">{rangeLabel}</span>
          {!isCurrentWeek && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 rounded-full"
              onClick={() => setWeekStart(startOfWeek(new Date(), WEEK_OPTIONS))}
            >
              This week
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>
            <span className="font-bold text-foreground">
              {formatHours(weekMinutes)}
            </span>{" "}
            blocked this week
          </span>
          <span className="hidden sm:inline">Drag on a day to add a block</span>
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {linkError && (
        <div role="alert" className="mx-4 mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
          {linkError}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Day headers */}
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border/40">
            <div />
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd")
              const today = isSameDay(day, now)
              return (
                <div
                  key={key}
                  className="flex flex-col items-center gap-0.5 border-l border-border/40 py-2"
                >
                  <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums",
                      today && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <span className="h-3.5 text-[10px] text-muted-foreground tabular-nums">
                    {minutesByDay[key] ? formatHours(minutesByDay[key]) : ""}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Scrollable hours */}
          <div ref={scrollRef} className="max-h-[620px] overflow-y-auto">
            <div
              className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
              style={{ height: GRID_HEIGHT }}
            >
              {/* Hour labels */}
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
                    style={{ top: h * HOUR_HEIGHT }}
                  >
                    {formatHourLabel(h)}
                  </span>
                ))}
              </div>

              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd")
                const today = isSameDay(day, now)
                return (
                  <div
                    key={key}
                    className="relative touch-pan-y border-l border-border/40 select-none"
                    onPointerDown={(e) => onColumnDown(e, key)}
                    onPointerMove={(e) => onColumnMove(e, key)}
                    onPointerUp={(e) => onColumnUp(e, key)}
                    onPointerCancel={() => setDrag(null)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute right-0 left-0 border-t border-border/30"
                        style={{ top: h * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Drag preview */}
                    {dragPreview && dragPreview.date === key && (
                      <div
                        className="pointer-events-none absolute right-1 left-1 rounded-md border-2 border-dashed border-primary bg-primary/15"
                        style={{
                          top: dragPreview.top,
                          height: dragPreview.height,
                        }}
                      />
                    )}

                    {/* Blocks */}
                    {byDay[key].map(({ block, col, cols }) => {
                      const top = minToPx(toMinutes(block.start))
                      const height = Math.max(
                        minToPx(toMinutes(block.end) - toMinutes(block.start)),
                        MIN_BLOCK_PX
                      )
                      const compact = height < 44
                      return (
                        <button
                          key={block.id}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                          onClick={() => openExisting(block)}
                          className={cn(
                            "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight font-semibold shadow-sm ring-1 ring-background/60 transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            COLOR_CLASSES[block.color as BlockColor] ?? "text-white"
                          )}
                          style={{
                            ...(block.color.startsWith("#") ? { backgroundColor: block.color, color: Number.parseInt(block.color.slice(1), 16) > 0xffffff / 2 ? "#172033" : "#ffffff" } : {}),
                            top,
                            height: height - 1,
                            left: `calc(${(col / cols) * 100}% + 2px)`,
                            width: `calc(${100 / cols}% - 4px)`,
                          }}
                          title={`${block.title}, ${formatClock(block.start)} – ${formatClock(block.end)}`}
                        >
                          {compact ? (
                            <span className="block truncate">
                              {block.title}, {formatClock(block.start)}
                            </span>
                          ) : (
                            <>
                              <span className="block truncate">
                                {block.title}
                              </span>
                              <span className="block truncate font-medium opacity-80">
                                {formatClock(block.start)} –{" "}
                                {formatClock(block.end)}
                              </span>
                            </>
                          )}
                        </button>
                      )
                    })}

                    {/* Now line */}
                    {today && (
                      <div
                        className="pointer-events-none absolute right-0 left-0 z-10 flex items-center"
                        style={{ top: minToPx(nowMinutes) }}
                      >
                        <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                        <span className="h-px flex-1 bg-red-500" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft && (
            <form onSubmit={handleSave} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Edit time block" : "New time block"}
                </DialogTitle>
                <DialogDescription>
                  Reserve a slot on your calendar for focused work.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="block-title">Title</Label>
                <Input
                  id="block-title"
                  autoFocus
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Deep work: agent evals"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 space-y-2 sm:col-span-1">
                  <Label htmlFor="block-date">Date</Label>
                  <Input
                    id="block-date"
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      e.target.value &&
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-start">Start</Label>
                  <Input
                    id="block-start"
                    type="time"
                    step={SNAP_MIN * 60}
                    value={draft.start}
                    onChange={(e) =>
                      e.target.value &&
                      setDraft({ ...draft, start: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block-end">End</Label>
                  <Input
                    id="block-end"
                    type="time"
                    step={SNAP_MIN * 60}
                    value={draft.end}
                    onChange={(e) =>
                      e.target.value &&
                      setDraft({ ...draft, end: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Colour</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {BLOCK_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      aria-pressed={draft.color === color}
                      onClick={() => setDraft({ ...draft, color })}
                      className={cn(
                        "h-7 w-7 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        COLOR_CLASSES[color],
                        draft.color === color
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                          : "hover:scale-110"
                      )}
                    />
                  ))}
                  <label className="relative ml-1 flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-sm transition hover:scale-105" title="Choose a custom colour">
                    <input
                      type="color"
                      aria-label="Choose custom time block colour"
                      value={draft.color.startsWith("#") ? draft.color : "#2563eb"}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span className="pointer-events-none text-lg leading-none text-foreground">+</span>
                  </label>
                  {draft.color.startsWith("#") && <span className="text-xs text-muted-foreground">{draft.color.toUpperCase()}</span>}
                </div>
              </div>

              {formError && (
                <p className="text-sm font-medium text-red-600">{formError}</p>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                {draft.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDraft(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {draft.id ? "Save" : "Add block"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
