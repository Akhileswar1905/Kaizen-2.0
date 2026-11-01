import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { IconPicker } from "../Widgets/IconPicker"
import { HabitKaizenFields } from "./HabitKaizenFields"
import { EMPTY_KAIZEN_VALUES } from "@/lib/habits"

export function AddHabitModal({
  onAddHabit,
  habitTitles = [],
}: {
  onAddHabit: (habit: any) => void
  /** Existing habits, offered for habit stacking. */
  habitTitles?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetDays, setTargetDays] = useState("7")
  const [selectedIcon, setSelectedIcon] = useState<string>("Activity")
  const [kaizen, setKaizen] = useState(EMPTY_KAIZEN_VALUES)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddHabit({
      title,
      description,
      target_days: parseInt(targetDays),
      icon_name: selectedIcon,
      identity: kaizen.identity.trim(),
      mini_version: kaizen.mini_version.trim(),
      anchor: kaizen.anchor.trim(),
      time_of_day: kaizen.time_of_day,
    })
    // Reset and close
    setTitle("")
    setDescription("")
    setTargetDays("7")
    setSelectedIcon("Activity")
    setKaizen(EMPTY_KAIZEN_VALUES)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-full" /> Add Habit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-120">
        <DialogHeader>
          <DialogTitle>New Habit</DialogTitle>
          <DialogDescription>
            What small win are you committing to?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Habit Name</Label>
            <Input
              id="title"
              placeholder="e.g. 1 LeetCode Problem"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Why? (Optional)</Label>
            <Input
              id="description"
              placeholder="e.g. To prep for interviews"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="target">Target Days/Week</Label>
              <Select value={targetDays} onValueChange={setTargetDays}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? "day" : "days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon">Icon</Label>
              <IconPicker
                selectedIconName={selectedIcon}
                onSelectIcon={(name) => setSelectedIcon(name)}
              />
            </div>
          </div>
          <HabitKaizenFields
            values={kaizen}
            onChange={setKaizen}
            otherHabits={habitTitles}
          />
          <DialogFooter className="mt-4">
            <Button type="submit" className="w-full">
              Create Habit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
