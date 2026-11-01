import * as Icons from "lucide-react"
import {
  Activity,
  AlertTriangle,
  Check,
  CornerDownRight,
  Flame,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Habit } from "@/hooks/useTracker"
import { dateKey } from "@/lib/pageApps"
import {
  TIME_OF_DAY,
  currentTimeOfDay,
  isDailyHabit,
  neverMissTwiceRun,
  orderByStack,
  recoveryState,
  type CheckInMode,
} from "@/lib/habits"

type TodayRitualProps = {
  habits: Habit[]
  logs: Record<string, boolean>
  miniLogs: Record<string, boolean>
  toggleHabit: (habitId: string, date: Date, mode?: CheckInMode) => unknown
}

/** Today's habits, grouped by time of day, in stack order. */
export function TodayRitual({
  habits,
  logs,
  miniLogs,
  toggleHabit,
}: TodayRitualProps) {
  const today = new Date()
  const todayStr = dateKey(today)
  const now = currentTimeOfDay(today)
  const keyOf = (habit: Habit) => `${habit.id}-${todayStr}`
  const doneCount = habits.filter((habit) => logs[keyOf(habit)]).length
  const rescues = habits.filter(
    (habit) =>
      isDailyHabit(habit) && recoveryState(habit, logs, today) === "rescue"
  ).length

  const groups = TIME_OF_DAY.map((slot) => ({
    ...slot,
    items: orderByStack(
      habits.filter((habit) => (habit.time_of_day ?? "anytime") === slot.id)
    ),
  })).filter((group) => group.items.length)

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-bold">Today's ritual</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stacked habits follow the one they're anchored to. On hard days, do
            the 2-minute version.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rescues > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {rescues} to rescue
            </span>
          )}
          <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {doneCount} of {habits.length} done
          </span>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {groups.map((group) => {
          const SlotIcon =
            (Icons as unknown as Record<string, Icons.LucideIcon>)[
              group.icon
            ] ?? Activity
          const groupDone = group.items.filter(({ habit }) => logs[keyOf(habit)])
            .length
          return (
            <section key={group.id} aria-label={group.label}>
              <div className="flex items-center gap-2 bg-muted/35 px-4 py-2 sm:px-5">
                <SlotIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </h3>
                {group.id === now && (
                  <span className="rounded bg-foreground px-1.5 py-px text-[9px] font-bold tracking-wider text-background uppercase">
                    Now
                  </span>
                )}
                <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {groupDone}/{group.items.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {group.items.map(({ habit, stackedOn }) => (
                  <RitualRow
                    key={habit.id}
                    habit={habit}
                    stackedOn={stackedOn}
                    done={Boolean(logs[keyOf(habit)])}
                    mini={Boolean(logs[keyOf(habit)] && miniLogs[keyOf(habit)])}
                    logs={logs}
                    today={today}
                    onToggle={(mode) => void toggleHabit(habit.id, today, mode)}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function RitualRow({
  habit,
  stackedOn,
  done,
  mini,
  logs,
  today,
  onToggle,
}: {
  habit: Habit
  stackedOn: Habit | null
  done: boolean
  mini: boolean
  logs: Record<string, boolean>
  today: Date
  onToggle: (mode: CheckInMode) => void
}) {
  const HabitIcon =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[habit.icon_name] ??
    Activity
  const daily = isDailyHabit(habit)
  const state = daily ? recoveryState(habit, logs, today) : null
  const run = daily ? neverMissTwiceRun(habit, logs, today) : 0
  const anchor = stackedOn?.title ?? habit.anchor?.trim()

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5",
        stackedOn && "sm:pl-12",
        state === "rescue" && "bg-amber-500/[0.06]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {stackedOn && (
          <CornerDownRight
            aria-hidden
            className="-ml-1 h-4 w-4 shrink-0 text-muted-foreground"
          />
        )}
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            done ? "bg-foreground text-background" : "bg-muted text-foreground"
          )}
        >
          <HabitIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {anchor && (
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              After {anchor}
            </p>
          )}
          <p
            className={cn(
              "truncate text-sm font-semibold",
              done && "text-muted-foreground line-through decoration-1"
            )}
          >
            {habit.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            {habit.identity?.trim() && (
              <span className="text-muted-foreground">
                A vote for{" "}
                <span className="font-semibold text-foreground">
                  I am {habit.identity.trim()}
                </span>
              </span>
            )}
            <RecoveryBadge state={state} run={run} />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {habit.mini_version?.trim() && (
          <Button
            type="button"
            variant={mini ? "secondary" : "outline"}
            size="sm"
            aria-pressed={mini}
            onClick={() => onToggle("mini")}
            title={`2-minute version: ${habit.mini_version.trim()}`}
            className="h-8 max-w-56 gap-1.5 rounded-lg text-xs"
          >
            {mini ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <span className="shrink-0 font-bold tabular-nums">2m</span>
            )}
            <span className="truncate">{habit.mini_version.trim()}</span>
          </Button>
        )}
        <Button
          type="button"
          variant={done && !mini ? "default" : "outline"}
          size="sm"
          aria-pressed={done && !mini}
          onClick={() => onToggle("full")}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Check className="h-3.5 w-3.5" />
          {done && !mini ? "Done" : "Mark done"}
        </Button>
      </div>
    </li>
  )
}

function RecoveryBadge({
  state,
  run,
}: {
  state: ReturnType<typeof recoveryState> | null
  run: number
}) {
  if (state === "rescue")
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3 w-3" /> Missed yesterday · never miss
        twice
      </span>
    )
  if (state === "fresh-start")
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
        <RotateCcw className="h-3 w-3" /> Fresh start today
      </span>
    )
  if (state && run >= 2)
    return (
      <span
        className="inline-flex items-center gap-1 font-semibold text-muted-foreground"
        title="Days since you last missed twice in a row"
      >
        <Flame className="h-3 w-3" /> {run}-day run
      </span>
    )
  return null
}
