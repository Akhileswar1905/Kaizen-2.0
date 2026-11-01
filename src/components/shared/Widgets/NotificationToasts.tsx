import { AlarmClock, Bell, CalendarClock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Toast } from "@/contexts/NotificationContext"

const ICONS = { block: CalendarClock, reminder: AlarmClock, test: Bell }

export function NotificationToasts({
  toasts,
  onDismiss,
  onSnooze,
  onOpen,
}: {
  toasts: Toast[]
  onDismiss: (key: string) => void
  onSnooze: (toast: Toast) => void
  onOpen: (toast: Toast) => void
}) {
  if (!toasts.length) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-24 z-[110] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-28"
      aria-live="assertive"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind]
        return (
          <div
            key={toast.key}
            role="alert"
            className="pointer-events-auto w-full animate-in rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur-xl duration-300 fade-in slide-in-from-bottom-2 sm:w-96"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-extrabold">
                  {toast.title}
                </p>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {toast.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.key)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {toast.kind !== "test" && (
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => onSnooze(toast)}
                >
                  Snooze 5 min
                </Button>
                {toast.view && (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => onOpen(toast)}
                  >
                    Open planner
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
