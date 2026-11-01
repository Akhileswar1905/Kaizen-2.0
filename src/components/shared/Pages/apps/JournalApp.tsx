import { useMemo, useState } from "react"
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import {
  Angry,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Frown,
  Laugh,
  Lightbulb,
  Meh,
  NotebookPen,
  Search,
  Smile,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { dateKey, streakFrom, todayKey } from "@/lib/pageApps"
import type { JournalContent, JournalEntry, Mood } from "@/lib/workspace"
import { PageEditor } from "../PageEditor"

const MOODS: { value: Mood; label: string; icon: LucideIcon; color: string }[] =
  [
    {
      value: 1,
      label: "Awful",
      icon: Angry,
      color: "text-rose-600 dark:text-rose-400 bg-rose-500/15",
    },
    {
      value: 2,
      label: "Bad",
      icon: Frown,
      color: "text-orange-600 dark:text-orange-400 bg-orange-500/15",
    },
    {
      value: 3,
      label: "Okay",
      icon: Meh,
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/15",
    },
    {
      value: 4,
      label: "Good",
      icon: Smile,
      color: "text-lime-600 dark:text-lime-400 bg-lime-500/15",
    },
    {
      value: 5,
      label: "Great",
      icon: Laugh,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15",
    },
  ]
const MOOD_DOT = [
  "",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
]

const PROMPTS = [
  "What are three things you're grateful for today?",
  "What was the best part of your day?",
  "What's one small win you had today?",
  "What drained your energy, and what gave you energy?",
  "What did you learn today?",
  "What would make tomorrow great?",
  "Who made a difference to your day, and how?",
  "What's on your mind right now?",
  "What are you looking forward to?",
  "What would you do differently if you could redo today?",
  "What's something you're proud of this week?",
  "What's one thing you can let go of?",
]

// Same prompt all day, a different one each day.
const promptFor = (key: string) =>
  PROMPTS[
    [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PROMPTS.length
  ]

const isBlank = (html: string) => !html.replace(/<[^>]*>/g, "").trim()
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function JournalApp({
  initial,
  onChange,
}: {
  initial?: JournalContent
  onChange: (journal: JournalContent) => void
}) {
  const [journal, setJournal] = useState<JournalContent>(
    () => initial ?? { entries: {} }
  )
  const [selected, setSelected] = useState(todayKey)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [search, setSearch] = useState("")
  const today = todayKey()
  const entry = journal.entries[selected]

  const updateEntry = (changes: Partial<JournalEntry>) => {
    const current = journal.entries[selected] ?? {
      html: "",
      mood: null,
      updatedAt: "",
    }
    const next: JournalEntry = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    }
    const entries = { ...journal.entries }
    // Don't keep empty days around; they would count towards the streak.
    if (isBlank(next.html) && !next.mood) delete entries[selected]
    else entries[selected] = next
    const updated = { entries }
    setJournal(updated)
    onChange(updated)
  }

  const goTo = (key: string) => {
    if (key > today) return
    setSelected(key)
    setMonth(startOfMonth(parseISO(key)))
  }

  const streak = streakFrom((key) => Boolean(journal.entries[key]))
  const totalEntries = Object.keys(journal.entries).length
  const recentMoods = Array.from({ length: 14 }, (_, index) => {
    const key = dateKey(addDays(new Date(), index - 13))
    return { key, mood: journal.entries[key]?.mood ?? null }
  })
  const moodValues = recentMoods
    .map((day) => day.mood)
    .filter((mood): mood is Mood => Boolean(mood))
  const averageMood = moodValues.length
    ? MOODS[
        Math.round(moodValues.reduce((a, b) => a + b, 0) / moodValues.length) -
          1
      ]
    : null

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return Object.entries(journal.entries)
      .filter(([, value]) =>
        plainText(value.html).toLowerCase().includes(query)
      )
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 20)
  }, [journal.entries, search])

  const selectedDate = parseISO(selected)

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => goTo(dateKey(addDays(selectedDate, -1)))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 px-1">
              <p className="text-lg leading-tight font-extrabold">
                {format(selectedDate, "EEEE, d MMMM")}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected === today ? "Today" : format(selectedDate, "yyyy")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              disabled={selected >= today}
              onClick={() => goTo(dateKey(addDays(selectedDate, 1)))}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {selected !== today && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => goTo(today)}
            >
              Back to today
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground">
            How are you feeling?
          </p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                type="button"
                onClick={() =>
                  updateEntry({
                    mood: entry?.mood === mood.value ? null : mood.value,
                  })
                }
                aria-pressed={entry?.mood === mood.value}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-bold transition-colors",
                  entry?.mood === mood.value
                    ? cn("border-transparent", mood.color)
                    : "border-border/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <mood.icon className="h-5 w-5" />
                {mood.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-bold text-foreground">Prompt: </span>
            {promptFor(selected)}
          </span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
          <PageEditor
            key={selected}
            initialHtml={entry?.html ?? ""}
            onChange={(html) => updateEntry({ html })}
            placeholder="Start writing… (type / for headings, lists and more)"
            showTemplates={false}
          />
        </div>
      </section>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/70 bg-card p-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {streak}
            </p>
            <p className="text-[11px] text-muted-foreground">day streak</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-3">
            <NotebookPen className="h-4 w-4 text-muted-foreground" />
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {totalEntries}
            </p>
            <p className="text-[11px] text-muted-foreground">entries</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">
              Mood, last 14 days
            </p>
            {averageMood && (
              <span className="text-[11px] font-bold text-muted-foreground">
                Mostly {averageMood.label.toLowerCase()}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-1">
            {recentMoods.map((day) => (
              <button
                key={day.key}
                type="button"
                title={`${format(parseISO(day.key), "d MMM")}${day.mood ? ` · ${MOODS[day.mood - 1].label}` : ""}`}
                onClick={() => goTo(day.key)}
                className="flex flex-1 flex-col items-center"
              >
                <span
                  className={cn(
                    "w-full max-w-3 rounded-full",
                    day.mood ? MOOD_DOT[day.mood] : "bg-muted"
                  )}
                  style={{ height: day.mood ? 6 + day.mood * 6 : 6 }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <CalendarDays className="h-3.5 w-3.5" />{" "}
              {format(month, "MMMM yyyy")}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isSameMonth(month, new Date())}
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={index}>{day}</span>
            ))}
            {calendarDays.map((day) => {
              const key = dateKey(day)
              const dayEntry = journal.entries[key]
              return (
                <button
                  key={key}
                  type="button"
                  disabled={key > today}
                  onClick={() => goTo(key)}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-30",
                    !isSameMonth(day, month) && "text-muted-foreground/40",
                    key === selected
                      ? "bg-foreground text-background"
                      : "hover:bg-muted",
                    key === today &&
                      key !== selected &&
                      "ring-1 ring-foreground/30"
                  )}
                >
                  {format(day, "d")}
                  {dayEntry && (
                    <span
                      className={cn(
                        "absolute bottom-0.5 h-1 w-1 rounded-full",
                        dayEntry.mood
                          ? MOOD_DOT[dayEntry.mood]
                          : "bg-foreground/50",
                        key === selected && "bg-background"
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search entries…"
              className="h-9 rounded-xl pl-9"
            />
          </div>
          {search.trim() && (
            <div className="space-y-1">
              {results.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No entries mention “{search.trim()}”.
                </p>
              ) : (
                results.map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => goTo(key)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="block text-xs font-bold">
                      {format(parseISO(key), "EEE d MMM yyyy")}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {plainText(value.html)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
