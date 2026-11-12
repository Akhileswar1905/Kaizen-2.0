import { CalendarDays } from "lucide-react"
import { TimeBlockWeek } from "@/components/shared/Planner/TimeBlockWeek"

export function CalendarView() {
  return (
    <div className="planner-page min-h-screen px-3 py-5 text-foreground antialiased sm:px-6 sm:py-8">
      <div className="planner-shell mx-auto w-full max-w-7xl space-y-6">
        <header className="flex items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="kaizen-page-heading-icon">
              <CalendarDays />
            </div>
            <div>
              <h1 className="kaizen-page-heading-title">Calendar</h1>
              <p className="kaizen-page-heading-description">
                Plan your time with a clear view of your week.
              </p>
            </div>
          </div>
        </header>
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/75 shadow-sm backdrop-blur-xl">
          <TimeBlockWeek />
        </section>
      </div>
    </div>
  )
}

export default CalendarView
