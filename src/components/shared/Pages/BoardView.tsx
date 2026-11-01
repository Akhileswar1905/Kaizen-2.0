import { useRef, useState } from "react"
import { GripVertical, Plus, Trash2, X } from "lucide-react"
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
import { newId, type BoardCard, type BoardContent } from "@/lib/workspace"

const emptyBoard = (): BoardContent => ({
  columns: ["To do", "In progress", "Done"].map((title) => ({
    id: newId(),
    title,
  })),
  cards: [],
})

export function BoardView({
  initial,
  onChange,
}: {
  initial?: BoardContent
  onChange: (board: BoardContent) => void
}) {
  const [board, setBoard] = useState<BoardContent>(
    () => initial ?? emptyBoard()
  )
  const [editing, setEditing] = useState<BoardCard | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState("")
  const [dropColumn, setDropColumn] = useState<string | null>(null)
  const dragged = useRef<string | null>(null)

  const update = (next: BoardContent) => {
    setBoard(next)
    onChange(next)
  }

  const moveCard = (
    cardId: string,
    columnId: string,
    beforeCardId?: string
  ) => {
    const card = board.cards.find((item) => item.id === cardId)
    if (!card || cardId === beforeCardId) return
    const rest = board.cards.filter((item) => item.id !== cardId)
    const moved = { ...card, columnId }
    const index = beforeCardId
      ? rest.findIndex((item) => item.id === beforeCardId)
      : -1
    update({
      ...board,
      cards:
        index === -1
          ? [...rest, moved]
          : [...rest.slice(0, index), moved, ...rest.slice(index)],
    })
  }

  const addCard = (columnId: string) => {
    const title = newCardTitle.trim()
    if (!title) {
      setAddingTo(null)
      return
    }
    update({
      ...board,
      cards: [...board.cards, { id: newId(), columnId, title }],
    })
    setNewCardTitle("")
  }

  const renameColumn = (columnId: string, title: string) =>
    update({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    })

  const deleteColumn = (columnId: string) => {
    const count = board.cards.filter(
      (card) => card.columnId === columnId
    ).length
    if (
      count &&
      !window.confirm(
        `Delete this column and its ${count} card${count === 1 ? "" : "s"}?`
      )
    )
      return
    update({
      columns: board.columns.filter((column) => column.id !== columnId),
      cards: board.cards.filter((card) => card.columnId !== columnId),
    })
  }

  const saveCard = (card: BoardCard) => {
    update({
      ...board,
      cards: board.cards.map((item) => (item.id === card.id ? card : item)),
    })
    setEditing(null)
  }

  const deleteCard = (cardId: string) => {
    update({
      ...board,
      cards: board.cards.filter((card) => card.id !== cardId),
    })
    setEditing(null)
  }

  const endDrag = () => {
    dragged.current = null
    setDropColumn(null)
  }

  return (
    <>
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {board.columns.map((column) => {
          const cards = board.cards.filter(
            (card) => card.columnId === column.id
          )
          return (
            <section
              key={column.id}
              onDragOver={(event) => {
                if (!dragged.current) return
                event.preventDefault()
                setDropColumn(column.id)
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null
                  )
                )
                  setDropColumn(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragged.current) moveCard(dragged.current, column.id)
                endDrag()
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-border/60 bg-muted/35 p-2.5 transition-colors",
                dropColumn === column.id && "border-foreground/30 bg-muted/70"
              )}
            >
              <header className="group flex items-center gap-2 px-1">
                <input
                  value={column.title}
                  onChange={(event) =>
                    renameColumn(column.id, event.target.value)
                  }
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-bold outline-none focus:bg-background"
                  aria-label="Column name"
                />
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {cards.length}
                </span>
                <button
                  type="button"
                  onClick={() => deleteColumn(column.id)}
                  aria-label={`Delete ${column.title}`}
                  className="rounded-md p-1 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </header>

              {cards.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) => {
                    dragged.current = card.id
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", card.id)
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(event) => {
                    if (dragged.current) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (dragged.current)
                      moveCard(dragged.current, column.id, card.id)
                    endDrag()
                  }}
                  onClick={() => setEditing(card)}
                  className="group/card flex cursor-pointer items-start gap-1.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 group-hover/card:text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words">
                      {card.title}
                    </p>
                    {card.notes && (
                      <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                        {card.notes}
                      </p>
                    )}
                  </div>
                </article>
              ))}

              {addingTo === column.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    addCard(column.id)
                  }}
                  className="space-y-1.5"
                >
                  <Input
                    autoFocus
                    value={newCardTitle}
                    onChange={(event) => setNewCardTitle(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Escape" && setAddingTo(null)
                    }
                    onBlur={() => addCard(column.id)}
                    placeholder="Card title…"
                    maxLength={200}
                    className="h-9 rounded-lg bg-card"
                  />
                  <p className="px-1 text-[10px] text-muted-foreground">
                    Enter to add · Esc to cancel
                  </p>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewCardTitle("")
                    setAddingTo(column.id)
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> New card
                </button>
              )}
            </section>
          )
        })}

        <button
          type="button"
          onClick={() =>
            update({
              ...board,
              columns: [...board.columns, { id: newId(), title: "New column" }],
            })
          }
          className="flex w-60 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border px-3 py-3 text-xs font-bold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add column
        </button>
      </div>

      {editing && (
        <CardDialog
          card={editing}
          columns={board.columns}
          onClose={() => setEditing(null)}
          onSave={saveCard}
          onDelete={() => deleteCard(editing.id)}
        />
      )}
    </>
  )
}

function CardDialog({
  card,
  columns,
  onClose,
  onSave,
  onDelete,
}: {
  card: BoardCard
  columns: BoardContent["columns"]
  onClose: () => void
  onSave: (card: BoardCard) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(card.title)
  const [notes, setNotes] = useState(card.notes ?? "")
  const [columnId, setColumnId] = useState(card.columnId)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
          <DialogDescription>
            Change the details or move it to another column.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (title.trim())
              onSave({
                ...card,
                title: title.trim(),
                notes: notes.trim() || undefined,
                columnId,
              })
          }}
          className="space-y-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="card-title">Title</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="card-column">Column</Label>
            <select
              id="card-column"
              value={columnId}
              onChange={(event) => setColumnId(event.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title || "Untitled"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="card-notes">Notes</Label>
            <Textarea
              id="card-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Details, links, next steps…"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={!title.trim()}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
