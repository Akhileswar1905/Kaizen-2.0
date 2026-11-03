import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Save,
  Loader2,
  Sparkles,
  PenLine,
} from "lucide-react"
import { useTracker } from "@/hooks/useTracker"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

export function JournalView({ onBack }: { onBack: () => void }) {
  const { journals, saveJournalEntry, isSavingJournal } = useTracker()

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [activeDate, setActiveDate] = useState(todayStr)
  const [journalText, setJournalText] = useState("")

  useEffect(() => {
    const entry = journals.find((j) => j.entry_date === activeDate)
    setJournalText(entry ? entry.content : "")
  }, [activeDate, journals])

  const handleSave = () => {
    saveJournalEntry(activeDate, journalText)
  }

  const displayJournals = [...journals]
  if (!displayJournals.find((j) => j.entry_date === todayStr)) {
    displayJournals.unshift({ entry_date: todayStr, content: "" })
  }

  displayJournals.sort((a, b) => b.entry_date.localeCompare(a.entry_date))

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-6xl animate-in flex-col gap-6 p-4 duration-500 fade-in slide-in-from-bottom-4 md:p-8">
      {/* RESPONSIVE HEADER */}
      <header className="flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Navigation Context */}
        <div className="flex items-start gap-4 sm:items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="mt-1 shrink-0 rounded-full border-border/60 bg-card/50 shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-muted active:scale-95 sm:mt-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <div className="kaizen-page-heading-icon"><BookOpen /></div>
              <span className="kaizen-page-heading-title">Daily Journal</span>
            </h1>
            <p className="kaizen-page-heading-description">
              Clear mental clutter and log architectural adjustments
            </p>
          </div>
        </div>

        {/* Right Side Action */}
        <Button
          size="sm"
          className="w-full shrink-0 gap-2 rounded-xl px-5 py-5 font-bold shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:scale-95 sm:w-auto sm:py-2"
          onClick={handleSave}
          disabled={isSavingJournal}
        >
          {isSavingJournal ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSavingJournal ? "Syncing Logic..." : "Commit Entry"}
        </Button>
      </header>

      {/* Main Splits Workspace */}
      <div className="flex flex-1 gap-8 overflow-hidden pb-4">
        {/* Left Side: Editorial Timeline Selector */}
        <div className="hidden h-full w-72 flex-col gap-4 md:flex">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
              <Calendar className="h-3.5 w-3.5" /> Timeline
            </span>
            <span className="rounded-full border border-border/50 bg-muted/60 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {displayJournals.length} Days
            </span>
          </div>

          <ScrollArea className="-mr-3 flex-1 pr-3">
            <div className="space-y-2.5 pb-4">
              {displayJournals.map((entry) => {
                const isToday = entry.entry_date === todayStr
                const isActive = activeDate === entry.entry_date
                const displayDate = isToday
                  ? "Today"
                  : format(parseISO(entry.entry_date), "MMM d, yyyy")

                const abstract = entry.content.trim()
                  ? entry.content.substring(0, 35) + "..."
                  : "No logs recorded yet..."

                return (
                  <button
                    key={entry.entry_date}
                    onClick={() => setActiveDate(entry.entry_date)}
                    className={cn(
                      "group relative flex w-full flex-col gap-2 rounded-2xl border p-3.5 text-left transition-all duration-300",
                      isActive
                        ? "border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border/40 bg-card/30 backdrop-blur-sm hover:border-border/80 hover:bg-card/60"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-bold transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-foreground group-hover:text-primary/80"
                        )}
                      >
                        {displayDate}
                      </span>
                      {isToday && !isActive && (
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary/70" />
                      )}
                    </div>
                    <p
                      className={cn(
                        "w-full truncate text-[11px] leading-relaxed transition-colors",
                        isActive
                          ? "font-medium text-foreground/80"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {abstract}
                    </p>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Distraction-Free Canvas Workspace */}
        <div className="flex h-full flex-1 animate-in flex-col gap-4 duration-500 fade-in-50">
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-sm transition-all duration-500 focus-within:border-primary/40 focus-within:bg-card/60 focus-within:shadow-md">
            {/* Top metadata bar inside the editor */}
            <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background text-muted-foreground shadow-sm">
                  <PenLine className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    {activeDate === todayStr
                      ? "Today's Logbook"
                      : format(parseISO(activeDate), "eeee, MMMM d, yyyy")}
                  </h2>
                  <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Active Session
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="font-mono font-bold text-foreground">
                  {journalText.length}
                </span>
                <span className="text-[10px] tracking-wider uppercase opacity-70">
                  chars
                </span>
              </div>
            </div>

            {/* The actual writing canvas */}
            <div className="relative flex-1">
              <Textarea
                className="h-full w-full resize-none rounded-none border-0 bg-transparent p-5 font-serif text-base leading-relaxed text-foreground/90 transition-all placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground/40 focus-visible:ring-0 md:p-8 md:text-lg"
                placeholder="What's blocking your momentum right now? Map out structural friction points, systems engineering insights, or tactical reflections..."
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
              />
              {/* Subtle background glow effect when typing */}
              <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-tr from-primary/3 via-transparent to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-focus-within:opacity-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
