import { useEffect, useRef, useState } from "react"
import { AlarmClock, BellOff, Pause, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardWidget } from "@/lib/workspace"

type SessionStatus = "idle" | "running" | "paused" | "finished"
type SessionMode = "focus" | "break"
type PersistedSession = {
  mode: SessionMode
  status: SessionStatus
  remaining: number
  deadline: number | null
  alarmDismissed: boolean
}

const SESSION_STORAGE_KEY = "kaizen-focus-session-v1"
let sharedAudioContext: AudioContext | null = null

function readSession(focusSeconds: number): PersistedSession {
  const fallback: PersistedSession = { mode: "focus", status: "idle", remaining: focusSeconds, deadline: null, alarmDismissed: false }
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as PersistedSession
    if (!saved || !["focus", "break"].includes(saved.mode) || !["idle", "running", "paused", "finished"].includes(saved.status)) return fallback
    if (saved.status === "running" && saved.deadline) {
      const remaining = Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000))
      return { ...saved, remaining, deadline: remaining === 0 ? null : saved.deadline, status: remaining === 0 ? "finished" : "running" }
    }
    return { ...fallback, ...saved, deadline: null }
  } catch {
    return fallback
  }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0")
  const remainder = (seconds % 60).toString().padStart(2, "0")
  return `${minutes}:${remainder}`
}

export function FocusSessionWidget({ widget }: { widget: DashboardWidget }) {
  const focusSeconds = Math.max(1, widget.focusMinutes ?? 25) * 60
  const breakSeconds = Math.max(1, widget.breakMinutes ?? 5) * 60
  const alarmEnabled = widget.alarmEnabled ?? true
  const [initialSession] = useState(() => readSession(focusSeconds))
  const [mode, setMode] = useState<SessionMode>(initialSession.mode)
  const [status, setStatus] = useState<SessionStatus>(initialSession.status)
  const [remaining, setRemaining] = useState(initialSession.remaining)
  const [alarmDismissed, setAlarmDismissed] = useState(initialSession.alarmDismissed)
  const deadlineRef = useRef<number | null>(initialSession.deadline)
  const audioContextRef = useRef<AudioContext | null>(null)

  const total = mode === "focus" ? focusSeconds : breakSeconds
  const progress = Math.min(1, Math.max(0, (total - remaining) / total))

  const prepareAudio = () => {
    if (typeof window === "undefined") return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioContextClass()
    }
    audioContextRef.current = sharedAudioContext
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume()
    }
  }

  const playAlarm = () => {
    const context = audioContextRef.current
    if (!context) return
    const now = context.currentTime
    ;[880, 660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startAt = now + index * 0.22
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(frequency, startAt)
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.2)
    })
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const session: PersistedSession = { mode, status, remaining, deadline: deadlineRef.current, alarmDismissed }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [mode, status, remaining, alarmDismissed])

  useEffect(() => {
    if (status !== "running") return
    const tick = () => {
      if (deadlineRef.current === null) return
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      setRemaining(next)
      if (next === 0) {
        deadlineRef.current = null
        setStatus("finished")
      }
    }
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (status !== "finished" || !alarmEnabled || alarmDismissed) return
    playAlarm()
    const interval = window.setInterval(playAlarm, 1800)
    return () => window.clearInterval(interval)
  }, [status, alarmEnabled, alarmDismissed])

  const start = () => {
    prepareAudio()
    setAlarmDismissed(false)
    deadlineRef.current = Date.now() + remaining * 1000
    setStatus("running")
  }

  const pause = () => {
    if (deadlineRef.current !== null) {
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)))
    }
    deadlineRef.current = null
    setStatus("paused")
  }

  const reset = () => {
    deadlineRef.current = null
    setMode("focus")
    setRemaining(focusSeconds)
    setStatus("idle")
    setAlarmDismissed(true)
  }

  const startBreak = () => {
    deadlineRef.current = null
    setMode("break")
    setRemaining(breakSeconds)
    setAlarmDismissed(false)
    setStatus("idle")
  }

  const dismissAlarm = () => setAlarmDismissed(true)

  return (
    <div className="flex h-full min-h-[230px] flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{widget.title || "Focus session"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mode === "focus" ? "Time to focus" : "Take a breather"}
            {" · "}
            {mode === "focus" ? focusSeconds / 60 : breakSeconds / 60} min
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <AlarmClock className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-3">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="51" fill="none" stroke="var(--muted)" strokeWidth="7" />
            <circle
              cx="60"
              cy="60"
              r="51"
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 51}
              strokeDashoffset={2 * Math.PI * 51 * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="text-center">
            <p className="text-3xl font-extrabold tabular-nums tracking-tight">{formatTime(remaining)}</p>
            <p className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {status === "running" ? "In progress" : status === "paused" ? "Paused" : status === "finished" ? "Completed" : "Ready"}
            </p>
          </div>
        </div>
        {status === "finished" && (
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400" aria-live="polite">
            {mode === "focus" ? "Focus session complete. Nice work!" : "Break is over. Ready to focus?"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        {status === "running" ? (
          <button type="button" onClick={pause} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-xs font-bold transition-colors hover:bg-muted">
            <Pause className="h-3.5 w-3.5" /> Pause
          </button>
        ) : status !== "finished" ? (
          <button type="button" onClick={start} className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-85">
            <Play className="h-3.5 w-3.5" /> {status === "paused" ? "Resume" : "Start"}
          </button>
        ) : mode === "focus" ? (
          <button type="button" onClick={startBreak} className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-85">
            <Play className="h-3.5 w-3.5" /> Start break
          </button>
        ) : (
          <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-85">
            <Play className="h-3.5 w-3.5" /> Focus again
          </button>
        )}
        <button type="button" onClick={reset} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Reset focus timer" title="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {status === "finished" && alarmEnabled && !alarmDismissed && (
          <button type="button" onClick={dismissAlarm} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground")} aria-label="Stop alarm" title="Stop alarm">
            <BellOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        {alarmEnabled ? "Alarm sound enabled" : "Alarm sound disabled"}
      </p>
    </div>
  )
}
