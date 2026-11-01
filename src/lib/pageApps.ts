import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  setYear,
} from "date-fns"
import type { CountdownEvent, CustomPage, Flashcard } from "@/lib/workspace"

export const dateKey = (date: Date) => format(date, "yyyy-MM-dd")
export const todayKey = () => dateKey(new Date())

/** Consecutive days up to today (or yesterday, if today isn't done yet). */
export function streakFrom(isDone: (key: string) => boolean) {
  let day = new Date()
  if (!isDone(dateKey(day))) day = addDays(day, -1)
  let streak = 0
  while (isDone(dateKey(day))) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

/** The next date an event happens; yearly events roll over to next year. */
export function nextOccurrence(event: CountdownEvent, from = new Date()) {
  const date = parseISO(event.date)
  if (!event.yearly) return date
  let next = setYear(date, from.getFullYear())
  if (differenceInCalendarDays(next, from) < 0)
    next = setYear(date, from.getFullYear() + 1)
  return next
}

export const daysUntil = (date: Date) =>
  differenceInCalendarDays(date, new Date())

// Leitner boxes: how many days until a card in each box is shown again.
const BOX_INTERVALS = [0, 1, 3, 7, 16, 35]

export type Review = "again" | "good" | "easy"

export function reviewCard(card: Flashcard, review: Review): Flashcard {
  const box =
    review === "again" ? 1 : Math.min(5, card.box + (review === "easy" ? 2 : 1))
  return {
    ...card,
    box,
    due: dateKey(
      addDays(new Date(), review === "again" ? 0 : BOX_INTERVALS[box])
    ),
  }
}

export const isDue = (card: Flashcard) => card.due <= todayKey()

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`

/** One-line live status for a custom page, shown on the dashboard. */
export function pageSummary(page: CustomPage): string {
  const content = page.content
  const today = todayKey()
  switch (page.kind) {
    case "journal": {
      const entries = content.journal?.entries ?? {}
      const streak = streakFrom((key) => Boolean(entries[key]))
      return entries[today]
        ? `Written today · ${plural(streak, "day")} streak`
        : streak
          ? `${plural(streak, "day")} streak · not written today`
          : "No entry today yet"
    }
    case "tracker": {
      const tracker = content.tracker
      if (!tracker) return "Tracker"
      const value = tracker.log[today] ?? 0
      return `${value.toLocaleString()} / ${tracker.goal.toLocaleString()} ${tracker.unit} today`
    }
    case "goals": {
      const active = (content.goals?.goals ?? []).filter(
        (goal) => !goal.achievedAt
      )
      if (!active.length) return "No active goals"
      const progress = active.map((goal) =>
        goal.milestones.length
          ? goal.milestones.filter((m) => m.done).length /
            goal.milestones.length
          : 0
      )
      return `${plural(active.length, "active goal")} · ${Math.round((progress.reduce((a, b) => a + b, 0) / active.length) * 100)}% avg`
    }
    case "countdown": {
      const upcoming = (content.countdown?.events ?? [])
        .map((event) => ({ event, days: daysUntil(nextOccurrence(event)) }))
        .filter((item) => item.days >= 0)
        .sort((a, b) => a.days - b.days)[0]
      if (!upcoming) return "Nothing coming up"
      return upcoming.days === 0
        ? `${upcoming.event.title} is today`
        : `${upcoming.event.title} in ${plural(upcoming.days, "day")}`
    }
    case "flashcards": {
      const cards = content.flashcards?.cards ?? []
      const due = cards.filter(isDue).length
      return cards.length
        ? `${due} due · ${cards.filter((card) => card.box >= 5).length} of ${cards.length} mastered`
        : "No cards yet"
    }
    case "table":
      return plural(content.table?.rows.length ?? 0, "row")
    case "board": {
      const board = content.board
      if (!board) return "Board"
      const last = board.columns[board.columns.length - 1]
      const done = last
        ? board.cards.filter((card) => card.columnId === last.id).length
        : 0
      return `${plural(board.cards.length, "card")} · ${done} in ${last?.title || "last column"}`
    }
    default:
      return "Page"
  }
}
