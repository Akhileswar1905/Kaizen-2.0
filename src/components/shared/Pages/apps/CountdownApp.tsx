import { useState } from "react"
import { differenceInYears, format, parseISO } from "date-fns"
import { Hourglass, PartyPopper, Plus, Repeat, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { daysUntil, nextOccurrence, todayKey } from "@/lib/pageApps"
import {
  newId,
  type CountdownContent,
  type CountdownEvent,
} from "@/lib/workspace"

export function CountdownApp({
  initial,
  onChange,
}: {
  initial?: CountdownContent
  onChange: (countdown: CountdownContent) => void
}) {
  const [content, setContent] = useState<CountdownContent>(
    () => initial ?? { events: [] }
  )
  const yearlyByDefault = Boolean(content.yearlyByDefault)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [yearly, setYearly] = useState(yearlyByDefault)
  const [showPast, setShowPast] = useState(false)

  const update = (events: CountdownEvent[]) => {
    const next = { ...content, events }
    setContent(next)
    onChange(next)
  }

  const add = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !date) return
    update([
      ...content.events,
      { id: newId(), title: title.trim(), date, yearly },
    ])
    setTitle("")
    setDate("")
  }

  const rows = content.events
    .map((event) => {
      const next = nextOccurrence(event)
      return { event, next, days: daysUntil(next) }
    })
    .sort((a, b) => a.days - b.days)
  const upcoming = rows.filter((row) => row.days >= 0)
  const past = rows.filter((row) => row.days < 0).reverse()
  const [hero, ...rest] = upcoming

  return (
    <div className="space-y-5">
      {hero ? (
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 text-center sm:p-8">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">
            NEXT UP
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {hero.event.title}
          </p>
          {hero.days === 0 ? (
            <p className="mt-4 inline-flex items-center gap-2 text-4xl font-extrabold sm:text-5xl">
              <PartyPopper className="h-9 w-9 text-amber-500" /> Today!
            </p>
          ) : (
            <p className="mt-3">
              <span className="text-6xl font-extrabold tracking-tight tabular-nums sm:text-7xl">
                {hero.days}
              </span>
              <span className="ml-2 text-lg font-bold text-muted-foreground">
                {hero.days === 1 ? "day to go" : "days to go"}
              </span>
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {format(hero.next, "EEEE, d MMMM yyyy")}
            {hero.event.yearly &&
              differenceInYears(hero.next, parseISO(hero.event.date)) > 0 &&
              ` · turns ${differenceInYears(hero.next, parseISO(hero.event.date))}`}
          </p>
        </section>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Hourglass className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 font-bold">Nothing to count down to yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a trip, a deadline, a birthday — anything you're looking forward
            to.
          </p>
        </div>
      )}

      <form
        onSubmit={add}
        className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="countdown-title" className="text-xs">
            What's happening?
          </Label>
          <Input
            id="countdown-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder={
              yearlyByDefault ? "e.g. Mum's birthday" : "e.g. Trip to Goa"
            }
            className="h-10"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="countdown-date" className="text-xs">
            {yearly ? "Original date" : "Date"}
          </Label>
          <Input
            id="countdown-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10"
          />
        </div>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={yearly}
            onChange={(event) => setYearly(event.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
          Repeats yearly
        </label>
        <Button
          type="submit"
          className="h-10 gap-1.5 rounded-xl"
          disabled={!title.trim() || !date}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {rest.length > 0 && (
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map(({ event, next, days }) => (
            <CountdownCard
              key={event.id}
              event={event}
              next={next}
              days={days}
              onDelete={() =>
                update(content.events.filter((item) => item.id !== event.id))
              }
            />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            className="text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            {showPast ? "Hide" : "Show"} past events ({past.length})
          </button>
          {showPast && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {past.map(({ event, next, days }) => (
                <CountdownCard
                  key={event.id}
                  event={event}
                  next={next}
                  days={days}
                  onDelete={() =>
                    update(
                      content.events.filter((item) => item.id !== event.id)
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {hero && (
        <p className="text-center text-xs text-muted-foreground">
          {upcoming.length} upcoming · today is{" "}
          {format(parseISO(todayKey()), "d MMMM yyyy")}
        </p>
      )}
    </div>
  )
}

function CountdownCard({
  event,
  next,
  days,
  onDelete,
}: {
  event: CountdownEvent
  next: Date
  days: number
  onDelete: () => void
}) {
  return (
    <article className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4">
      <div
        className={cn(
          "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl",
          days < 0
            ? "bg-muted text-muted-foreground"
            : days <= 7
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-muted"
        )}
      >
        <span className="text-xl leading-none font-extrabold tabular-nums">
          {Math.abs(days)}
        </span>
        <span className="mt-0.5 text-[10px] font-bold">
          {days < 0 ? "days ago" : days === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{event.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {format(next, "EEE d MMM yyyy")}
          {event.yearly && (
            <Repeat className="h-3 w-3" aria-label="Repeats yearly" />
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onDelete}
        aria-label={`Delete ${event.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </article>
  )
}
