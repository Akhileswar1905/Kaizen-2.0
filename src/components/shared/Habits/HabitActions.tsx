import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MoreVertical, Edit2, Trash2, Archive } from "lucide-react"
import { IconPicker } from "../Widgets/IconPicker"
import { HabitKaizenFields } from "./HabitKaizenFields"
import { kaizenValuesOf } from "@/lib/habits"

interface HabitActionsProps {
  habit: any
  onUpdate: (id: string, updates: any) => void
  onDelete: (id: string) => void
  /** Other habits, offered for habit stacking. */
  habitTitles?: string[]
}

export function HabitActions({
  habit,
  onUpdate,
  onDelete,
  habitTitles = [],
}: HabitActionsProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [title, setTitle] = useState(habit.title)
  const [description, setDescription] = useState(habit.description || "")
  const [targetDays, setTargetDays] = useState(habit.target_days.toString())
  const [iconName, setIconName] = useState(habit.icon_name || "default")
  const [kaizen, setKaizen] = useState(() => kaizenValuesOf(habit))

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(habit.id, {
      title,
      description,
      target_days: parseInt(targetDays),
      icon_name: iconName,
      identity: kaizen.identity.trim(),
      mini_version: kaizen.mini_version.trim(),
      anchor: kaizen.anchor.trim(),
      time_of_day: kaizen.time_of_day,
    })
    setIsEditDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => setIsEditDialogOpen(true)}
            className="cursor-pointer gap-2"
          >
            <Edit2 className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              onUpdate(habit.id, { is_archived: !habit.is_archived })
            }
            className="cursor-pointer gap-2"
          >
            <Archive className="h-3.5 w-3.5" />{" "}
            {habit.is_archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              if (confirm("Delete this habit permanently?")) onDelete(habit.id)
            }}
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-120">
          <DialogHeader>
            <DialogTitle>Edit Habit</DialogTitle>
            <DialogDescription>
              Adjust your habit targets and commitments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Habit Name</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Why? / Notes</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-target">Target Days/Week</Label>
                <Select value={targetDays} onValueChange={setTargetDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-icon">Icon</Label>
                <IconPicker
                  selectedIconName={iconName}
                  onSelectIcon={setIconName}
                />
              </div>
            </div>
            <HabitKaizenFields
              values={kaizen}
              onChange={setKaizen}
              otherHabits={habitTitles.filter((title) => title !== habit.title)}
            />
            <DialogFooter className="mt-4">
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
