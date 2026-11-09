import { useEffect, useRef, useState } from "react"
import { Grip, Clock3 } from "lucide-react"

const POSITION_KEY = "kaizen-floating-clock-position"
const CLOCK_WIDTH = 224
const CLOCK_HEIGHT = 116
const EDGE_GAP = 14

type Position = { x: number; y: number }

function defaultPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - CLOCK_WIDTH - EDGE_GAP),
    y: Math.max(EDGE_GAP, window.innerHeight - CLOCK_HEIGHT - 104),
  }
}

function clampPosition(position: Position): Position {
  if (typeof window === "undefined") return position
  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), Math.max(EDGE_GAP, window.innerWidth - CLOCK_WIDTH - EDGE_GAP)),
    y: Math.min(Math.max(EDGE_GAP, position.y), Math.max(EDGE_GAP, window.innerHeight - CLOCK_HEIGHT - EDGE_GAP)),
  }
}

function readPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(POSITION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Position
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return clampPosition(parsed)
    }
  } catch {
    // Use the default position when saved state is unavailable or invalid.
  }
  return defaultPosition()
}

function AnalogClock({ now }: { now: Date }) {
  const seconds = now.getSeconds()
  const minutes = now.getMinutes() + seconds / 60
  const hours = (now.getHours() % 12) + minutes / 60

  return (
    <div className="relative h-[68px] w-[68px] shrink-0 rounded-full border border-white/70 bg-gradient-to-br from-white via-slate-50 to-slate-200 shadow-[0_3px_12px_rgba(15,23,42,0.12),inset_0_1px_2px_rgba(255,255,255,0.9)] dark:border-white/15 dark:from-slate-700 dark:via-slate-800 dark:to-slate-950">
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/70 dark:bg-slate-300/70"
          style={{ transform: `translate(-50%, -50%) rotate(${index * 30}deg) translateY(-27px)` }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 h-[19px] w-[3px] origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-slate-800 dark:bg-slate-100" style={{ transform: `translate(-50%, -100%) rotate(${hours * 30}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-[25px] w-[2px] origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-slate-600 dark:bg-slate-200" style={{ transform: `translate(-50%, -100%) rotate(${minutes * 6}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-[27px] w-px origin-bottom -translate-x-1/2 -translate-y-full bg-orange-500" style={{ transform: `translate(-50%, -100%) rotate(${seconds * 6}deg)` }} />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-orange-500 shadow-sm" />
    </div>
  )
}

export function FloatingClock() {
  const [now, setNow] = useState(() => new Date())
  const [position, setPosition] = useState<Position>(readPosition)
  const dragOffset = useRef<Position | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position))
    } catch {
      // Keep the widget usable if storage is unavailable.
    }
  }, [position])

  useEffect(() => {
    const handleResize = () => setPosition((current) => clampPosition(current))
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y }
  }

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return
    setPosition(clampPosition({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    }))
  }

  const stopDrag = () => { dragOffset.current = null }

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
  const seconds = now.toLocaleTimeString([], { second: "2-digit" }).replace(/\D/g, "")

  return (
    <section
      aria-label="Floating clock"
      className="fixed z-[45] w-[224px] select-none overflow-hidden rounded-[22px] border border-white/70 bg-white/75 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/75 dark:text-slate-100"
      style={{ left: position.x, top: position.y, touchAction: "none" }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag clock to move it"
        title="Drag to move"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 20 : 5
          if (event.key === "ArrowLeft") setPosition((p) => clampPosition({ ...p, x: p.x - step }))
          if (event.key === "ArrowRight") setPosition((p) => clampPosition({ ...p, x: p.x + step }))
          if (event.key === "ArrowUp") setPosition((p) => clampPosition({ ...p, y: p.y - step }))
          if (event.key === "ArrowDown") setPosition((p) => clampPosition({ ...p, y: p.y + step }))
        }}
        className="flex cursor-grab items-center justify-between px-3.5 pt-2.5 text-slate-400 active:cursor-grabbing dark:text-slate-500"
      >
        <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.18em] uppercase">
          <Clock3 className="h-3 w-3" />
          Clock
        </span>
        <Grip className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 pb-3 pt-1">
        <div className="min-w-0">
          <time dateTime={now.toISOString()} className="block whitespace-nowrap text-[27px] leading-8 font-semibold tracking-[-0.06em] tabular-nums">
            {time}<span className="ml-1 align-baseline text-[11px] font-medium tracking-normal text-slate-400">{seconds}</span>
          </time>
          <p className="mt-1 text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>
        <AnalogClock now={now} />
      </div>
    </section>
  )
}
