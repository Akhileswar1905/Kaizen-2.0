import { addDays, isWeekend, setHours, setMinutes, startOfDay } from "date-fns"

// ---------------------------------------------------------------------------
// Preferences (per device: notification permission is per device too)
// ---------------------------------------------------------------------------

export type NotificationPrefs = {
  timeBlocks: boolean
  /** Minutes before a time block starts to send the heads-up. */
  leadMinutes: number
  /** Also notify at the moment a block starts. */
  atStart: boolean
  reminders: boolean
  sound: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = {
  timeBlocks: true,
  leadMinutes: 10,
  atStart: false,
  reminders: true,
  sound: true,
}
export const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60]

const PREFS_KEY = "kaizen-notification-prefs-v1"
const DELIVERED_KEY = "kaizen-notifications-delivered-v1"
const SNOOZE_KEY = "kaizen-notifications-snoozed-v1"

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: notifications still work, just without dedupe.
  }
}

export const loadPrefs = (): NotificationPrefs => ({
  ...DEFAULT_PREFS,
  ...readJson<Partial<NotificationPrefs>>(PREFS_KEY, {}),
})
export const savePrefs = (prefs: NotificationPrefs) =>
  writeJson(PREFS_KEY, prefs)

// ---------------------------------------------------------------------------
// Delivered / snoozed bookkeeping, shared by every open tab via localStorage
// ---------------------------------------------------------------------------

/**
 * Marks a notification as delivered. Returns false if this or another tab
 * already delivered it, so each alert fires once per device.
 */
export function claimDelivery(key: string) {
  const delivered = readJson<Record<string, number>>(DELIVERED_KEY, {})
  if (delivered[key]) return false
  const now = Date.now()
  // Forget anything older than two days so the store stays small.
  for (const [k, at] of Object.entries(delivered))
    if (now - at > 2 * 86_400_000) delete delivered[k]
  delivered[key] = now
  writeJson(DELIVERED_KEY, delivered)
  return true
}

export type Snooze = {
  key: string
  fireAt: number
  title: string
  body: string
  view?: string
}
export const loadSnoozes = () => readJson<Snooze[]>(SNOOZE_KEY, [])
export const saveSnoozes = (snoozes: Snooze[]) => writeJson(SNOOZE_KEY, snoozes)

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export type CalendarReminderRepeat = "none" | "daily" | "weekdays" | "weekly"
export type ReminderRepeat = CalendarReminderRepeat | `interval:${number}`

export type Reminder = {
  id: string
  user_id: string
  title: string
  note: string | null
  remind_at: string
  repeat: ReminderRepeat
  is_active: boolean
  created_at: string
}

export const REPEAT_LABELS: Record<CalendarReminderRepeat, string> = {
  none: "Once",
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Every week",
}

export const getRepeatLabel = (repeat: ReminderRepeat) => {
  if (repeat.startsWith("interval:")) {
    const minutes = Number(repeat.slice("interval:".length))
    if (minutes >= 60 && minutes % 60 === 0)
      return `Every ${minutes / 60} ${minutes / 60 === 1 ? "hour" : "hours"}`
    return `Every ${minutes} minutes`
  }
  return REPEAT_LABELS[repeat]
}

const onDay = (day: Date, base: Date) =>
  setMinutes(setHours(startOfDay(day), base.getHours()), base.getMinutes())

const matches = (reminder: Reminder, candidate: Date, base: Date) => {
  if (candidate < base) return false
  if (reminder.repeat === "weekdays") return !isWeekend(candidate)
  if (reminder.repeat === "weekly") return candidate.getDay() === base.getDay()
  return true
}

/** The most recent time this reminder was due, at or before `now`. */
export function lastOccurrence(
  reminder: Reminder,
  now = new Date()
): Date | null {
  const base = new Date(reminder.remind_at)
  if (reminder.repeat === "none") return base <= now ? base : null
  if (reminder.repeat.startsWith("interval:")) {
    const minutes = Number(reminder.repeat.slice("interval:".length))
    if (!Number.isFinite(minutes) || minutes < 1) return null
    const intervalMs = minutes * 60_000
    const elapsed = now.getTime() - base.getTime()
    if (elapsed < 0) return null
    return new Date(base.getTime() + Math.floor(elapsed / intervalMs) * intervalMs)
  }
  for (let i = 0; i <= 7; i++) {
    const candidate = onDay(addDays(now, -i), base)
    if (candidate <= now && matches(reminder, candidate, base)) return candidate
  }
  return null
}

/** The next time this reminder is due, after `now`. */
export function nextOccurrence(
  reminder: Reminder,
  now = new Date()
): Date | null {
  const base = new Date(reminder.remind_at)
  if (reminder.repeat === "none") return base > now ? base : null
  if (reminder.repeat.startsWith("interval:")) {
    const minutes = Number(reminder.repeat.slice("interval:".length))
    if (!Number.isFinite(minutes) || minutes < 1) return null
    if (base > now) return base
    const intervalMs = minutes * 60_000
    const elapsed = now.getTime() - base.getTime()
    return new Date(base.getTime() + (Math.floor(elapsed / intervalMs) + 1) * intervalMs)
  }
  for (let i = 0; i <= 8; i++) {
    const candidate = onDay(addDays(now, i), base)
    if (candidate > now && matches(reminder, candidate, base)) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export type PermissionState = NotificationPermission | "unsupported"

export const permissionState = (): PermissionState =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.requestPermission()
}

/**
 * Shows a system notification. Returns false if it couldn't be shown (no
 * permission or not supported), so the caller can rely on the in-app toast.
 */
export async function showSystemNotification(
  title: string,
  body: string,
  tag: string,
  onClick?: () => void
) {
  if (permissionState() !== "granted") return false
  const options: NotificationOptions = {
    body,
    tag,
    icon: "./light_icon.png",
    badge: "./maskable_icon.png",
  }
  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      onClick?.()
      notification.close()
    }
    return true
  } catch {
    // Mobile Chrome only allows notifications through the service worker.
    try {
      const registration = await navigator.serviceWorker?.ready
      if (!registration) return false
      await registration.showNotification(title, options)
      return true
    } catch {
      return false
    }
  }
}

/** A short, gentle two-note chime. */
export function playChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    ;[
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.16 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.65)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // Audio is a nice-to-have.
  }
}

/** Ask other parts of the app to switch page (Kaizen.tsx listens for this). */
export const navigateTo = (view: string) =>
  window.dispatchEvent(new CustomEvent("kaizen:navigate", { detail: view }))
