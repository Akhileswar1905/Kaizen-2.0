import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  BookOpenCheck,
  Eye,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { isDue, reviewCard, todayKey, type Review } from "@/lib/pageApps"
import { newId, type Flashcard, type FlashcardsContent } from "@/lib/workspace"

const REVIEWS: {
  value: Review
  label: string
  hint: string
  className: string
}[] = [
  {
    value: "again",
    label: "Again",
    hint: "Didn't know it",
    className:
      "border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300",
  },
  {
    value: "good",
    label: "Good",
    hint: "Got it",
    className: "border-border hover:bg-muted",
  },
  {
    value: "easy",
    label: "Easy",
    hint: "Knew it instantly",
    className:
      "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
  },
]

export function FlashcardsApp({
  initial,
  onChange,
}: {
  initial?: FlashcardsContent
  onChange: (flashcards: FlashcardsContent) => void
}) {
  const [content, setContent] = useState<FlashcardsContent>(
    () => initial ?? { cards: [] }
  )
  const [mode, setMode] = useState<"study" | "cards">("study")
  const [revealed, setRevealed] = useState(false)
  const [reviewedToday, setReviewedToday] = useState(0)
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const update = (cards: Flashcard[]) => {
    const next = { cards }
    setContent(next)
    onChange(next)
  }

  const due = content.cards
    .filter(isDue)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due))
  const current = due[0]
  const mastered = content.cards.filter((card) => card.box >= 5).length

  const review = (value: Review) => {
    if (!current) return
    update(
      content.cards.map((card) =>
        card.id === current.id ? reviewCard(card, value) : card
      )
    )
    setRevealed(false)
    setReviewedToday((count) => count + 1)
  }

  const saveCard = (event: React.FormEvent) => {
    event.preventDefault()
    if (!front.trim() || !back.trim()) return
    if (editingId)
      update(
        content.cards.map((card) =>
          card.id === editingId
            ? { ...card, front: front.trim(), back: back.trim() }
            : card
        )
      )
    else
      update([
        ...content.cards,
        {
          id: newId(),
          front: front.trim(),
          back: back.trim(),
          box: 1,
          due: todayKey(),
        },
      ])
    setFront("")
    setBack("")
    setEditingId(null)
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query
      ? content.cards.filter((card) =>
          `${card.front} ${card.back}`.toLowerCase().includes(query)
        )
      : content.cards
  }, [content.cards, search])

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Due now", value: due.length, icon: BookOpenCheck },
          { label: "Cards", value: content.cards.length, icon: Layers },
          { label: "Mastered", value: mastered, icon: Trophy },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4"
          >
            <stat.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {stat.value}
            </p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </section>

      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 sm:w-fit">
        {(["study", "cards"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? "secondary" : "ghost"}
            className="flex-1 rounded-lg px-4 text-xs font-bold"
            onClick={() => setMode(value)}
          >
            {value === "study"
              ? "Study"
              : `Manage cards (${content.cards.length})`}
          </Button>
        ))}
      </div>

      {mode === "study" ? (
        current ? (
          <section className="mx-auto max-w-2xl space-y-4">
            <p className="text-center text-xs font-bold text-muted-foreground">
              {due.length} left today · box {current.box} of 5
            </p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-3xl border border-border/70 bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md sm:p-10"
            >
              <p className="text-xl leading-snug font-extrabold whitespace-pre-wrap sm:text-2xl">
                {current.front}
              </p>
              {revealed ? (
                <>
                  <div className="h-px w-16 bg-border" />
                  <p className="text-base leading-relaxed font-normal whitespace-pre-wrap text-muted-foreground sm:text-lg">
                    {current.back}
                  </p>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Click to show the answer
                </span>
              )}
            </button>
            {revealed && (
              <div className="grid grid-cols-3 gap-2">
                {REVIEWS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => review(option.value)}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-center transition-colors",
                      option.className
                    )}
                  >
                    <span className="block text-sm font-extrabold">
                      {option.label}
                    </span>
                    <span className="block text-[11px] font-normal opacity-80">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border p-10 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-lg font-extrabold">
              {content.cards.length ? "All caught up!" : "Add your first cards"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {content.cards.length
                ? `${reviewedToday ? `You reviewed ${reviewedToday} card${reviewedToday === 1 ? "" : "s"}. ` : ""}Next card is due ${format(parseISO([...content.cards].sort((a, b) => a.due.localeCompare(b.due))[0].due), "EEE d MMM")}.`
                : "Write a question on the front and the answer on the back."}
            </p>
            {!content.cards.length && (
              <Button
                className="mt-4 rounded-xl"
                onClick={() => setMode("cards")}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add cards
              </Button>
            )}
          </div>
        )
      ) : (
        <section className="space-y-4">
          <form
            onSubmit={saveCard}
            className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4 md:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="card-front" className="text-xs">
                Front (question)
              </Label>
              <Textarea
                id="card-front"
                value={front}
                onChange={(event) => setFront(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. Capital of Japan?"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="card-back" className="text-xs">
                Back (answer)
              </Label>
              <Textarea
                id="card-back"
                value={back}
                onChange={(event) => setBack(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. Tokyo"
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button
                type="submit"
                className="gap-1.5 rounded-xl"
                disabled={!front.trim() || !back.trim()}
              >
                <Plus className="h-4 w-4" />{" "}
                {editingId ? "Save card" : "Add card"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null)
                    setFront("")
                    setBack("")
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {content.cards.length > 0 && (
            <div className="relative max-w-xs">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cards…"
                className="h-9 rounded-xl pl-9"
              />
            </div>
          )}

          <div className="divide-y divide-border/50 rounded-2xl border border-border/70 bg-card">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {content.cards.length
                  ? "No cards match your search."
                  : "No cards yet."}
              </p>
            ) : (
              filtered.map((card) => (
                <div
                  key={card.id}
                  className="group flex items-start gap-3 px-4 py-3"
                >
                  <span
                    className="mt-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums"
                    title="Leitner box"
                  >
                    {card.box}/5
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{card.front}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">
                      {card.back}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {isDue(card) ? "Due" : format(parseISO(card.due), "d MMM")}
                  </span>
                  <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingId(card.id)
                        setFront(card.front)
                        setBack(card.back)
                      }}
                      aria-label="Edit card"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() =>
                        update(
                          content.cards.filter((item) => item.id !== card.id)
                        )
                      }
                      aria-label="Delete card"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
