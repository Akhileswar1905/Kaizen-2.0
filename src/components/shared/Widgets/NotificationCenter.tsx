import { useMemo, useState } from "react"
import {
  addHours,
  addMinutes,
  format,
  isToday,
  isTomorrow,
  setHours,
  startOfHour,
  addDays,
  startOfDay,
} from "date-fns"
import {
  AlarmClock,
  BellOff,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/contexts/NotificationContext"
import {
  LEAD_OPTIONS,
  REPEAT_LABELS,
  nextOccurrence,
  type ReminderRepeat,
} from "@/lib/notifications"

const when = (date: Date) =>
  `${isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEE d MMM")}, ${format(date, "HH:mm")}`

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && (
          <span className="block text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all",
            checked ? "left-[1.125rem]" : "left-0.5"
          )}
        />
      </button>
    </label>
  )
}

export function NotificationCenter({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const {
    prefs,
    setPrefs,
    permission,
    requestPermission,
    reminders,
    remindersError,
    addReminder,
    updateReminder,
    deleteReminder,
    blocks,
    sendTest,
  } = useNotifications()
  const [tab, setTab] = useState("upcoming")

  const upcoming = useMemo(() => {
    const now = new Date()
    const items: {
      key: string
      at: Date
      title: string
      detail: string
      kind: "block" | "reminder"
    }[] = []
    if (prefs.timeBlocks)
      for (const block of blocks) {
        const start = new Date(`${block.date}T${block.start}:00`)
        if (start <= now) continue
        const alertAt = addMinutes(start, -prefs.leadMinutes)
        items.push({
          key: `b-${block.id}`,
          at: start,
          title: block.title,
          detail: `${block.start} – ${block.end} · alert ${prefs.leadMinutes ? `at ${format(alertAt, "HH:mm")}` : "when it starts"}`,
          kind: "block",
        })
      }
    if (prefs.reminders)
      for (const reminder of reminders) {
        if (!reminder.is_active) continue
        const next = nextOccurrence(reminder, now)
        if (next)
          items.push({
            key: `r-${reminder.id}`,
            at: next,
            title: reminder.title,
            detail: REPEAT_LABELS[reminder.repeat],
            kind: "reminder",
          })
      }
    return items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 12)
  }, [blocks, reminders, prefs])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notifications & reminders</DialogTitle>
          <DialogDescription>
            Get a nudge before your time blocks start, and set reminders for
            anything else.
          </DialogDescription>
        </DialogHeader>

        <PermissionBanner
          permission={permission}
          onEnable={() => void requestPermission()}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-3">
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <AlarmClock className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-bold">Nothing scheduled</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Time blocks for today and tomorrow, and your reminders, show
                  up here.
                </p>
                <Button
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => setTab("reminders")}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add a reminder
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50 rounded-xl border border-border/70">
                {upcoming.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {item.kind === "block" ? (
                        <CalendarClock className="h-4 w-4" />
                      ) : (
                        <AlarmClock className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.title}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                      {when(item.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reminders" className="mt-3 space-y-4">
            {remindersError ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive"
              >
                Reminders couldn't load: {remindersError}
                <span className="mt-1 block font-normal text-muted-foreground">
                  Run <code>supabase/reminders.sql</code> in your Supabase SQL
                  Editor, then reopen this.
                </span>
              </div>
            ) : (
              <ReminderForm onAdd={addReminder} />
            )}
            <ReminderList
              reminders={reminders}
              onToggle={(id, active) =>
                void updateReminder(id, { is_active: active })
              }
              onDelete={(id) => void deleteReminder(id)}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-3">
            <div className="divide-y divide-border/50">
              <Toggle
                label="Time block alerts"
                hint="A heads-up before each block in your planner"
                checked={prefs.timeBlocks}
                onChange={(timeBlocks) => setPrefs({ ...prefs, timeBlocks })}
              />
              {prefs.timeBlocks && (
                <>
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <Label
                      htmlFor="lead-minutes"
                      className="text-sm font-semibold"
                    >
                      Notify me
                    </Label>
                    <select
                      id="lead-minutes"
                      value={prefs.leadMinutes}
                      onChange={(event) =>
                        setPrefs({
                          ...prefs,
                          leadMinutes: Number(event.target.value),
                        })
                      }
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {LEAD_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes === 0
                            ? "When it starts"
                            : minutes === 60
                              ? "1 hour before"
                              : `${minutes} min before`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {prefs.leadMinutes > 0 && (
                    <Toggle
                      label="Also notify when it starts"
                      checked={prefs.atStart}
                      onChange={(atStart) => setPrefs({ ...prefs, atStart })}
                    />
                  )}
                </>
              )}
              <Toggle
                label="Reminders"
                checked={prefs.reminders}
                onChange={(value) => setPrefs({ ...prefs, reminders: value })}
              />
              <Toggle
                label="Play a sound"
                checked={prefs.sound}
                onChange={(sound) => setPrefs({ ...prefs, sound })}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                These settings are saved on this device.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg"
                onClick={() => {
                  onClose()
                  // Give the dialog a moment to close so the test shows like a real alert.
                  setTimeout(sendTest, 300)
                }}
              >
                Send a test
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function PermissionBanner({
  permission,
  onEnable,
}: {
  permission: string
  onEnable: () => void
}) {
  if (permission === "granted")
    return (
      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Desktop notifications are on.
        Kaizen needs to be open (a background tab is fine).
      </p>
    )
  if (permission === "unsupported")
    return (
      <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" /> This browser can't show
        system notifications, so alerts will appear inside Kaizen while it's
        open.
      </p>
    )
  if (permission === "denied")
    return (
      <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" /> Notifications are
        blocked for this site. Allow them from the lock icon in your browser's
        address bar, then reload. Until then, alerts appear inside Kaizen.
      </p>
    )
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
      <p className="flex items-start gap-2 text-xs font-semibold">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Turn on
        desktop notifications so you see alerts even when Kaizen is in the
        background.
      </p>
      <Button size="sm" className="shrink-0 rounded-lg" onClick={onEnable}>
        Turn on
      </Button>
    </div>
  )
}

function ReminderForm({
  onAdd,
}: {
  onAdd: (input: {
    title: string
    note: string | null
    remind_at: string
    repeat: ReminderRepeat
  }) => Promise<{ error: string | null }>
}) {
  const nextHour = startOfHour(addHours(new Date(), 1))
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [date, setDate] = useState(format(nextHour, "yyyy-MM-dd"))
  const [time, setTime] = useState(format(nextHour, "HH:mm"))
  const [repeat, setRepeat] = useState<ReminderRepeat>("none")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const presets = [
    { label: "In 15 min", at: addMinutes(new Date(), 15) },
    { label: "In 1 hour", at: addHours(new Date(), 1) },
    { label: "This evening", at: setHours(startOfDay(new Date()), 19) },
    {
      label: "Tomorrow 9:00",
      at: setHours(startOfDay(addDays(new Date(), 1)), 9),
    },
  ].filter((preset) => preset.at > new Date())

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const at = new Date(`${date}T${time}:00`)
    if (Number.isNaN(at.getTime()))
      return setError("Pick a valid date and time.")
    if (repeat === "none" && at <= new Date())
      return setError("Pick a time in the future.")
    setSaving(true)
    const result = await onAdd({
      title: title.trim(),
      note: note.trim() || null,
      remind_at: at.toISOString(),
      repeat,
    })
    setSaving(false)
    setError(result.error)
    if (!result.error) {
      setTitle("")
      setNote("")
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border/70 p-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="reminder-title" className="text-xs">
          Remind me to…
        </Label>
        <Input
          id="reminder-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="e.g. Take a break and stretch"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setDate(format(preset.at, "yyyy-MM-dd"))
              setTime(format(preset.at, "HH:mm"))
            }}
            className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Date"
          className="h-9"
        />
        <Input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-label="Time"
          className="h-9 w-28"
        />
        <select
          value={repeat}
          onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}
          aria-label="Repeat"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {(Object.keys(REPEAT_LABELS) as ReminderRepeat[]).map((value) => (
            <option key={value} value={value}>
              {REPEAT_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={240}
        placeholder="Note (optional)"
        className="h-9"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        className="w-full gap-1.5 rounded-lg"
        disabled={!title.trim() || saving}
      >
        <Plus className="h-3.5 w-3.5" /> {saving ? "Adding…" : "Add reminder"}
      </Button>
    </form>
  )
}

function ReminderList({
  reminders,
  onToggle,
  onDelete,
}: {
  reminders: ReturnType<typeof useNotifications>["reminders"]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const now = new Date()
  const active = reminders
    .filter((reminder) => reminder.is_active)
    .map((reminder) => ({ reminder, next: nextOccurrence(reminder, now) }))
    .sort(
      (a, b) =>
        (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity)
    )
  const done = reminders.filter((reminder) => !reminder.is_active)

  if (!reminders.length) return null

  const row = (reminder: (typeof reminders)[number], next: Date | null) => (
    <div
      key={reminder.id}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5",
        !reminder.is_active && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-bold",
            !reminder.is_active && reminder.repeat === "none" && "line-through"
          )}
        >
          {reminder.title}
        </p>
        <p className="truncate text-xs font-normal text-muted-foreground">
          {REPEAT_LABELS[reminder.repeat]}
          {next
            ? ` · next ${when(next)}`
            : reminder.repeat === "none"
              ? ` · ${when(new Date(reminder.remind_at))}`
              : " · paused"}
          {reminder.note ? ` · ${reminder.note}` : ""}
        </p>
      </div>
      {reminder.repeat !== "none" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggle(reminder.id, !reminder.is_active)}
          aria-label={reminder.is_active ? "Pause reminder" : "Resume reminder"}
          title={reminder.is_active ? "Pause" : "Resume"}
        >
          {reminder.is_active ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:text-destructive"
        onClick={() => onDelete(reminder.id)}
        aria-label="Delete reminder"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-2">
      {active.length > 0 && (
        <div className="divide-y divide-border/50 rounded-xl border border-border/70">
          {active.map(({ reminder, next }) => row(reminder, next))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            {showDone ? "Hide" : "Show"} finished & paused ({done.length})
          </button>
          {showDone && (
            <div className="divide-y divide-border/50 rounded-xl border border-border/70">
              {done.map((reminder) => row(reminder, null))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
