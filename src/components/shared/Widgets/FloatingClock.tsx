import { useEffect, useRef, useState } from "react"
import { Clock3, Grip } from "lucide-react"

const POSITION_KEY = "kaizen-floating-clock-position"
const CLOCK_WIDTH = 184
const CLOCK_HEIGHT = 82
const EDGE_GAP = 12

type Position = { x: number; y: number }

function defaultPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - CLOCK_WIDTH - EDGE_GAP),
    // Keep it above the bottom navigation dock.
    y: Math.max(EDGE_GAP, window.innerHeight - CLOCK_HEIGHT - 104),
  }
}

function clampPosition(position: Position): Position {
  if (typeof window === "undefined") return position
  return {
    x: Math.min(
      Math.max(EDGE_GAP, position.x),
      Math.max(EDGE_GAP, window.innerWidth - CLOCK_WIDTH - EDGE_GAP)
    ),
    y: Math.min(
      Math.max(EDGE_GAP, position.y),
      Math.max(EDGE_GAP, window.innerHeight - CLOCK_HEIGHT - EDGE_GAP)
    ),
  }
}

function readPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(POSITION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Position
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        return clampPosition(parsed)
      }
    }
  } catch {
    // Ignore invalid or unavailable local storage and use the default position.
  }
  return defaultPosition()
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
      // The clock remains usable when storage is unavailable.
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
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    }
  }

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return
    setPosition(
      clampPosition({
        x: event.clientX - dragOffset.current.x,
        y: event.clientY - dragOffset.current.y,
      })
    )
  }

  const stopDrag = () => {
    dragOffset.current = null
  }

  return (
    <section
      aria-label="Floating clock"
      className="fixed z-[45] w-[184px] select-none overflow-hidden rounded-2xl border border-border/70 bg-card/90 text-card-foreground shadow-lg shadow-black/10 backdrop-blur-xl"
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
        className="flex cursor-grab items-center justify-between border-b border-border/60 px-3 py-1.5 text-muted-foreground active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
          <Clock3 className="h-3 w-3" />
          Local time
        </span>
        <Grip className="h-3.5 w-3.5" />
      </div>
      <div className="px-3 py-2">
        <time
          dateTime={now.toISOString()}
          className="block text-[25px] leading-7 font-semibold tracking-tight tabular-nums"
        >
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </time>
        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
          {now.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </section>
  )
}
