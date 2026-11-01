import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TIME_OF_DAY,
  type HabitKaizenValues,
  type TimeOfDay,
} from "@/lib/habits"

/** Identity, 2-minute version, habit stack and time of day for a habit. */
export function HabitKaizenFields({
  values,
  onChange,
  otherHabits,
}: {
  values: HabitKaizenValues
  onChange: (values: HabitKaizenValues) => void
  /** Titles offered as anchors for habit stacking. */
  otherHabits: string[]
}) {
  const id = useId()
  const set = (changes: Partial<HabitKaizenValues>) =>
    onChange({ ...values, ...changes })

  return (
    <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/25 p-3">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-identity`}>Who does this make you?</Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">
            I am
          </span>
          <Input
            id={`${id}-identity`}
            placeholder="a reader"
            value={values.identity}
            onChange={(e) => set({ identity: e.target.value })}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Every check-in is a vote for this identity. Habits with the same
          identity share their votes.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-mini`}>2-minute version</Label>
        <Input
          id={`${id}-mini`}
          placeholder="e.g. Read one page"
          value={values.mini_version}
          onChange={(e) => set({ mini_version: e.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">
          For hard days. It keeps your run alive and counts half on the 1%
          curve.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-anchor`}>Stack it: after…</Label>
          <Input
            id={`${id}-anchor`}
            list={`${id}-anchors`}
            placeholder="morning coffee, or another habit"
            value={values.anchor}
            onChange={(e) => set({ anchor: e.target.value })}
          />
          <datalist id={`${id}-anchors`}>
            {otherHabits.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-when`}>When</Label>
          <Select
            value={values.time_of_day}
            onValueChange={(value) => set({ time_of_day: value as TimeOfDay })}
          >
            <SelectTrigger id={`${id}-when`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OF_DAY.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
