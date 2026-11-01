import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { dateKey } from "@/lib/pageApps"

export type MetricDef = {
  id: string
  label: string
  /** Shown in the metric picker. */
  group: string
  unit: string
  /** How days combine into one number: total, or average of the days that have data. */
  agg: "sum" | "avg"
  kind: "count" | "money" | "hours" | "mood" | "amount"
  /** Whether a rise is good news (drives the colour of the change indicator). */
  upIsGood: boolean
}

export type Point = { date: string; value: number | null }

// Enough history for a 30-day widget compared with the 30 days before it.
const HISTORY_DAYS = 62

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

const bump = (map: Record<string, number>, key: string, amount: number) => {
  map[key] = (map[key] ?? 0) + amount
}

/**
 * Daily numbers for dashboard widgets. Pass `live` from the dashboard so habit
 * and task widgets update the moment you tick something; without it (e.g. the
 * widget editor preview) the data is fetched.
 */
export function useDashboardMetrics(live?: {
  logs?: Record<string, boolean>
  todos?: { date: string; completed: boolean }[]
}) {
  const { user } = useAuth()
  const userId = user?.id
  const { customPages, formatMoney } = useWorkspace()
  const [expenses, setExpenses] = useState<
    { amount: number; type: string; date: string }[]
  >([])
  const [blocks, setBlocks] = useState<
    { block_date: string; start_time: string; end_time: string }[]
  >([])
  const [fetchedLogs, setFetchedLogs] = useState<
    { log_date: string; is_completed: boolean }[]
  >([])
  const [fetchedTodos, setFetchedTodos] = useState<
    { date: string; completed: boolean }[]
  >([])
  const [loading, setLoading] = useState(Boolean(userId))
  const needsFetchedLiveData = !live

  const load = useCallback(async () => {
    if (!userId) return
    const since = format(addDays(new Date(), -HISTORY_DAYS), "yyyy-MM-dd")
    const today = format(new Date(), "yyyy-MM-dd")
    const [expenseRes, blockRes, logRes, todoRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount,type,date")
        .eq("user_id", userId)
        .gte("date", since),
      supabase
        .from("time_blocks")
        .select("block_date,start_time,end_time")
        .eq("user_id", userId)
        .gte("block_date", since)
        .lte("block_date", today),
      needsFetchedLiveData
        ? supabase
            .from("habit_logs")
            .select("log_date,is_completed")
            .eq("user_id", userId)
            .gte("log_date", since)
        : Promise.resolve({ data: null }),
      needsFetchedLiveData
        ? supabase
            .from("daily_todos")
            .select("date,completed")
            .eq("user_id", userId)
            .gte("date", since)
        : Promise.resolve({ data: null }),
    ])
    if (expenseRes.data) setExpenses(expenseRes.data)
    if (blockRes.data) setBlocks(blockRes.data)
    if (logRes.data) setFetchedLogs(logRes.data)
    if (todoRes.data) setFetchedTodos(todoRes.data)
    setLoading(false)
  }, [userId, needsFetchedLiveData])

  useEffect(() => {
    void load()
    window.addEventListener("focus", load)
    window.addEventListener("kaizen:time-blocks-changed", load)
    return () => {
      window.removeEventListener("focus", load)
      window.removeEventListener("kaizen:time-blocks-changed", load)
    }
  }, [load])

  const metrics = useMemo<MetricDef[]>(() => {
    const list: MetricDef[] = [
      {
        id: "habits.checkins",
        label: "Habit check-ins",
        group: "Habits & planner",
        unit: "check-ins",
        agg: "sum",
        kind: "count",
        upIsGood: true,
      },
      {
        id: "tasks.completed",
        label: "Tasks completed",
        group: "Habits & planner",
        unit: "tasks",
        agg: "sum",
        kind: "count",
        upIsGood: true,
      },
      {
        id: "planner.hours",
        label: "Time blocked",
        group: "Habits & planner",
        unit: "hours",
        agg: "sum",
        kind: "hours",
        upIsGood: true,
      },
      {
        id: "finance.expenses",
        label: "Spending",
        group: "Money",
        unit: "",
        agg: "sum",
        kind: "money",
        upIsGood: false,
      },
      {
        id: "finance.income",
        label: "Income",
        group: "Money",
        unit: "",
        agg: "sum",
        kind: "money",
        upIsGood: true,
      },
    ]
    for (const page of customPages) {
      if (page.kind === "tracker" && page.content.tracker)
        list.push({
          id: `tracker:${page.id}`,
          label: page.title,
          group: "Your trackers",
          unit: page.content.tracker.unit,
          agg: "sum",
          kind: "amount",
          upIsGood: true,
        })
      if (page.kind === "journal")
        list.push({
          id: `mood:${page.id}`,
          label: `${page.title} mood`,
          group: "Your journals",
          unit: "/ 5",
          agg: "avg",
          kind: "mood",
          upIsGood: true,
        })
    }
    return list
  }, [customPages])

  const liveLogs = live?.logs
  const liveTodos = live?.todos

  // metric id -> date -> value
  const daily = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}
    const map = (id: string) => (data[id] ??= {})

    if (liveLogs) {
      for (const [key, done] of Object.entries(liveLogs))
        if (done) bump(map("habits.checkins"), key.slice(-10), 1)
    } else
      for (const log of fetchedLogs)
        if (log.is_completed) bump(map("habits.checkins"), log.log_date, 1)

    for (const todo of liveTodos ?? fetchedTodos)
      if (todo.completed) bump(map("tasks.completed"), todo.date, 1)

    for (const row of expenses)
      bump(
        map(row.type === "income" ? "finance.income" : "finance.expenses"),
        row.date,
        Number(row.amount) || 0
      )

    for (const block of blocks)
      bump(
        map("planner.hours"),
        block.block_date,
        Math.max(
          0,
          toMinutes(block.end_time.slice(0, 5)) -
            toMinutes(block.start_time.slice(0, 5))
        ) / 60
      )

    for (const page of customPages) {
      if (page.kind === "tracker" && page.content.tracker)
        data[`tracker:${page.id}`] = { ...page.content.tracker.log }
      if (page.kind === "journal") {
        const moods = map(`mood:${page.id}`)
        for (const [date, entry] of Object.entries(
          page.content.journal?.entries ?? {}
        ))
          if (entry.mood) moods[date] = entry.mood
      }
    }
    return data
  }, [
    liveLogs,
    liveTodos,
    fetchedLogs,
    fetchedTodos,
    expenses,
    blocks,
    customPages,
  ])

  const metric = useCallback(
    (id?: string) => metrics.find((item) => item.id === id),
    [metrics]
  )

  /** One value per day for the last `days` days (oldest first), ending `offset` days ago. */
  const series = useCallback(
    (id: string, days: number, offset = 0): Point[] => {
      const def = metric(id)
      const values = daily[id] ?? {}
      return Array.from({ length: days }, (_, index) => {
        const date = dateKey(addDays(new Date(), index - (days - 1) - offset))
        const value = values[date]
        return { date, value: value ?? (def?.agg === "avg" ? null : 0) }
      })
    },
    [daily, metric]
  )

  /** The period total (or average) for a metric. */
  const summarize = useCallback(
    (id: string, days: number, offset = 0): number | null => {
      const def = metric(id)
      const values = series(id, days, offset)
        .map((point) => point.value)
        .filter((value): value is number => value !== null)
      if (!values.length) return def?.agg === "avg" ? null : 0
      const total = values.reduce((sum, value) => sum + value, 0)
      return def?.agg === "avg" ? total / values.length : total
    },
    [series, metric]
  )

  const formatValue = (
    id: string | undefined,
    value: number | null,
    compact = false
  ) => {
    const def = metric(id)
    if (value === null) return "—"
    if (def?.kind === "money") return formatMoney(value, 0)
    if (def?.kind === "mood") return value.toFixed(1)
    if (def?.kind === "hours")
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 1,
      ...(compact ? { notation: "compact" } : {}),
    })
  }

  return { metrics, metric, series, summarize, formatValue, loading }
}

export type DashboardMetrics = ReturnType<typeof useDashboardMetrics>
