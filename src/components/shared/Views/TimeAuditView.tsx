import { useMemo, useState } from "react"
import { addDays, format, isSameDay, parseISO } from "date-fns"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Loader2,
  Smile,
  Frown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  buildSlots,
  formatSlot,
  useTimeAudit,
  type Quadrant,
  type TimeAuditStats,
} from "@/hooks/useTimeAudit"

const SLOTS = buildSlots(4, 24) // 4:00 AM -> 11:30 PM

/** Compact Y / N switch. Tapping the active choice clears it. */
function YesNo({
  value,
  onChange,
  label,
}: {
  value: boolean | null
  onChange: (next: boolean | null) => void
  label: string
}) {
  const base =
    "h-8 w-9 text-xs font-bold transition-colors first:rounded-l-lg last:rounded-r-lg"
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-lg border border-border/60 bg-muted/30"
    >
      <button
        type="button"
        aria-pressed={value === true}
        onClick={() => onChange(value === true ? null : true)}
        className={cn(
          base,
          value === true
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        Y
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        onClick={() => onChange(value === false ? null : false)}
        className={cn(
          base,
          "border-l border-border/60",
          value === false
            ? "bg-foreground/80 text-background"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        N
      </button>
    </div>
  )
}

const QUADRANTS: Record<
  Quadrant,
  { title: string; hint: string; tone: string }
> = {
  doFirst: {
    title: "Do first",
    hint: "Urgent + Important",
    tone: "bg-primary/15 text-primary",
  },
  schedule: {
    title: "Schedule",
    hint: "Important, not urgent",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  delegate: {
    title: "Delegate",
    hint: "Urgent, not important",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  eliminate: {
    title: "Eliminate",
    hint: "Neither",
    tone: "bg-muted text-muted-foreground",
  },
}

function MatrixCell({ quadrant, value }: { quadrant: Quadrant; value: number }) {
  const q = QUADRANTS[quadrant]
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 p-3 text-center sm:p-4",
        q.tone
      )}
    >
      <span className="text-3xl font-extrabold tabular-nums sm:text-4xl">
        {value}%
      </span>
      <span className="text-xs font-bold">{q.title}</span>
      <span className="hidden text-[10px] opacity-80 sm:block">{q.hint}</span>
    </div>
  )
}

function EisenhowerMatrix({ stats }: { stats: TimeAuditStats }) {
  const { quadrants } = stats
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
      {/* Row labels: Urgent? Yes (top) / No (bottom) */}
      <div className="grid grid-rows-2 text-right text-xs font-semibold text-muted-foreground">
        <span className="flex items-center justify-end pr-1">Urgent</span>
        <span className="flex items-center justify-end pr-1">Not urgent</span>
      </div>

      <div className="grid grid-cols-2 grid-rows-2 divide-x divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 [&>*]:border-border/60">
        <MatrixCell quadrant="delegate" value={quadrants.delegate} />
        <MatrixCell quadrant="doFirst" value={quadrants.doFirst} />
        <MatrixCell quadrant="eliminate" value={quadrants.eliminate} />
        <MatrixCell quadrant="schedule" value={quadrants.schedule} />
      </div>

      <span />
      <div className="grid grid-cols-2 text-center text-xs font-semibold text-muted-foreground">
        <span>Not important</span>
        <span>Important</span>
      </div>
    </div>
  )
}

function DistributionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function TimeAuditView({ onBack }: { onBack: () => void }) {
  const today = useMemo(() => new Date(), [])
  const [activeDate, setActiveDate] = useState(format(today, "yyyy-MM-dd"))
  const { entries, stats, happy, loading, saving, error, updateSlot, setHappy } =
    useTimeAudit(activeDate)

  const date = parseISO(activeDate)
  const isToday = isSameDay(date, today)
  const shift = (days: number) =>
    setActiveDate(format(addDays(date, days), "yyyy-MM-dd"))

  // Highlight the slot we are currently in when looking at today.
  const nowSlot = useMemo(() => {
    const h = today.getHours()
    const m = today.getMinutes() < 30 ? "00" : "30"
    return `${String(h).padStart(2, "0")}:${m}`
  }, [today])

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-6xl animate-in flex-col gap-6 p-4 duration-500 fade-in slide-in-from-bottom-4 md:p-8">
      <header className="flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 sm:items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="mt-1 shrink-0 rounded-full border-border/60 bg-card/50 shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-muted active:scale-95 sm:mt-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <div className="kaizen-page-heading-icon"><Grid2x2 /></div>
              <span className="kaizen-page-heading-title">Time Audit</span>
            </h1>
            <p className="kaizen-page-heading-description">
              Log every 30 minutes, tag it, and see where your day really goes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex w-20 items-center justify-end gap-1.5 text-xs text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </>
            )}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => shift(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-36 text-center">
            <div className="text-sm font-bold">{format(date, "EEE, d MMM")}</div>
            <div className="text-[11px] text-muted-foreground">
              {isToday ? "Today" : format(date, "yyyy")}
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => shift(1)}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => setActiveDate(format(today, "yyyy-MM-dd"))}
            >
              Today
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Time slots */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/50">
          <div className="grid grid-cols-[84px_1fr_auto_auto] items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <span>Time</span>
            <span>Task</span>
            <span className="w-[74px] text-center">Urgent?</span>
            <span className="w-[74px] text-center">Important?</span>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {SLOTS.map((slot) => {
                  const entry = entries[slot]
                  const isNow = isToday && slot === nowSlot
                  return (
                    <li
                      key={slot}
                      className={cn(
                        "grid grid-cols-[84px_1fr_auto_auto] items-center gap-3 px-4 py-1.5",
                        isNow && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          isNow ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {formatSlot(slot)}
                      </span>
                      <Input
                        value={entry?.task ?? ""}
                        onChange={(e) =>
                          updateSlot(slot, { task: e.target.value })
                        }
                        placeholder="What did you do?"
                        aria-label={`Task at ${formatSlot(slot)}`}
                        className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                      <div className="flex w-[74px] justify-center">
                        <YesNo
                          label={`Urgent at ${formatSlot(slot)}`}
                          value={entry?.urgent ?? null}
                          onChange={(urgent) => updateSlot(slot, { urgent })}
                        />
                      </div>
                      <div className="flex w-[74px] justify-center">
                        <YesNo
                          label={`Important at ${formatSlot(slot)}`}
                          value={entry?.important ?? null}
                          onChange={(important) =>
                            updateSlot(slot, { important })
                          }
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Summary */}
        <aside className="min-h-0 space-y-6 overflow-y-auto lg:pr-1">
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold">Eisenhower matrix</h2>
              <span className="text-xs text-muted-foreground">
                {stats.classified} of {stats.filled || stats.classified} tasks
                tagged
              </span>
            </div>
            <EisenhowerMatrix stats={stats} />
          </section>

          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-5">
            <h2 className="text-sm font-bold">Tasks distribution</h2>
            <div className="space-y-3">
              <DistributionRow label="Urgent: Yes" value={stats.urgentYes} />
              <DistributionRow label="Urgent: No" value={stats.urgentNo} />
            </div>
            <div className="space-y-3">
              <DistributionRow
                label="Important: Yes"
                value={stats.importantYes}
              />
              <DistributionRow
                label="Important: No"
                value={stats.importantNo}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-5">
            <h2 className="text-sm font-bold">
              Do I feel happy with how the day went?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={happy === true ? "default" : "outline"}
                className="gap-2 rounded-xl"
                onClick={() => setHappy(happy === true ? null : true)}
              >
                <Smile className="h-4 w-4" /> Yes
              </Button>
              <Button
                variant={happy === false ? "default" : "outline"}
                className="gap-2 rounded-xl"
                onClick={() => setHappy(happy === false ? null : false)}
              >
                <Frown className="h-4 w-4" /> No
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
