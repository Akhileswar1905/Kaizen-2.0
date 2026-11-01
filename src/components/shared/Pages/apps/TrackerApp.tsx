import { useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import {
  CalendarDays,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Target,
  Trophy,
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
import { dateKey, streakFrom, todayKey } from "@/lib/pageApps"
import type { TrackerContent } from "@/lib/workspace"

const CHART_DAYS = 14

export function TrackerApp({
  initial,
  onChange,
}: {
  initial?: TrackerContent
  onChange: (tracker: TrackerContent) => void
}) {
  const [tracker, setTracker] = useState<TrackerContent>(
    () => initial ?? { unit: "times", goal: 1, steps: [1], log: {} }
  )
  const [selected, setSelected] = useState(todayKey)
  const [custom, setCustom] = useState("")
  const today = todayKey()
  const value = tracker.log[selected] ?? 0
  const goal = Math.max(tracker.goal, 0)
  const progress = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0
  const goalMet = goal > 0 && value >= goal

  const update = (next: TrackerContent) => {
    setTracker(next)
    onChange(next)
  }

  const setValue = (amount: number) => {
    const log = { ...tracker.log }
    const rounded = Math.max(0, Math.round(amount * 100) / 100)
    if (rounded) log[selected] = rounded
    else delete log[selected]
    update({ ...tracker, log })
  }

  const met = (key: string) => goal > 0 && (tracker.log[key] ?? 0) >= goal
  const streak = streakFrom(met)
  const chart = Array.from({ length: CHART_DAYS }, (_, index) => {
    const key = dateKey(addDays(new Date(), index - (CHART_DAYS - 1)))
    return { key, value: tracker.log[key] ?? 0 }
  })
  const chartMax = Math.max(goal, ...chart.map((day) => day.value), 1)
  const last7 = chart.slice(-7)
  const average = last7.reduce((sum, day) => sum + day.value, 0) / 7
  const last30Met = Array.from({ length: 30 }, (_, index) =>
    met(dateKey(addDays(new Date(), -index)))
  ).filter(Boolean).length
  const best = Object.entries(tracker.log).sort(([, a], [, b]) => b - a)[0]

  const smallestStep = Math.min(...(tracker.steps.length ? tracker.steps : [1]))
  const format1 = (amount: number) =>
    amount.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground">
                {selected === today
                  ? "TODAY"
                  : format(parseISO(selected), "EEEE d MMMM").toUpperCase()}
              </p>
              {selected !== today && (
                <button
                  type="button"
                  onClick={() => setSelected(today)}
                  className="mt-0.5 text-xs font-bold text-primary hover:underline"
                >
                  Back to today
                </button>
              )}
            </div>
            <TrackerSettings
              tracker={tracker}
              onChange={(changes) => update({ ...tracker, ...changes })}
            />
          </div>

          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div
              className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${goalMet ? "oklch(0.7 0.16 150)" : "var(--foreground)"} ${progress * 3.6}deg, var(--muted) 0deg)`,
              }}
            >
              <div className="flex h-[84%] w-[84%] flex-col items-center justify-center rounded-full bg-card">
                <span className="text-4xl font-extrabold tabular-nums">
                  {format1(value)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  of {format1(goal)} {tracker.unit}
                </span>
              </div>
            </div>

            <div className="w-full min-w-0 flex-1 space-y-3">
              <p
                className={cn(
                  "text-sm font-bold",
                  goalMet
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {goalMet
                  ? "Goal reached. Nice work!"
                  : goal
                    ? `${format1(Math.max(0, goal - value))} ${tracker.unit} to go`
                    : "Set a daily goal in settings"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl"
                  disabled={!value}
                  onClick={() => setValue(value - smallestStep)}
                  aria-label={`Remove ${smallestStep}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                {tracker.steps.map((step) => (
                  <Button
                    key={step}
                    className="h-11 gap-1 rounded-xl px-4 text-base font-bold"
                    onClick={() => setValue(value + step)}
                  >
                    <Plus className="h-4 w-4" /> {format1(step)}
                  </Button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const amount = Number(custom)
                  if (!Number.isFinite(amount) || !custom.trim()) return
                  setValue(value + amount)
                  setCustom("")
                }}
                className="flex max-w-xs gap-2"
              >
                <Input
                  type="number"
                  step="any"
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder={`Other amount (${tracker.unit})`}
                  className="h-9 rounded-lg"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  disabled={!custom.trim()}
                >
                  Add
                </Button>
              </form>
              {value > 0 && (
                <button
                  type="button"
                  onClick={() => setValue(0)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Reset this day
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Goal streak",
              value: `${streak} ${streak === 1 ? "day" : "days"}`,
              icon: Flame,
              tone: "text-orange-500",
            },
            {
              label: "7-day average",
              value: `${format1(Math.round(average * 10) / 10)}`,
              icon: CalendarDays,
              tone: "text-muted-foreground",
            },
            {
              label: "Goal met (30 days)",
              value: `${last30Met} / 30`,
              icon: Target,
              tone: "text-muted-foreground",
            },
            {
              label: "Best day",
              value: best ? format1(best[1]) : "—",
              icon: Trophy,
              tone: "text-amber-500",
              hint: best ? format(parseISO(best[0]), "d MMM") : undefined,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/70 bg-card p-3"
            >
              <stat.icon className={cn("h-4 w-4", stat.tone)} />
              <p className="mt-1 text-xl font-extrabold tabular-nums">
                {stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stat.label}
                {stat.hint ? ` · ${stat.hint}` : ""}
              </p>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold">Last {CHART_DAYS} days</p>
          <p className="text-xs text-muted-foreground">Tap a day to edit it</p>
        </div>
        <div className="relative mt-4 flex h-40 items-end gap-1.5">
          {goal > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/30"
              style={{ bottom: `${(goal / chartMax) * 100}%` }}
            >
              <span className="absolute -top-4 right-0 text-[10px] font-bold text-muted-foreground">
                goal
              </span>
            </div>
          )}
          {chart.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelected(day.key)}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${format(parseISO(day.key), "d MMM")}: ${format1(day.value)} ${tracker.unit}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-md transition-all",
                  met(day.key)
                    ? "bg-emerald-500/80"
                    : day.value
                      ? "bg-foreground/60"
                      : "bg-muted",
                  day.key === selected &&
                    "ring-2 ring-primary ring-offset-1 ring-offset-card"
                )}
                style={{
                  height: `${Math.max(3, (day.value / chartMax) * 100)}%`,
                }}
              />
              <span
                className={cn(
                  "text-[10px] text-muted-foreground",
                  day.key === today && "font-extrabold text-foreground"
                )}
              >
                {format(parseISO(day.key), "EEEEE")}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function TrackerSettings({
  tracker,
  onChange,
}: {
  tracker: TrackerContent
  onChange: (changes: Partial<TrackerContent>) => void
}) {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState(tracker.unit)
  const [goal, setGoal] = useState(String(tracker.goal))
  const [steps, setSteps] = useState(tracker.steps.join(", "))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setUnit(tracker.unit)
          setGoal(String(tracker.goal))
          setSteps(tracker.steps.join(", "))
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg">
          <Settings2 className="h-3.5 w-3.5" /> Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-xl p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const parsedSteps = steps
              .split(",")
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isFinite(value) && value > 0)
              .slice(0, 5)
            onChange({
              unit: unit.trim() || "times",
              goal: Math.max(0, Number(goal) || 0),
              steps: parsedSteps.length ? parsedSteps : [1],
            })
            setOpen(false)
          }}
          className="space-y-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="tracker-unit" className="text-xs">
              Unit
            </Label>
            <Input
              id="tracker-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              maxLength={20}
              placeholder="glasses, minutes, pages…"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tracker-goal" className="text-xs">
              Daily goal
            </Label>
            <Input
              id="tracker-goal"
              type="number"
              min="0"
              step="any"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tracker-steps" className="text-xs">
              Quick-add buttons (comma separated, up to 5)
            </Label>
            <Input
              id="tracker-steps"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              placeholder="1, 5, 10"
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" className="w-full">
            Save settings
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
