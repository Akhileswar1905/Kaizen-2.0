import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns"
import { dateKey } from "@/lib/pageApps"

export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime"
export type CheckInMode = "full" | "mini"

export const TIME_OF_DAY: {
  id: TimeOfDay
  label: string
  icon: string
}[] = [
  { id: "morning", label: "Morning", icon: "Sunrise" },
  { id: "afternoon", label: "Afternoon", icon: "Sun" },
  { id: "evening", label: "Evening", icon: "Moon" },
  { id: "anytime", label: "Anytime", icon: "Clock" },
]

/** The part of the day it is now, for highlighting the matching group. */
export const currentTimeOfDay = (now = new Date()): TimeOfDay => {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}

export type HabitKaizenValues = {
  identity: string
  mini_version: string
  anchor: string
  time_of_day: TimeOfDay
}

export const EMPTY_KAIZEN_VALUES: HabitKaizenValues = {
  identity: "",
  mini_version: "",
  anchor: "",
  time_of_day: "anytime",
}

export const kaizenValuesOf = (habit: Partial<HabitKaizenValues>) => ({
  identity: habit.identity ?? "",
  mini_version: habit.mini_version ?? "",
  anchor: habit.anchor ?? "",
  time_of_day: habit.time_of_day ?? "anytime",
})

/** Columns added by supabase/plans_and_habits.sql. */
export const HABIT_V2_FIELDS = [
  "identity",
  "mini_version",
  "anchor",
  "time_of_day",
] as const

export const isMissingHabitColumn = (message: string) =>
  [...HABIT_V2_FIELDS, "is_mini"].some((field) => message.includes(field))

type HabitLike = {
  id: string
  title: string
  target_days: number
  is_archived: boolean
  identity?: string
  anchor?: string
  created_at?: string
}
type Logs = Record<string, boolean>

const logKey = (habitId: string, date: Date) => `${habitId}-${dateKey(date)}`

/** The day a habit was created, or null when the row doesn't say. */
const createdDay = (habit: HabitLike) =>
  habit.created_at ? startOfDay(parseISO(habit.created_at)) : null

/** "Never miss twice" only applies to habits meant for every day. */
export const isDailyHabit = (habit: HabitLike) => habit.target_days >= 7

export type RecoveryState = "done" | "on-track" | "rescue" | "fresh-start"

/**
 * Never miss twice: missing once is life, missing twice is the start of a new
 * habit. "rescue" means yesterday was missed, so today matters most.
 */
export function recoveryState(
  habit: HabitLike,
  logs: Logs,
  today = new Date()
): RecoveryState {
  if (logs[logKey(habit.id, today)]) return "done"
  const yesterday = addDays(today, -1)
  const created = createdDay(habit)
  const existed = (day: Date) => !created || created <= startOfDay(day)
  if (!existed(yesterday) || logs[logKey(habit.id, yesterday)])
    return "on-track"
  const dayBefore = addDays(today, -2)
  if (!existed(dayBefore) || logs[logKey(habit.id, dayBefore)]) return "rescue"
  return "fresh-start"
}

/**
 * Days since this habit was last missed two days in a row. Single misses
 * don't break the run.
 */
export function neverMissTwiceRun(
  habit: HabitLike,
  logs: Logs,
  today = new Date()
): number {
  const created = createdDay(habit)
  let day = logs[logKey(habit.id, today)] ? today : addDays(today, -1)
  let run = 0
  let missesInARow = 0
  for (let i = 0; i < 1000; i++) {
    if (created && startOfDay(day) < created) break
    if (logs[logKey(habit.id, day)]) missesInARow = 0
    else if (++missesInARow === 2) {
      run -= 1 // the first miss of the pair belongs to the break
      break
    }
    run++
    day = addDays(day, -1)
  }
  return Math.max(0, run)
}

export type IdentitySummary = {
  identity: string
  habits: string[]
  /** Every check-in ever made for these habits. */
  votes: number
  /** Check-ins in the last `days` days. */
  recentVotes: number
  /** Recent votes against what the habits' weekly targets ask for (0-1). */
  strength: number
}

/**
 * Every check-in is a vote for the kind of person you want to be. Habits that
 * share an identity ("a healthy person") pool their votes.
 */
