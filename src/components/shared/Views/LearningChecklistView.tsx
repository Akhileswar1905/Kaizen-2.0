import { useMemo, useState } from "react"
import { BookOpen, CheckCircle2, Circle, GraduationCap, Layers3, Loader2, Pencil, Plus, Search, Sparkles, Target, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useLearningChecklist, type LearningChecklistItem } from "@/hooks/useLearningChecklist"

type Filter = "all" | "pending" | "completed"
export function LearningChecklistView() {
  const { items, categories, isLoading, errorMessage, createItem, updateItem, deleteItem, addCategory } = useLearningChecklist()
  const [selected, setSelected] = useState("All")
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [dialog, setDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [editing, setEditing] = useState<LearningChecklistItem | null>(null)
  const [deleting, setDeleting] = useState<LearningChecklistItem | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("DSA")
  const [newCategory, setNewCategory] = useState("")
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const completed = items.filter(item => item.is_completed).length
  const progress = items.length ? Math.round(completed / items.length * 100) : 0
  const visible = useMemo(() => items.filter(item =>
    (selected === "All" || item.category === selected) &&
    (filter === "all" || (filter === "completed" ? item.is_completed : !item.is_completed)) &&
    (!search.trim() || `${item.title} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [items, selected, filter, search])
  const openCreate = (cat = selected === "All" ? (categories[0] ?? "General") : selected) => {
    setEditing(null); setTitle(""); setDescription(""); setCategory(cat); setActionError(null); setDialog(true)
  }
  const openEdit = (item: LearningChecklistItem) => {
    setEditing(item); setTitle(item.title); setDescription(item.description ?? ""); setCategory(item.category); setActionError(null); setDialog(true)
  }
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!title.trim()) return
    setSaving(true); setActionError(null)
    const result = editing
      ? await updateItem(editing.id, { title: title.trim(), description: description.trim(), category })
      : await createItem({ title: title.trim(), description: description.trim(), category, sort_order: items.length })
    setSaving(false)
    if (result.error) { setActionError(result.error); return }
    setDialog(false)
  }
  const remove = async () => {
    if (!deleting) return
    setSaving(true); const result = await deleteItem(deleting.id); setSaving(false)
    if (result.error) { setActionError(result.error); return }
    setDeleting(null); setActionError(null)
  }
  const addNewCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!newCategory.trim()) return
    setSaving(true); setActionError(null)
    const result = await addCategory(newCategory); setSaving(false)
    if (result.error) { setActionError(result.error); return }
    setSelected(newCategory.trim()); setCategory(newCategory.trim()); setNewCategory(""); setCategoryDialog(false)
  }
  const selectedItems = items.filter(item => selected === "All" || item.category === selected)
  const selectedDone = selectedItems.filter(item => item.is_completed).length
  const selectedProgress = selectedItems.length ? Math.round(selectedDone / selectedItems.length * 100) : 0
  const categoryStats = categories.map(name => {
    const rows = items.filter(item => item.category === name)
    const done = rows.filter(item => item.is_completed).length
    return { name, total: rows.length, done, progress: rows.length ? Math.round(done / rows.length * 100) : 0 }
  })
  return <main className="learning-page min-h-screen px-3 py-5 text-foreground sm:px-6 sm:py-8">
    <div className="learning-shell mx-auto max-w-[1440px] space-y-6">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 pb-5">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><GraduationCap className="h-5 w-5 text-primary" /> Learning space</div>
        <Button variant="outline" className="rounded-xl border-border/70 bg-card/70 gap-2" onClick={() => { setActionError(null); setCategoryDialog(true) }}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New category</span><span className="sm:hidden">Category</span></Button>
      </header>

      <section className="learning-hero relative overflow-hidden rounded-[1.8rem] border border-border/60 p-5 shadow-sm sm:p-8">
        <div className="learning-hero-orb learning-hero-orb--one" />
        <div className="learning-hero-orb learning-hero-orb--two" />
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><Sparkles className="h-3.5 w-3.5" /> YOUR LEARNING JOURNEY</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Small steps. <span className="text-primary">Big progress.</span></h1>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">A clear space for everything you're learning. Pick a track, focus on the next task, and keep moving forward.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button className="rounded-xl gap-2 shadow-sm" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Add a learning task</Button>
              <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-xs font-bold text-muted-foreground"><Target className="h-4 w-4 text-primary" /> {items.length - completed} tasks left to explore</div>
            </div>
          </div>
          <div className="learning-progress-orbit mx-auto flex h-36 w-36 shrink-0 items-center justify-center rounded-full sm:h-40 sm:w-40" style={{ background: `conic-gradient(var(--primary) ${progress * 3.6}deg, color-mix(in oklch, var(--muted) 72%, transparent) 0deg)` }}>
            <div className="flex h-[82%] w-[82%] flex-col items-center justify-center rounded-full border border-border/50 bg-card/95 shadow-inner">
              <span className="text-3xl font-bold tabular-nums">{progress}%</span>
              <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">completed</span>
            </div>
          </div>
        </div>
      </section>

      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">{actionError}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="learning-metric"><div className="learning-metric-icon"><Layers3 className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Learning tracks</p><p className="mt-0.5 text-2xl font-bold tabular-nums">{categories.length}</p></div></div>
        <div className="learning-metric"><div className="learning-metric-icon learning-metric-icon--green"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tasks completed</p><p className="mt-0.5 text-2xl font-bold tabular-nums">{completed}<span className="ml-1 text-sm font-semibold text-muted-foreground">/ {items.length}</span></p></div></div>
        <div className="learning-metric"><div className="learning-metric-icon learning-metric-icon--amber"><Target className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Current focus</p><p className="mt-0.5 max-w-[12rem] truncate text-lg font-bold">{selected === "All" ? "All tracks" : selected}</p></div></div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="learning-track-panel space-y-3">
          <div className="flex items-center justify-between px-1"><h2 className="text-sm font-bold">Your learning tracks</h2><span className="text-xs font-bold text-muted-foreground">{categories.length + 1}</span></div>
          <button onClick={() => setSelected("All")} className={cn("learning-track-option w-full", selected === "All" && "is-active")}>
            <div className="learning-track-symbol"><Layers3 className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1 text-left"><span className="block text-sm font-bold">All learning</span><span className="text-xs font-semibold text-muted-foreground">{items.length} tasks across tracks</span></div>
            <span className="text-xs font-bold tabular-nums">{progress}%</span>
          </button>
          {categoryStats.map((track,index) => <button key={track.name} onClick={() => setSelected(track.name)} className={cn("learning-track-option w-full", selected === track.name && "is-active")}>
            <div className={cn("learning-track-symbol", `learning-track-symbol--${index % 5}`)}><BookOpen className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold">{track.name}</span><span className="text-xs font-semibold text-muted-foreground">{track.done} of {track.total} completed</span><span className="learning-track-bar"><span style={{width:`${track.progress}%`}} /></span></div>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{track.progress}%</span>
          </button>)}
        </aside>

        <div className="learning-task-panel min-w-0">
          <div className="flex flex-col gap-4 border-b border-border/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-widest text-primary">YOUR NEXT CHAPTER</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{selected === "All" ? "Learning roadmap" : selected}</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedDone} completed · {selectedItems.length - selectedDone} remaining · {selectedProgress}% progress</p></div>
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Add task</Button>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/80"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{width:`${selectedProgress}%`}} /></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a topic or task..." className="h-10 rounded-xl border-border/60 bg-background/70 pl-9 font-semibold" /></div>
              <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">{(["all","pending","completed"] as Filter[]).map(value => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} className={cn("rounded-lg px-3 text-xs font-bold capitalize",filter === value && "shadow-sm")} onClick={() => setFilter(value)}>{value === "all" ? "Everything" : value}</Button>)}</div>
            </div>
          </div>

          {isLoading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading your learning plan…</div> : errorMessage ? <div className="m-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"><h3 className="font-bold">Your checklist couldn't load</h3><p className="mt-1 text-sm font-semibold text-muted-foreground">{errorMessage}</p><p className="mt-2 text-sm text-muted-foreground">Run <code>supabase/learning_checklist.sql</code> in your Supabase SQL Editor first.</p></div> : visible.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><BookOpen className="h-7 w-7" /></div><h3 className="text-lg font-bold">A fresh page</h3><p className="mt-1 max-w-xs text-sm font-semibold text-muted-foreground">No tasks match this view. Try another filter or add something to your roadmap.</p><Button className="mt-4 rounded-xl" onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" /> Add your first task</Button></div> :
          <div className="divide-y divide-border/50">{(selected === "All" ? categories : [selected]).map((cat,catIndex) => { const section = visible.filter(item => item.category === cat).sort((a,b) => a.sort_order - b.sort_order); if (!section.length) return null; const done = section.filter(item => item.is_completed).length; return <section key={cat} className="learning-task-group">
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-5 sm:px-5"><div className="flex items-center gap-2"><span className={cn("learning-group-dot",`learning-group-dot--${catIndex % 5}`)} /><h3 className="text-sm font-bold">{cat}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{done}/{section.length}</span></div><Button size="sm" variant="ghost" className="h-8 rounded-lg gap-1 text-xs font-bold" onClick={() => openCreate(cat)}><Plus className="h-3.5 w-3.5" /> Add to track</Button></div>
            <div className="space-y-2 px-3 pb-4 sm:px-4">{section.map((item,index) => <article key={item.id} className={cn("learning-task-row group",item.is_completed && "is-complete")}>
              <button type="button" onClick={async () => { const result = await updateItem(item.id,{is_completed:!item.is_completed}); if(result.error) setActionError(result.error); else setActionError(null) }} className="learning-task-check" aria-label={item.is_completed ? "Mark incomplete" : "Mark complete"}>{item.is_completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button>
              <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left"><span className="block text-sm font-bold leading-snug sm:text-[15px]">{item.title}</span>{item.description && <span className="mt-1 block whitespace-pre-wrap text-xs font-semibold leading-relaxed text-muted-foreground">{item.description}</span>}</button>
              <span className="hidden shrink-0 text-[10px] font-bold text-muted-foreground/60 sm:block">{String(index+1).padStart(2,"0")}</span>
              <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(item)} aria-label="Edit task"><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => {setDeleting(item);setActionError(null)}} aria-label="Delete task"><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </article>)}</div>
          </section>})}</div>}
        </div>
      </section>
      <p className="pb-5 text-center text-xs font-semibold text-muted-foreground">Your progress is saved to your account. Keep the momentum going.</p>
    </div>
    <Dialog open={dialog} onOpenChange={open => { if (!saving) setDialog(open) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Edit learning task" : "Add learning task"}</DialogTitle><DialogDescription>Keep a task clear, actionable, and easy to revisit.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><div className="grid gap-2"><Label htmlFor="learning-title">Task title</Label><Input id="learning-title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={240} placeholder="e.g. Practice binary search" /></div><div className="grid gap-2"><Label htmlFor="learning-category">Category</Label><select id="learning-category" value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">{[...new Set([...categories,category])].map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="learning-description">Notes (optional)</Label><Textarea id="learning-description" value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={2000} placeholder="Add context, links, or what you want to remember…" /></div>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button type="button" variant="ghost" onClick={() => setDialog(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={!title.trim() || saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create task"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={categoryDialog} onOpenChange={open => { if (!saving) setCategoryDialog(open) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add a category</DialogTitle><DialogDescription>A new category starts with a task you can edit or delete.</DialogDescription></DialogHeader><form onSubmit={addNewCategory} className="space-y-4"><div className="grid gap-2"><Label htmlFor="new-learning-category">Category name</Label><Input id="new-learning-category" value={newCategory} onChange={e => setNewCategory(e.target.value)} required maxLength={80} placeholder="e.g. System Design" /></div>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button type="button" variant="ghost" onClick={() => setCategoryDialog(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={!newCategory.trim() || saving}>{saving ? "Adding…" : "Create category"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!saving && !open) setDeleting(null) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Delete this task?</DialogTitle><DialogDescription>This will permanently remove “{deleting?.title}” from your checklist.</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button variant="ghost" onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button><Button variant="destructive" onClick={() => void remove()} disabled={saving}>{saving ? "Deleting…" : "Delete task"}</Button></DialogFooter></DialogContent></Dialog>
  </main>
}
