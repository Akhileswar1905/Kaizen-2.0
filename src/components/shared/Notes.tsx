import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { RichTextEditor } from "./RichTextEditor"
import {
  Loader2,
  Trash2,
  Search,
  PenTool,
  ChevronLeft,
  SaveAll,
  Folder,
  FolderPlus,
  Plus,
  Edit3,
  FileText,
  FileInput,
  Share2,
  Download,
  X,
} from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import {
  customViewId,
  requestOpenView,
} from "@/lib/workspace"
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns"
import { cn } from "@/lib/utils"
import { useGamification } from "@/contexts/GamificationContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DRAFT_KEY = "study_studio_local_draft"

interface Note {
  id: string
  title: string
  content: string
  tag: string | null
  folder_id: string | null
  created_at: string
}

interface Category {
  id: string
  name: string
}

interface FolderRow {
  id: string
  name: string
}

// Each tag gets a stable colour derived from its name, so "Study" is always
// the same hue wherever it appears.
const TAG_STYLES = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
]

function tagStyle(tag: string | null): string {
  if (!tag) return "bg-muted text-muted-foreground"
  let hash = 0
  for (let i = 0; i < tag.length; i++)
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_STYLES[hash % TAG_STYLES.length]
}

function TagPill({
  tag,
  className,
}: {
  tag: string | null
  className?: string
}) {
  if (!tag) return null
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold",
        tagStyle(tag),
        className
      )}
    >
      {tag}
    </span>
  )
}

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), date) < 7) return "Previous 7 days"
  return format(date, "MMMM yyyy")
}

function toSnippet(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
}


/** Renders editable Mermaid source blocks as diagrams in the saved-note preview. */
function NoteContentPreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    const renderDiagrams = async () => {
      const blocks = Array.from(container.querySelectorAll("pre > code"))
        .filter((code) => code.textContent?.startsWith("%%mermaid\n"))

      if (blocks.length === 0) return

      try {
        const { default: mermaid } = await import("mermaid")
        if (cancelled) return

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        })

        for (const [index, code] of blocks.entries()) {
          if (cancelled) return
          const source = (code.textContent ?? "").replace(/^%%mermaid\n/, "").trim()
          const pre = code.parentElement
          if (!pre || !source) continue

          try {
            const { svg, bindFunctions } = await mermaid.render(
              `kaizen-mermaid-${Date.now()}-${index}`,
              source
            )
            if (cancelled) return

            const diagram = document.createElement("div")
            diagram.className = "note-mermaid-diagram"
            diagram.setAttribute("role", "img")
            diagram.setAttribute("aria-label", "Mermaid diagram")
            diagram.innerHTML = svg
            pre.replaceWith(diagram)
            bindFunctions?.(diagram)
          } catch (error) {
            const message = error instanceof Error
              ? error.message
              : "Unable to render this diagram."
            const fallback = document.createElement("p")
            fallback.className = "note-mermaid-error"
            fallback.textContent = `Diagram could not be rendered: ${message}`
            pre.replaceWith(fallback)
          }
        }
      } catch {
        if (!cancelled) {
          container.querySelectorAll("pre > code").forEach((code) => {
            if (code.textContent?.startsWith("%%mermaid\n")) {
              const note = document.createElement("p")
              note.className = "note-mermaid-error"
              note.textContent = "Mermaid could not be loaded. Check your connection and reopen this note."
              code.parentElement?.replaceWith(note)
            }
          })
        }
      }
    }

    void renderDiagrams()
    return () => {
      cancelled = true
    }
  }, [html])

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
}

interface NameFormProps {
  kind: "category" | "folder"
  existing: string[]
  onSubmit: (name: string) => Promise<string | null>
  onClose: () => void
}

