import { useState } from "react"
import { format, parseISO } from "date-fns"
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { daysUntil } from "@/lib/pageApps"
import { newId, type Goal, type GoalsContent } from "@/lib/workspace"

const progressOf = (goal: Goal) =>
  goal.achievedAt
    ? 100
    : goal.milestones.length
      ? Math.round(
          (goal.milestones.filter((m) => m.done).length /
            goal.milestones.length) *
            100
        )
      : 0

function dueLabel(goal: Goal) {
  if (!goal.due) return null
  const days = daysUntil(parseISO(goal.due))
  if (goal.achievedAt)
    return {
      text: `Due ${format(parseISO(goal.due), "d MMM yyyy")}`,
      tone: "text-muted-foreground",
    }
  if (days < 0)
    return {
      text: `${-days} day${days === -1 ? "" : "s"} overdue`,
      tone: "text-destructive",
    }
  if (days === 0)
    return { text: "Due today", tone: "text-amber-600 dark:text-amber-400" }
  return {
    text: `${days} day${days === 1 ? "" : "s"} left`,
    tone:
      days <= 7
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground",
  }
}

type Draft = { id?: string; title: string; why: string; due: string }

export function GoalsApp({
  initial,
  onChange,
}: {
  initial?: GoalsContent
  onChange: (goals: GoalsContent) => void
}) {
  const [content, setContent] = useState<GoalsContent>(
    () => initial ?? { goals: [] }
  )
  const [filter, setFilter] = useState<"active" | "achieved">("active")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [newMilestone, setNewMilestone] = useState<Record<string, string>>({})

  const update = (goals: Goal[]) => {
    const next = { goals }
    setContent(next)
    onChange(next)
  }
  const updateGoal = (id: string, changes: Partial<Goal>) =>
    update(
      content.goals.map((goal) =>
        goal.id === id ? { ...goal, ...changes } : goal
      )
    )

  const active = content.goals.filter((goal) => !goal.achievedAt)
  const achieved = content.goals.filter((goal) => goal.achievedAt)
  const visible = (filter === "active" ? active : achieved).sort((a, b) =>
    (a.due ?? "9999").localeCompare(b.due ?? "9999")
  )
  const averageProgress = active.length
    ? Math.round(
        active.reduce((sum, goal) => sum + progressOf(goal), 0) / active.length
      )
    : 0

  const saveDraft = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim()) return
    const fields = {
      title: draft.title.trim(),
      why: draft.why.trim() || undefined,
      due: draft.due || null,
    }
    if (draft.id) updateGoal(draft.id, fields)
    else
      update([
        ...content.goals,
        {
          id: newId(),
          milestones: [],
          createdAt: new Date().toISOString(),
          ...fields,
        },
      ])
    setDraft(null)
  }

  const addMilestone = (goal: Goal) => {
    const title = newMilestone[goal.id]?.trim()
    if (!title) return
    updateGoal(goal.id, {
      milestones: [...goal.milestones, { id: newId(), title, done: false }],
    })
    setNewMilestone({ ...newMilestone, [goal.id]: "" })
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Active goals", value: active.length, icon: Target },
          {
            label: "Average progress",
            value: `${averageProgress}%`,
            icon: CalendarClock,
          },
          { label: "Achieved", value: achieved.length, icon: Trophy },
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
          {(["active", "achieved"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "secondary" : "ghost"}
              className="rounded-lg px-3 text-xs font-bold capitalize"
              onClick={() => setFilter(value)}
            >
              {value} ({value === "active" ? active.length : achieved.length})
            </Button>
          ))}
        </div>
        <Button
          className="gap-1.5 rounded-xl"
          onClick={() => setDraft({ title: "", why: "", due: "" })}
        >
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 font-bold">
            {filter === "active" ? "No active goals" : "Nothing achieved yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "active"
              ? "Set a goal and break it into small milestones."
              : "Achieved goals will be celebrated here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((goal) => {
            const progress = progressOf(goal)
            const due = dueLabel(goal)
            return (
              <article
                key={goal.id}
                className={cn(
                  "group rounded-2xl border border-border/70 bg-card p-4",
                  goal.achievedAt && "opacity-80"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="leading-snug font-extrabold">
                      {goal.title}
                    </h3>
                    {goal.why && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                        Why: {goal.why}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setDraft({
                          id: goal.id,
                          title: goal.title,
                          why: goal.why ?? "",
                          due: goal.due ?? "",
                        })
                      }
                      aria-label="Edit goal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() =>
                        window.confirm(`Delete “${goal.title}”?`) &&
                        update(
                          content.goals.filter((item) => item.id !== goal.id)
                        )
                      }
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        progress === 100 ? "bg-emerald-500" : "bg-foreground/70"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold tabular-nums">
                    {progress}%
                  </span>
                </div>
                {due && (
                  <p className={cn("mt-1 text-xs font-semibold", due.tone)}>
                    {due.text}
                  </p>
                )}

                <div className="mt-3 space-y-1">
                  {goal.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="group/m flex items-center gap-2 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          updateGoal(goal.id, {
                            milestones: goal.milestones.map((m) =>
                              m.id === milestone.id
                                ? { ...m, done: !m.done }
                                : m
                            ),
                          })
                        }
                        className={
                          milestone.done
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                        aria-label={
                          milestone.done
                            ? "Mark milestone not done"
                            : "Mark milestone done"
                        }
                      >
                        {milestone.done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <span
                        className={cn(
                          "min-w-0 flex-1 font-semibold",
                          milestone.done && "text-muted-foreground line-through"
                        )}
                      >
                        {milestone.title}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateGoal(goal.id, {
                            milestones: goal.milestones.filter(
                              (m) => m.id !== milestone.id
                            ),
                          })
                        }
                        className="text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover/m:opacity-100"
                        aria-label="Remove milestone"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {!goal.achievedAt && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        addMilestone(goal)
                      }}
                      className="flex items-center gap-2 pt-1"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        value={newMilestone[goal.id] ?? ""}
                        onChange={(event) =>
                          setNewMilestone({
                            ...newMilestone,
                            [goal.id]: event.target.value,
                          })
                        }
                        placeholder="Add a milestone…"
                        maxLength={160}
                        className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground"
                      />
                    </form>
                  )}
                </div>

                <div className="mt-4 border-t border-border/50 pt-3">
                  {goal.achievedAt ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                        <Trophy className="h-3.5 w-3.5" /> Achieved{" "}
                        {format(parseISO(goal.achievedAt), "d MMM yyyy")}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateGoal(goal.id, { achievedAt: null })
                        }
                        className="inline-flex items-center gap-1 font-bold text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="h-3 w-3" /> Reopen
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={progress === 100 ? "default" : "outline"}
                      className="w-full gap-1.5 rounded-lg"
                      onClick={() =>
                        updateGoal(goal.id, {
                          achievedAt: new Date().toISOString(),
                        })
                      }
                    >
                      <Trophy className="h-3.5 w-3.5" /> Mark as achieved
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit goal" : "New goal"}</DialogTitle>
            <DialogDescription>
              Make it specific. You can break it into milestones after.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={saveDraft} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="goal-title">Goal</Label>
                <Input
                  id="goal-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  required
                  maxLength={160}
                  placeholder="e.g. Read 12 books this year"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="goal-why">Why it matters (optional)</Label>
                <Textarea
                  id="goal-why"
                  value={draft.why}
                  onChange={(event) =>
                    setDraft({ ...draft, why: event.target.value })
                  }
                  rows={2}
                  maxLength={300}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="goal-due">Deadline (optional)</Label>
                <Input
                  id="goal-due"
                  type="date"
                  value={draft.due}
                  onChange={(event) =>
                    setDraft({ ...draft, due: event.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!draft.title.trim()}>
                  {draft.id ? "Save goal" : "Add goal"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
