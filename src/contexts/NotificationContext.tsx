import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { addDays, format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import {
  claimDelivery,
  lastOccurrence,
  loadPrefs,
  loadSnoozes,
  navigateTo,
  permissionState,
  playChime,
  requestPermission as askPermission,
  savePrefs,
  saveSnoozes,
  showSystemNotification,
  type NotificationPrefs,
  type PermissionState,
  type Reminder,
  type ReminderRepeat,
} from "@/lib/notifications"
import { NotificationToasts } from "@/components/shared/Widgets/NotificationToasts"
import { NotificationCenter } from "@/components/shared/Widgets/NotificationCenter"

export type UpcomingBlock = {
  id: string
  title: string
  date: string
  start: string
  end: string
}

export type Toast = {
  key: string
  kind: "block" | "reminder" | "test"
  title: string
  body: string
  view?: string
}

type Result = { error: string | null }
export type NewReminder = {
  title: string
  note: string | null
  remind_at: string
  repeat: ReminderRepeat
}

interface NotificationContextType {
  prefs: NotificationPrefs
  setPrefs: (prefs: NotificationPrefs) => void
  permission: PermissionState
  requestPermission: () => Promise<void>
  reminders: Reminder[]
  remindersError: string | null
  addReminder: (input: NewReminder) => Promise<Result>
  updateReminder: (
    id: string,
    changes: Partial<
      Pick<Reminder, "is_active" | "title" | "note" | "remind_at" | "repeat">
    >
  ) => Promise<Result>
  deleteReminder: (id: string) => Promise<Result>
  blocks: UpcomingBlock[]
  openCenter: () => void
  sendTest: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const TICK_MS = 20_000
// How late an alert may still be delivered (e.g. a background tab whose timers were throttled).
const GRACE_MS = 15 * 60_000
const SNOOZE_MS = 5 * 60_000

const blockStart = (block: UpcomingBlock) =>
  new Date(`${block.date}T${block.start}:00`)


export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const userId = user?.id
  const [prefs, setPrefsState] = useState<NotificationPrefs>(loadPrefs)
  const [permission, setPermission] = useState<PermissionState>(permissionState)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<UpcomingBlock[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isCenterOpen, setIsCenterOpen] = useState(false)

  // The scheduler runs on an interval, so it reads the latest data through a ref.
  const live = useRef({ prefs, reminders, blocks })
  useEffect(() => {
    live.current = { prefs, reminders, blocks }
  })

  const setPrefs = (next: NotificationPrefs) => {
    setPrefsState(next)
    savePrefs(next)
  }

  const requestPermission = async () => setPermission(await askPermission())

  // ---- Data
  const loadReminders = useCallback(async () => {
    if (!userId) {
      setReminders([])
      return
    }
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("remind_at")
    if (error) setRemindersError(error.message)
    else {
      setRemindersError(null)
      setReminders((data ?? []) as Reminder[])
    }
  }, [userId])

  const loadBlocks = useCallback(async () => {
    if (!userId) {
      setBlocks([])
      return
    }
    const today = format(new Date(), "yyyy-MM-dd")
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")
    const { data, error } = await supabase
      .from("time_blocks")
      .select("id, title, block_date, start_time, end_time")
      .eq("user_id", userId)
      .gte("block_date", today)
      .lte("block_date", tomorrow)
      .order("block_date")
      .order("start_time")
    if (!error && data)
      setBlocks(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          date: row.block_date,
          start: row.start_time.slice(0, 5),
          end: row.end_time.slice(0, 5),
        }))
      )
  }, [userId])

  useEffect(() => {
    void loadReminders()
    void loadBlocks()
    const refresh = () => {
      void loadReminders()
      void loadBlocks()
    }
    const onVisible = () => document.visibilityState === "visible" && refresh()
    // Pick up edits made in the planner, other tabs or other devices.
    window.addEventListener("kaizen:time-blocks-changed", loadBlocks)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisible)
    const interval = window.setInterval(refresh, 5 * 60_000)
    return () => {
      window.removeEventListener("kaizen:time-blocks-changed", loadBlocks)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(interval)
    }
  }, [loadReminders, loadBlocks])

  const addReminder = async (input: NewReminder) => {
    if (!user?.id) return { error: "Sign in to add reminders." }
    const { data, error } = await supabase
      .from("reminders")
      .insert([{ user_id: user.id, ...input, is_active: true }])
      .select("*")
      .single()
    if (error) return { error: error.message }
    setReminders((prev) =>
      [...prev, data as Reminder].sort((a, b) =>
        a.remind_at.localeCompare(b.remind_at)
      )
    )
    return { error: null }
  }

  const updateReminder: NotificationContextType["updateReminder"] = async (
    id,
    changes
  ) => {
    if (!user?.id) return { error: "Sign in to edit reminders." }
    setReminders((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
    const { error } = await supabase
      .from("reminders")
      .update(changes)
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) {
      void loadReminders()
      return { error: error.message }
    }
    return { error: null }
  }

  const deleteReminder = async (id: string) => {
    if (!user?.id) return { error: "Sign in to edit reminders." }
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { error: error.message }
    setReminders((prev) => prev.filter((item) => item.id !== id))
    return { error: null }
  }

  const updateReminderRef = useRef(updateReminder)
  useEffect(() => {
    updateReminderRef.current = updateReminder
  })

  // ---- Delivery
  const deliver = useCallback((toast: Toast) => {
    setToasts((prev) =>
      [...prev.filter((item) => item.key !== toast.key), toast].slice(-4)
    )
    // A system notification is only useful when the user isn't looking at the app.
    if (document.visibilityState !== "visible" || !document.hasFocus())
      void showSystemNotification(toast.title, toast.body, toast.key, () => {
        if (toast.view) navigateTo(toast.view)
      })
    if (live.current.prefs.sound) playChime()
  }, [])

  const tick = useCallback(() => {
    const { prefs: p, reminders: list, blocks: upcoming } = live.current
    const now = new Date()
    const nowMs = now.getTime()

    if (p.timeBlocks) {
      const leads = [...new Set([p.leadMinutes, ...(p.atStart ? [0] : [])])]
      for (const block of upcoming) {
        const start = blockStart(block).getTime()
        for (const lead of leads) {
          const fireAt = start - lead * 60_000
          const late = nowMs - fireAt
          // A heads-up is pointless once the block has started.
          if (late < 0 || late > GRACE_MS || (lead > 0 && nowMs >= start))
            continue
          if (
            !claimDelivery(
              `block:${block.id}:${block.date}:${block.start}:${lead}`
            )
          )
            continue
          const minutes = Math.max(0, Math.round((start - nowMs) / 60_000))
          deliver({
            key: `block:${block.id}:${lead}`,
            kind: "block",
            title:
              minutes > 0
                ? `${block.title} starts in ${minutes} min`
                : `${block.title} is starting now`,
            body: `${block.start} – ${block.end} · Time block`,
            view: "planner",
          })
        }
      }
    }

    if (p.reminders) {
      for (const reminder of list) {
        if (!reminder.is_active) continue
        const due = lastOccurrence(reminder, now)
        if (!due) continue
        const late = nowMs - due.getTime()
        const oneOff = reminder.repeat === "none"
        // One-off reminders missed while the app was closed still show, for up to a day.
        if (late > (oneOff ? 86_400_000 : GRACE_MS)) {
          if (oneOff)
            void updateReminderRef.current(reminder.id, { is_active: false })
          continue
        }
        if (!claimDelivery(`reminder:${reminder.id}:${due.toISOString()}`))
          continue
        deliver({
          key: `reminder:${reminder.id}`,
          kind: "reminder",
          title: reminder.title,
          body:
            reminder.note?.trim() ||
            (late > 2 * 60_000
              ? `Reminder for ${format(due, "HH:mm")}`
              : "Reminder"),
        })
        if (oneOff)
          void updateReminderRef.current(reminder.id, { is_active: false })
      }
    }

    const snoozes = loadSnoozes()
    const ready = snoozes.filter((snooze) => snooze.fireAt <= nowMs)
    if (ready.length) {
      saveSnoozes(snoozes.filter((snooze) => snooze.fireAt > nowMs))
      for (const snooze of ready)
        if (claimDelivery(`${snooze.key}:snooze:${snooze.fireAt}`))
          deliver({
            key: snooze.key,
            kind: snooze.key.startsWith("block") ? "block" : "reminder",
            title: snooze.title,
            body: `Snoozed · ${snooze.body}`,
            view: snooze.view,
          })
    }
  }, [deliver])

  useEffect(() => {
    tick()
    const interval = window.setInterval(tick, TICK_MS)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [tick])

  // Run a check as soon as fresh data arrives, instead of waiting for the next tick.
  useEffect(() => {
    tick()
  }, [tick, reminders, blocks, prefs])

  const dismiss = (key: string) =>
    setToasts((prev) => prev.filter((toast) => toast.key !== key))

  const snooze = (toast: Toast) => {
    saveSnoozes([
      ...loadSnoozes(),
      {
        key: toast.key,
        fireAt: Date.now() + SNOOZE_MS,
        title: toast.title,
        body: toast.body.replace(/^Snoozed · /, ""),
        view: toast.view,
      },
    ])
    dismiss(toast.key)
  }

  const sendTest = () =>
    deliver({
      key: `test:${Date.now()}`,
      kind: "test",
      title: "Notifications are working",
      body: "This is how reminders and time-block alerts will look.",
    })

  const value: NotificationContextType = {
    prefs,
    setPrefs,
    permission,
    requestPermission,
    reminders,
    remindersError,
    addReminder,
    updateReminder,
    deleteReminder,
    blocks,
    openCenter: () => setIsCenterOpen(true),
    sendTest,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {user && (
        <>
          <NotificationToasts
            toasts={toasts}
            onDismiss={dismiss}
            onSnooze={snooze}
            onOpen={(toast) => {
              if (toast.view) navigateTo(toast.view)
              dismiss(toast.key)
            }}
          />
          <NotificationCenter
            isOpen={isCenterOpen}
            onClose={() => setIsCenterOpen(false)}
          />
        </>
      )}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context)
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    )
  return context
}