// Lives inside DialogContent, so its state resets every time the dialog opens.
function NameForm({ kind, existing, onSubmit, onClose }: NameFormProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = value.trim()
    if (!name) {
      setError(`Enter a name for the ${kind}.`)
      return
    }
    if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(`You already have a ${kind} called "${name}".`)
      return
    }
    setSaving(true)
    setError(null)
    const failure = await onSubmit(name)
    setSaving(false)
    if (failure) setError(failure)
    else onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>
          {kind === "category" ? "New category" : "New folder"}
        </DialogTitle>
        <DialogDescription>
          {kind === "category"
            ? "Categories label a note and appear as filters above your list."
            : "Folders group related notes, like a subject or a course."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`new-${kind}-name`}>Name</Label>
        <Input
          id={`new-${kind}-name`}
          autoFocus
          value={value}
          maxLength={40}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          placeholder={kind === "category" ? "e.g. Interview prep" : "e.g. DSA"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `new-${kind}-error` : undefined}
        />
        {error && (
          <p
            id={`new-${kind}-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {kind === "category" ? "Add category" : "Add folder"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function NotesTracker() {
  const { user } = useAuth()
  const { triggerGamificationEvent, subtractGamificationPoints } =
    useGamification()
  const { createCustomPage, canCreatePage, pageLimit, openUpgrade } =
    useWorkspace()
  const [isConverting, setIsConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)

  // Copies the note into a custom page (with its own menu spot, sharing and
  // autosave). The original note stays here.
  const convertToPage = async (note: Note) => {
    setIsConverting(true)
    setConvertError(null)
    const result = await createCustomPage({
      title: note.title.slice(0, 60) || "Untitled page",
      icon_name: "StickyNote",
      kind: "page",
      content: { html: note.content },
    })
    setIsConverting(false)
    if (result.error || !result.page) {
      setConvertError(result.error)
      return
    }
    requestOpenView(customViewId(result.page.id))
  }

  const shareNote = async (note: Note) => {
    const parsed = new DOMParser().parseFromString(note.content, "text/html")
    const textContent = parsed.body.innerText || parsed.body.textContent || ""
    const shareText = textContent.trim()

    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, text: shareText })
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        try {
          await navigator.clipboard.writeText(`${note.title}\n\n${shareText}`)
          window.alert("Note copied to clipboard. You can paste it into any app to share.")
        } catch {
          window.alert("Sharing isn't available in this browser.")
        }
      }
      return
    }

    try {
      await navigator.clipboard.writeText(`${note.title}\n\n${shareText}`)
      window.alert("Note copied to clipboard. You can paste it into any app to share.")
    } catch {
      window.prompt("Copy your note to share it:", `${note.title}\n\n${shareText}`)
    }
  }

  const downloadNote = (note: Note) => {
    const safeTitle = note.title.trim().replace(/[\\\\/:*?"<>|]+/g, "-").slice(0, 80) || "kaizen-note"
    const exportedHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<style>
  :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  body { max-width: 860px; margin: 48px auto; padding: 0 24px; line-height: 1.7; color: CanvasText; }
  h1 { line-height: 1.2; margin-bottom: 8px; }
  .meta { color: GrayText; font-size: 13px; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { border: 1px solid GrayText; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: color-mix(in srgb, CanvasText 8%, Canvas); }
  pre { overflow-x: auto; padding: 16px; border-radius: 8px; background: color-mix(in srgb, CanvasText 8%, Canvas); }
  .mermaid { overflow-x: auto; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
<h1>${safeTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h1>
<p class="meta">Exported from Kaizen · ${new Date().toLocaleDateString()}</p>
<article>${note.content}</article>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
  for (const [index, code] of [...document.querySelectorAll("pre > code")].entries()) {
    if (!code.textContent?.startsWith("%%mermaid\n")) continue;
    const source = code.textContent.replace(/^%%mermaid\n/, "").trim();
    try {
      const { svg } = await mermaid.render("kaizen-export-" + index, source);
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid";
      wrapper.innerHTML = svg;
      code.parentElement?.replaceWith(wrapper);
    } catch (error) { console.error("Mermaid diagram failed to render", error); }
  }
</script>
</body>
</html>`

    const blob = new Blob([exportedHtml], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${safeTitle}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Core Application Workspace State
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Mobile view state for switching between list and editor on small screens
  const [mobileView, setMobileView] = useState<"list" | "editor">("list")

  // Form State
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [selectedTag, setSelectedTag] = useState("General")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // Dialogs for creating categories and folders
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)

  // Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilterTag, setActiveFilterTag] = useState("All")
  const [activeFilterFolder, setActiveFilterFolder] = useState<string | null>(
    null
  )

  // Draft State
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [hasAvailableDraft, setHasAvailableDraft] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotes()
      fetchCategories()
      fetchFolders()
    }
    checkExistingDraft()
  }, [user])

  const checkExistingDraft = () => {
    const savedDraft = localStorage.getItem(DRAFT_KEY)
    if (savedDraft) setHasAvailableDraft(true)
  }

  const loadDraft = useCallback(() => {
    const savedDraftStr = localStorage.getItem(DRAFT_KEY)
    if (savedDraftStr) {
      const draft = JSON.parse(savedDraftStr)
      setTitle(draft.title)
      setContent(draft.content)
      setSelectedTag(draft.tag)
      setSelectedFolderId(draft.folderId)
      setIsEditing(true)
      setSelectedNote(notes.find((n) => n.id === draft.noteId) || null)
      setHasAvailableDraft(false)
      setMobileView("editor")
    }
  }, [notes])

  const saveDraft = () => {
    if (!title.trim() && !content.trim()) return

    const savedAt = new Date()
    const draftData = {
      title,
      content,
      tag: selectedTag,
      folderId: selectedFolderId,
      noteId: selectedNote?.id || null,
      timestamp: savedAt.toISOString(),
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData))
    setDraftSavedAt(savedAt)
    setHasAvailableDraft(true)
  }

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraftSavedAt(null)
    setHasAvailableDraft(false)
  }

  // --- API Methods ---
  const fetchNotes = async (selectId?: string) => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setNotes(data)
      if (data.length > 0 && !hasAvailableDraft) {
        const nextSelected = selectId
          ? data.find((n) => n.id === selectId)
          : data[0]
        handleSelectNote(nextSelected || data[0])
      } else if (!hasAvailableDraft) {
        handleInitNewNote()
      }
    }
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("note_categories")
      .select("*")
      .order("name")
    if (!error && data) setCategories(data)
  }

  const fetchFolders = async () => {
    const { data, error } = await supabase
      .from("note_folders")
      .select("*")
      .order("created_at")
    if (!error && data) setFolders(data)
  }

  // Both return an error message to show in the dialog, or null on success.
  const addFolder = async (name: string): Promise<string | null> => {
    if (!user) return "Sign in to add folders."
    const { data, error } = await supabase
      .from("note_folders")
      .insert([{ name, user_id: user.id }])
      .select()
      .single()

    if (error || !data) return error?.message ?? "Could not add the folder."
    setFolders((prev) => [...prev, data])
    if (isEditing) setSelectedFolderId(data.id)
    return null
  }

  const addCategory = async (name: string): Promise<string | null> => {
    if (!user) return "Sign in to add categories."
    const { data, error } = await supabase
      .from("note_categories")
      .insert([{ name, user_id: user.id }])
      .select()
      .single()

    if (error || !data) return error?.message ?? "Could not add the category."
    setCategories((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    if (isEditing) setSelectedTag(data.name)
    return null
  }

  // --- UI Handlers ---
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setIsEditing(false)
    setTitle(note.title)
    setContent(note.content)
    setSelectedTag(note.tag ?? "General")
    setSelectedFolderId(note.folder_id || null)
    setMobileView("editor")
  }

  const handleInitNewNote = () => {
    setSelectedNote(null)
    setIsEditing(true)
    setTitle("")
    setContent("")
    setSelectedTag(categories.length > 0 ? categories[0].name : "General")
    setSelectedFolderId(activeFilterFolder)
    setMobileView("editor")
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setIsSubmitting(true)

    const payload = {
      user_id: user?.id,
      title: title.trim(),
      content: content.trim(),
      tag: selectedTag,
      folder_id: selectedFolderId,
    }

    if (selectedNote?.id) {
      const { data, error } = await supabase
        .from("notes")
        .update(payload)
        .eq("id", selectedNote.id)
        .select()
        .single()
      if (!error && data) {
        setNotes(notes.map((n) => (n.id === data.id ? data : n)))
        setSelectedNote(data)
        await triggerGamificationEvent({ type: "NOTE_SAVED", amount: 1 })
      }
    } else {
      const { data, error } = await supabase
        .from("notes")
        .insert(payload)
        .select()
        .single()
      if (!error && data) {
        setNotes([data, ...notes])
        setSelectedNote(data)
        await triggerGamificationEvent({ type: "NOTE_SAVED", amount: 1 })
      }
    }

    clearDraft()
    setIsEditing(false)
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const remainingNotes = notes.filter((n) => n.id !== id)
    setNotes(remainingNotes)

    if (selectedNote?.id === id) {
      if (remainingNotes.length > 0) handleSelectNote(remainingNotes[0])
      else handleInitNewNote()
    }
    await supabase.from("notes").delete().match({ id })
    await subtractGamificationPoints({ type: "NOTE_SAVED", amount: 1 })
  }

  const clearFilters = () => {
    setSearchQuery("")
    setActiveFilterTag("All")
    setActiveFilterFolder(null)
  }

  const folderName = (id: string | null) =>
    id ? (folders.find((f) => f.id === id)?.name ?? null) : null

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of notes) if (n.tag) counts[n.tag] = (counts[n.tag] ?? 0) + 1
    return counts
  }, [notes])

  const snippets = useMemo(
    () => new Map(notes.map((n) => [n.id, toSnippet(n.content)])),
    [notes]
  )

  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return notes.filter((note) => {
      const matchesTag =
        activeFilterTag === "All" || note.tag === activeFilterTag
      const matchesFolder =
        activeFilterFolder === null || note.folder_id === activeFilterFolder
      const matchesSearch =
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
      return matchesTag && matchesFolder && matchesSearch
    })
  }, [notes, activeFilterTag, activeFilterFolder, searchQuery])

  // Notes arrive newest first, so groups come out in the right order.
  const groupedNotes = useMemo(() => {
    const groups: { label: string; notes: Note[] }[] = []
    for (const note of filteredNotes) {
      const label = groupLabel(new Date(note.created_at))
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.notes.push(note)
      else groups.push({ label, notes: [note] })
    }
    return groups
  }, [filteredNotes])

  const hasActiveFilters =
    searchQuery !== "" ||
    activeFilterTag !== "All" ||
    activeFilterFolder !== null
  const showPanel = Boolean(selectedNote) || isEditing

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh justify-center bg-background/50 px-3 py-3 font-sans text-foreground antialiased sm:px-6 sm:py-5 md:px-10 md:py-7">
      <div className="flex w-full max-w-[1440px] animate-in flex-col gap-4 duration-500 fade-in slide-in-from-bottom-4 sm:gap-5">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="kaizen-page-heading-icon">
              <PenTool className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="kaizen-page-heading-title truncate">
                Study Notes
              </h1>
              <p className="kaizen-page-heading-description">
                Organize, edit, and review your study materials.
              </p>
            </div>
          </div>

          <Button
            onClick={handleInitNewNote}
            className="shrink-0 gap-1.5 rounded-full px-4 font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New note</span>
          </Button>
        </header>

        {/* Filters: categories on the left, folder on the right */}
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <nav
            className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-1 sm:pb-0"
            aria-label="Filter notes by category"
          >
            {["All", ...categories.map((c) => c.name)].map((tag) => {
              const active = activeFilterTag === tag
              const count = tag === "All" ? notes.length : (tagCounts[tag] ?? 0)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveFilterTag(tag)}
                  aria-pressed={active}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {tag}
                  <span
                    className={cn(
                      "tabular-nums",
                      active ? "text-background/60" : "text-muted-foreground/70"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full border-dashed"
              onClick={() => setCategoryDialogOpen(true)}
              title="Add category"
              aria-label="Add category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={activeFilterFolder ?? "all"}
              onValueChange={(v) =>
                setActiveFilterFolder(v === "all" ? null : v)
              }
            >
              <SelectTrigger
                aria-label="Filter by folder"
                className="h-8 min-w-36 flex-1 gap-2 rounded-full border-border/70 bg-card/70 text-xs font-semibold shadow-none sm:flex-none"
              >
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full border-dashed"
              onClick={() => setFolderDialogOpen(true)}
              title="Add folder"
              aria-label="Add folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Workspace Card */}
        <Card className="flex h-[calc(100dvh-15rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border bg-card/40 py-0 shadow-md backdrop-blur-sm sm:h-[calc(100dvh-13.5rem)] sm:min-h-[36rem] sm:rounded-2xl">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
              {/* COLUMN 1: Notes List */}
              <div
                className={cn(
                  "min-h-0 w-full flex-col border-border bg-background/60",
                  showPanel
                    ? "sm:flex sm:w-[44%] sm:max-w-md sm:shrink-0 sm:border-r"
                    : "sm:flex sm:flex-1",
                  // On mobile, show the preview as a focused screen after selecting a note
                  mobileView === "editor" ? "hidden" : "flex"
                )}
              >
                <div className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search notes"
                      aria-label="Search notes"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 rounded-lg border-border bg-card/60 pr-8 pl-9 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {filteredNotes.length}{" "}
                    {filteredNotes.length === 1 ? "note" : "notes"}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-3 sm:px-3">
                  {filteredNotes.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
                        <FileText className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {hasActiveFilters ? "No notes match" : "No notes yet"}
                      </p>
                      {hasActiveFilters ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="text-xs"
                        >
                          Clear filters
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleInitNewNote}
                          className="gap-1 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" /> Create one
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "mx-auto w-full",
                        !showPanel && "max-w-3xl"
                      )}
                    >
                      {groupedNotes.map((group) => (
                        <section key={group.label}>
                          <h3 className="sticky top-0 z-10 -mx-2 bg-background/90 px-4 pt-4 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase backdrop-blur sm:-mx-3 sm:px-5">
                            {group.label}
                          </h3>
                          <ul className="flex flex-col gap-1">
                            {group.notes.map((note) => {
                              const isCurrent =
                                selectedNote?.id === note.id && !isEditing
                              const noteDate = new Date(note.created_at)
                              const when = isToday(noteDate)
                                ? format(noteDate, "h:mm a")
                                : format(noteDate, "MMM d")
                              const snippet = snippets.get(note.id)
                              const folder = folderName(note.folder_id)
                              return (
                                <li key={note.id}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectNote(note)}
                                    aria-current={
                                      isCurrent ? "true" : undefined
                                    }
                                    className={cn(
                                      "flex w-full flex-col gap-1.5 rounded-xl px-3.5 py-3 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                      isCurrent
                                        ? "bg-primary/10 ring-1 ring-primary/25"
                                        : "hover:bg-accent/60 active:bg-accent"
                                    )}
                                  >
                                    <div className="flex items-baseline justify-between gap-3">
                                      <h4 className="truncate text-sm leading-5 font-semibold text-foreground">
                                        {note.title || "Untitled note"}
                                      </h4>
                                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                                        {when}
                                      </span>
                                    </div>
                                    {snippet && (
                                      <p className="line-clamp-1 text-xs leading-5 text-muted-foreground">
                                        {snippet}
                                      </p>
                                    )}
                                    <div className="flex min-w-0 items-center gap-2">
                                      <TagPill tag={note.tag} />
                                      {folder && (
                                        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                          <Folder className="h-3 w-3 shrink-0" />
                                          <span className="truncate">
                                            {folder}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMN 2: Preview / editor panel */}
              {showPanel && (
                <div
                  className={cn(
                    "min-h-0 min-w-0 flex-1 animate-in flex-col bg-card/60 duration-200 fade-in sm:slide-in-from-right-4",
                    mobileView === "list" ? "hidden sm:flex" : "flex"
                  )}
                >
                  {/* Toolbar */}
                  <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-5">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileView("list")}
                        className="gap-1 pl-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:hidden"
                      >
                        <ChevronLeft className="h-4 w-4" /> Notes
                      </Button>

                      {hasAvailableDraft && !isEditing && (
                        <Button
                          onClick={loadDraft}
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <SaveAll className="h-3.5 w-3.5" /> Restore draft
                        </Button>
                      )}

                      {isEditing && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {draftSavedAt
                            ? `Draft saved ${format(draftSavedAt, "h:mm a")}`
                            : selectedNote
                              ? "Editing"
                              : "New note"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {selectedNote && !isEditing && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void shareNote(selectedNote)}
                            className="gap-1.5 text-xs font-semibold"
                            title="Share note text"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Share</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadNote(selectedNote)}
                            className="gap-1.5 text-xs font-semibold"
                            title="Download note as an HTML file"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditing(true)
                            }}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              canCreatePage
                                ? void convertToPage(selectedNote)
                                : openUpgrade()
                            }
                            disabled={isConverting}
                            className="gap-1.5 text-xs font-semibold"
                            title={
                              canCreatePage
                                ? "Copy this note into its own page in your menu"
                                : `You've used all ${pageLimit} pages. Get more pages to convert this note.`
                            }
                          >
                            {isConverting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileInput className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              Make a page
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(selectedNote.id, e)}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete note"
                            aria-label="Delete note"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedNote(null)
                              setMobileView("list")
                            }}
                            className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Close preview"
                            aria-label="Close note preview"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {isEditing && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={saveDraft}
                            disabled={!title.trim() && !content.trim()}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <SaveAll className="h-3.5 w-3.5" />
                            Save as draft
                          </Button>
                          <Button
                            type="submit"
                            form="note-form"
                            variant="default"
                            size="sm"
                            disabled={
                              isSubmitting || (!title.trim() && !content.trim())
                            }
                            className="gap-1.5 font-semibold shadow-sm"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Done"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {convertError && (
                    <p
                      role="alert"
                      className="border-b border-destructive/20 bg-destructive/5 px-5 py-2 text-xs font-semibold text-destructive sm:px-8"
                    >
                      {convertError}
                    </p>
                  )}

                  {/* Content area */}
                  <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 md:px-12">
                    {isEditing ? (
                      <form
                        id="note-form"
                        onSubmit={handleSaveNote}
                        className="mx-auto flex h-full max-w-3xl flex-col"
                      >
                        <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
                          <div className="flex items-center gap-1">
                            <Select
                              value={selectedFolderId || "none"}
                              onValueChange={(v) =>
                                setSelectedFolderId(v === "none" ? null : v)
                              }
                            >
                              <SelectTrigger
                                aria-label="Folder"
                                className="h-8 w-auto min-w-[120px] border-border bg-background text-xs shadow-none focus:ring-0"
                              >
                                <SelectValue placeholder="Folder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No folder</SelectItem>
                                {folders.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => setFolderDialogOpen(true)}
                              title="Add folder"
                              aria-label="Add folder"
                            >
                              <FolderPlus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1">
                            <Select
                              value={selectedTag}
                              onValueChange={setSelectedTag}
                            >
                              <SelectTrigger
                                aria-label="Category"
                                className="h-8 w-auto min-w-[120px] border-border bg-background text-xs shadow-none focus:ring-0"
                              >
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.name}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => setCategoryDialogOpen(true)}
                              title="Add category"
                              aria-label="Add category"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <Input
                          placeholder="Title"
                          aria-label="Note title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="mb-3 h-auto border-none bg-transparent p-2 text-2xl font-bold shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:mb-4 sm:text-3xl"
                          required
                        />

                        <div className="flex-1 pb-12">
                          <RichTextEditor
                            value={content}
                            onChange={setContent}
                          />
                        </div>
                      </form>
                    ) : (
                      <article className="mx-auto flex max-w-3xl flex-col">
                        {selectedNote && (
                          <>
                            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <TagPill
                                tag={selectedNote.tag}
                                className="px-2.5 text-xs"
                              />
                              {folderName(selectedNote.folder_id) && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  <Folder className="h-3 w-3" />
                                  {folderName(selectedNote.folder_id)}
                                </span>
                              )}
                              <time
                                dateTime={selectedNote.created_at}
                                className="text-xs font-medium text-muted-foreground sm:ml-auto"
                              >
                                {format(
                                  new Date(selectedNote.created_at),
                                  "MMM d, yyyy · h:mm a"
                                )}
                              </time>
                            </div>
                            <h2 className="mb-6 border-b border-border/60 pb-6 text-3xl leading-tight font-bold tracking-tight text-balance text-foreground sm:text-4xl">
                              {selectedNote.title}
                            </h2>
                            <div className="note-preview pb-20 text-[15px] leading-relaxed text-foreground">
                              <NoteContentPreview html={selectedNote.content} />
                            </div>
                          </>
                        )}
                      </article>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add category / folder dialogs */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <NameForm
            kind="category"
            existing={categories.map((c) => c.name)}
            onSubmit={addCategory}
            onClose={() => setCategoryDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <NameForm
            kind="folder"
            existing={folders.map((f) => f.name)}
            onSubmit={addFolder}
            onClose={() => setFolderDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Theme variables are oklch, so reference them directly (not via hsl()). */}
      <style>{`
        .note-preview h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 0.6rem; letter-spacing: -0.01em; }
        .note-preview h2 { font-size: 1.35rem; font-weight: 700; margin: 1.5rem 0 0.6rem; letter-spacing: -0.01em; }
        .note-preview h3 { font-size: 1.1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .note-preview > div > :first-child { margin-top: 0; }
        .note-preview p { margin-bottom: 1rem; line-height: 1.7; }
        .note-preview ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .note-preview ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
        .note-preview li { margin-bottom: 0.4rem; line-height: 1.65; }
        .note-preview li::marker { color: var(--muted-foreground); }
        .note-preview strong { font-weight: 600; }
        .note-preview a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
        .note-preview blockquote { border-left: 3px solid var(--border); padding-left: 1rem; margin-bottom: 1rem; color: var(--muted-foreground); }
        .note-preview code { font-family: ui-monospace, SFMono-Regular, monospace; background: var(--muted); padding: 0.15rem 0.4rem; border-radius: 6px; font-size: 0.88em; }
        .note-preview pre { background: var(--muted); padding: 1rem; border-radius: 12px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid var(--border); }
        .note-preview pre code { background: transparent; padding: 0; }
        .note-preview img { max-width: 100%; border-radius: 10px; }
        .note-preview hr { border: 0; border-top: 1px solid var(--border); margin: 1.5rem 0; }
        .note-preview table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; table-layout: auto; }
        .note-preview th, .note-preview td { min-width: 6rem; border: 1px solid var(--border); padding: 0.65rem 0.75rem; text-align: left; vertical-align: top; }
        .note-preview th { background: var(--muted); color: var(--foreground); font-weight: 650; }
        .note-preview tr:nth-child(even) td { background: color-mix(in oklch, var(--muted) 35%, transparent); }
        .note-preview th p, .note-preview td p { margin: 0; }
        .note-preview { overflow-wrap: anywhere; }
        .note-mermaid-diagram { width: 100%; margin: 1.25rem 0; overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 1rem; }
        .note-mermaid-diagram svg { display: block; max-width: 100%; height: auto; margin-inline: auto; }
        .note-mermaid-error { margin: 1rem 0; border: 1px solid var(--destructive); border-radius: 8px; padding: 0.75rem; color: var(--destructive); font-size: 0.85rem; }
        @media (max-width: 640px) {
          .note-preview table { display: block; max-width: 100%; overflow-x: auto; white-space: nowrap; }
        }
      `}</style>
    </div>
  )
}
