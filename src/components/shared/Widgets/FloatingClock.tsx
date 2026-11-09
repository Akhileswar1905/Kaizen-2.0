import { useEffect, useRef, useState } from "react"

const POSITION_KEY = "kaizen-floating-clock-position"
const CLOCK_SIZE = 216
const EDGE_GAP = 16

type Position = { x: number; y: number }

function defaultPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - CLOCK_SIZE - EDGE_GAP),
    y: Math.max(EDGE_GAP, window.innerHeight - CLOCK_SIZE - 104),
  }
}

function clampPosition(position: Position): Position {
  if (typeof window === "undefined") return position
  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), Math.max(EDGE_GAP, window.innerWidth - CLOCK_SIZE - EDGE_GAP)),
    y: Math.min(Math.max(EDGE_GAP, position.y), Math.max(EDGE_GAP, window.innerHeight - CLOCK_SIZE - EDGE_GAP)),
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
    // Fall back to the default position when saved state is unavailable.
  }
  return defaultPosition()
}

function AnalogClock({ now }: { now: Date }) {
  const seconds = now.getSeconds()
  const minutes = now.getMinutes() + seconds / 60
  const hours = (now.getHours() % 12) + minutes / 60

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
      className="relative h-[104px] w-[104px] shrink-0 rounded-full border border-border/80 bg-background shadow-[inset_0_1px_3px_rgba(0,0,0,0.045)]"
    >
      {Array.from({ length: 60 }, (_, index) => {
        const major = index % 5 === 0
        return (
          <span
            key={index}
            className={`absolute left-1/2 top-1/2 rounded-full ${major ? "h-[6px] w-[1.5px] bg-foreground/65" : "h-[2px] w-px bg-muted-foreground/35"}`}
            style={{ transform: `translate(-50%, -50%) rotate(${index * 6}deg) translateY(-46px)` }}
          />
        )
      })}
      <span className="absolute left-1/2 top-1/2 h-[28px] w-[3px] rounded-full bg-foreground" style={handStyle(hours * 30, 28, 3)} />
      <span className="absolute left-1/2 top-1/2 h-[37px] w-[2px] rounded-full bg-foreground/75" style={handStyle(minutes * 6, 37, 2)} />
      <span className="absolute left-1/2 top-1/2 h-[41px] w-px rounded-full bg-primary" style={handStyle(seconds * 6, 41, 1)} />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm" />
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
      // The clock remains movable when storage is unavailable.
    }
  }, [position])

  useEffect(() => {
    const handleResize = () => setPosition((current) => clampPosition(current))
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y }
  }

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return
    setPosition(clampPosition({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    }))
  }

  const stopDrag = () => { dragOffset.current = null }
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
  const [clockTime, period] = time.split(" ")

  return (
    <section
      aria-label="Floating clock"
      className="fixed z-[45] flex h-[216px] w-[216px] touch-none select-none flex-col items-center rounded-[24px] border border-border/80 bg-card text-card-foreground shadow-[0_8px_28px_rgba(0,0,0,0.09)]"
      style={{ left: position.x, top: position.y }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Move clock. Use arrow keys to reposition."
        title="Drag to move"
        onKeyDown={(event) => {
          const step = event.shiftKey ? 20 : 5
          if (event.key === "ArrowLeft") setPosition((p) => clampPosition({ ...p, x: p.x - step }))
          if (event.key === "ArrowRight") setPosition((p) => clampPosition({ ...p, x: p.x + step }))
          if (event.key === "ArrowUp") setPosition((p) => clampPosition({ ...p, y: p.y - step }))
          if (event.key === "ArrowDown") setPosition((p) => clampPosition({ ...p, y: p.y + step }))
        }}
        className="flex w-full cursor-grab items-center justify-center pb-2 pt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground active:cursor-grabbing"
      >
        <span className="h-1 w-8 rounded-full bg-muted-foreground/25" />
      </div>

      <AnalogClock now={now} />

      <div className="mt-3 flex flex-col items-center text-center">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <time dateTime={now.toISOString()} className="text-[27px] font-medium leading-none tracking-[-0.075em] tabular-nums">
            {clockTime}
          </time>
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{period}</span>
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>
    </section>
  )
}