export function identitySummaries(
  habits: HabitLike[],
  logs: Logs,
  days = 30,
  today = new Date()
): IdentitySummary[] {
  const since = dateKey(addDays(today, -(days - 1)))
  const until = dateKey(today)
  const groups = new Map<string, IdentitySummary & { expected: number }>()

  for (const habit of habits) {
    const identity = habit.identity?.trim()
    if (habit.is_archived || !identity) continue
    const id = identity.toLowerCase()
    const group = groups.get(id) ?? {
      identity,
      habits: [],
      votes: 0,
      recentVotes: 0,
      strength: 0,
      expected: 0,
    }
    group.habits.push(habit.title)

    const prefix = `${habit.id}-`
    for (const [key, done] of Object.entries(logs)) {
      if (!done || !key.startsWith(prefix)) continue
      group.votes++
      const date = key.slice(prefix.length)
      if (date >= since && date <= until) group.recentVotes++
    }

    const created = createdDay(habit)
    const activeDays = created
      ? Math.min(days, differenceInCalendarDays(today, created) + 1)
      : days
    group.expected += (Math.max(1, activeDays) * habit.target_days) / 7
    groups.set(id, group)
  }

  return [...groups.values()]
    .map(({ expected, ...group }) => ({
      ...group,
      strength: expected ? Math.min(1, group.recentVotes / expected) : 0,
    }))
    .sort((a, b) => b.recentVotes - a.recentVotes || b.votes - a.votes)
}

export type CurvePoint = { date: string; value: number }

/**
 * The 1% curve. Each day you improve by up to 1% or slip by up to 1%,
 * depending on how well you kept your habits over the past week (a 2-minute
 * check-in counts half): 1.01^365 is 37x, 0.99^365 is 0.03x.
 */
export function compoundingCurve(
  habits: HabitLike[],
  logs: Logs,
  miniLogs: Logs,
  days = 90,
  today = new Date()
): CurvePoint[] {
  const active = habits.filter((habit) => !habit.is_archived)
  if (!active.length) return []

  // Start on the first day any habit existed, at most `days` ago.
  const earliest = active
    .map(createdDay)
    .reduce<Date | null>(
      (min, day) => (day && (!min || day < min) ? day : min),
      null
    )
  const windowStart = startOfDay(addDays(today, -(days - 1)))
  const start = earliest && earliest > windowStart ? earliest : windowStart

  const credit = (habitId: string, day: Date) => {
    const key = logKey(habitId, day)
    return logs[key] ? (miniLogs[key] ? 0.5 : 1) : 0
  }

  const points: CurvePoint[] = [
    { date: dateKey(addDays(start, -1)), value: 1 },
  ]
  let value = 1
  for (
    let day = start;
    differenceInCalendarDays(today, day) >= 0;
    day = addDays(day, 1)
  ) {
    let done = 0
    let expected = 0
    for (const habit of active) {
      const created = createdDay(habit)
      for (let back = 0; back < 7; back++) {
        const past = addDays(day, -back)
        if (created && startOfDay(past) < created) break
        done += credit(habit.id, past)
        expected += habit.target_days / 7
      }
    }
    if (expected > 0) {
      const consistency = Math.min(1, done / expected)
      value *= 1 + 0.01 * (2 * consistency - 1)
    }
    points.push({ date: dateKey(day), value })
  }
  return points
}

/**
 * Orders habits so each one follows the habit it's stacked on ("After
 * meditating, I will journal"). Returns the habit and whether it's stacked.
 */
export function orderByStack<T extends HabitLike>(
  habits: T[]
): { habit: T; stackedOn: T | null }[] {
  const byTitle = new Map(
    habits.map((habit) => [habit.title.trim().toLowerCase(), habit])
  )
  const parentOf = (habit: T) => {
    const parent = byTitle.get(habit.anchor?.trim().toLowerCase() ?? "")
    return parent && parent.id !== habit.id ? parent : null
  }

  const ordered: { habit: T; stackedOn: T | null }[] = []
  const placed = new Set<string>()
  const place = (habit: T, stackedOn: T | null) => {
    if (placed.has(habit.id)) return
    placed.add(habit.id)
    ordered.push({ habit, stackedOn })
    for (const child of habits)
      if (parentOf(child)?.id === habit.id) place(child, habit)
  }

  for (const habit of habits) if (!parentOf(habit)) place(habit, null)
  // Anything left is in a loop (A after B after A); show it unstacked.
  for (const habit of habits) place(habit, null)
  return ordered
}
