import { useEffect, useRef, useState } from "react"
import { Minus, Plus, RotateCcw } from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"

const POSITION_KEY = "kaizen-floating-clock-position"
const SIZE_KEY = "kaizen-floating-clock-size"
const DEFAULT_SIZE = 216
const MIN_SIZE = 160
const MAX_SIZE = 280
const EDGE_GAP = 12
const DOCK_GAP = 112

type Position = { x: number; y: number }

function readSize(): number {
  if (typeof window === "undefined") return DEFAULT_SIZE
  try {
    const saved = Number(localStorage.getItem(SIZE_KEY))
    return Number.isFinite(saved) && saved >= MIN_SIZE && saved <= MAX_SIZE ? saved : DEFAULT_SIZE
  } catch {
    return DEFAULT_SIZE
  }
}

function defaultPosition(size: number): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - size - EDGE_GAP),
    y: Math.max(EDGE_GAP, window.innerHeight - size - DOCK_GAP),
  }
}

function clampPosition(position: Position, size: number): Position {
  if (typeof window === "undefined") return position
  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), Math.max(EDGE_GAP, window.innerWidth - size - EDGE_GAP)),
    y: Math.min(Math.max(EDGE_GAP, position.y), Math.max(EDGE_GAP, window.innerHeight - size - EDGE_GAP)),
  }
}

function readPosition(size: number): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(POSITION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Position
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return clampPosition(parsed, size)
    }
  } catch {
    // Fall back to the default position when saved state is unavailable.
  }
  return defaultPosition(size)
}

function AnalogClock({ now, size }: { now: Date; size: number }) {
  const seconds = now.getSeconds()
  const minutes = now.getMinutes() + seconds / 60
  const hours = (now.getHours() % 12) + minutes / 60
  const dialSize = Math.round(size * 0.49)
  const radius = dialSize * 0.44
  const handStyle = (angle: number, length: number, width: number): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width,
    height: length,
    borderRadius: 999,
    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
    transformOrigin: "50% 100%",
  })

  return (
    <div
      aria-label={now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      className="relative shrink-0 rounded-full border border-border/80 bg-background shadow-[inset_0_1px_3px_rgba(0,0,0,0.045)]"
      style={{ width: dialSize, height: dialSize }}
    >
      {Array.from({ length: 60 }, (_, index) => {
        const major = index % 5 === 0
        return (
          <span
            key={index}
            className={`absolute left-1/2 top-1/2 rounded-full ${major ? "bg-foreground/65" : "bg-muted-foreground/35"}`}
            style={{
              width: major ? 1.5 : 1,
              height: major ? Math.max(4, dialSize * 0.055) : Math.max(2, dialSize * 0.02),
              transform: `translate(-50%, -50%) rotate(${index * 6}deg) translateY(-${radius}px)`,
            }}
          />
        )
      })}
      <span className="absolute left-1/2 top-1/2 rounded-full bg-foreground" style={handStyle(hours * 30, dialSize * 0.27, Math.max(2.5, dialSize * 0.028))} />
      <span className="absolute left-1/2 top-1/2 rounded-full bg-foreground/75" style={handStyle(minutes * 6, dialSize * 0.36, Math.max(1.5, dialSize * 0.019))} />
      <span className="absolute left-1/2 top-1/2 rounded-full bg-primary" style={handStyle(seconds * 6, dialSize * 0.40, 1)} />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm" />
    </div>
  )
}

export function FloatingClock() {
  const { settings } = useWorkspace()
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches)
  const [now, setNow] = useState(() => new Date())
  const [size, setSize] = useState(readSize)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  }))
  const effectiveSize = Math.max(MIN_SIZE, Math.min(size, viewport.width - EDGE_GAP * 2, viewport.height - EDGE_GAP * 2))
  const [position, setPosition] = useState<Position>(() => readPosition(readSize()))
  const dragOffset = useRef<Position | null>(null)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const updateDevice = () => setIsMobile(media.matches)
    media.addEventListener("change", updateDevice)
    return () => media.removeEventListener("change", updateDevice)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position))
    } catch {
      // The clock remains movable when storage is unavailable.
    }
  }, [position])

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, String(size))
    } catch {
      // Size remains adjustable for the current session.
    }
  }, [size])

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    setPosition((current) => clampPosition(current, effectiveSize))
  }, [effectiveSize])

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
    }, effectiveSize))
  }

  const stopDrag = () => { dragOffset.current = null }
  const adjustSize = (delta: number) => {
    setSize((current) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, current + delta)))
  }
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
  const [clockTime, period] = time.split(" ")
  const compact = effectiveSize < 190
  const clockVisible = isMobile
    ? (settings.dashboard.clockVisibility?.mobile ?? true)
    : (settings.dashboard.clockVisibility?.desktop ?? true)

  if (!clockVisible) return null

  return (
    <section
      aria-label="Floating clock"
      className="fixed z-[45] flex flex-col items-center rounded-[24px] border border-border/80 bg-card text-card-foreground shadow-[0_8px_28px_rgba(0,0,0,0.09)]"
      style={{
        left: position.x,
        top: position.y,
        width: effectiveSize,
        height: effectiveSize,
        paddingBottom: compact ? 8 : 12,
      }}
    >
      <div
        className="flex w-full shrink-0 cursor-grab touch-none items-center justify-between px-3 pb-2 pt-3 text-muted-foreground active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        role="button"
        tabIndex={0}
        aria-label="Move clock. Use arrow keys to reposition."
        title="Drag to move"
        onKeyDown={(event) => {
          const step = event.shiftKey ? 20 : 5
          if (event.key === "ArrowLeft") setPosition((p) => clampPosition({ ...p, x: p.x - step }, effectiveSize))
          if (event.key === "ArrowRight") setPosition((p) => clampPosition({ ...p, x: p.x + step }, effectiveSize))
          if (event.key === "ArrowUp") setPosition((p) => clampPosition({ ...p, y: p.y - step }, effectiveSize))
          if (event.key === "ArrowDown") setPosition((p) => clampPosition({ ...p, y: p.y + step }, effectiveSize))
        }}
      >
        <span className="h-1 w-7 rounded-full bg-muted-foreground/25" />
        <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label="Decrease clock size"
            title="Make smaller"
            disabled={size <= MIN_SIZE}
            onClick={() => adjustSize(-12)}
            className="rounded-md p-1 transition-colors hover:bg-muted disabled:opacity-30"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Increase clock size"
            title="Make larger"
            disabled={size >= MAX_SIZE}
            onClick={() => adjustSize(12)}
            className="rounded-md p-1 transition-colors hover:bg-muted disabled:opacity-30"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Reset clock size and position"
            title="Reset size and position"
            onClick={() => {
              setSize(DEFAULT_SIZE)
              setPosition(defaultPosition(DEFAULT_SIZE))
            }}
            className="rounded-md p-1 transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <AnalogClock now={now} size={effectiveSize} />

      <div className="mt-auto flex min-h-0 flex-col items-center justify-center px-2 pt-2 text-center">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <time dateTime={now.toISOString()} className="font-medium leading-none tracking-[-0.075em] tabular-nums" style={{ fontSize: compact ? 22 : Math.min(30, effectiveSize * 0.14) }}>
            {clockTime}
          </time>
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{period}</span>
        </div>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
        </p>
      </div>
    </section>
  )
}
