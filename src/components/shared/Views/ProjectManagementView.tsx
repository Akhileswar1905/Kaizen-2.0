import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  ArrowLeft, CalendarDays, CheckCircle2, Circle, Clock3,
  FolderKanban, Pencil, Plus, Search, Trash2, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type ProjectStatus = "planning" | "active" | "on_hold" | "completed"
type ProjectPriority = "low" | "medium" | "high"
type TaskStatus = "todo" | "in_progress" | "done"
type Project = {
  id: string
  user_id: string
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  color: string
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
}
type ProjectTask = {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string
  status: TaskStatus
  priority: ProjectPriority
  due_date: string | null
  sort_order: number
  created_at: string
  updated_at: string
}
type ProjectForm = {
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  color: string
  start_date: string
  due_date: string
}
const EMPTY_FORM: ProjectForm = {
  name: "", description: "", status: "active", priority: "medium",
  color: "#64748b", start_date: format(new Date(), "yyyy-MM-dd"), due_date: "",
}
const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
]
const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
]
const PRIORITIES: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]
const statusLabel = (status: ProjectStatus) =>
  PROJECT_STATUSES.find((item) => item.value === status)?.label ?? status
const priorityClass: Record<ProjectPriority, string> = {
  low: "text-muted-foreground bg-muted",
  medium: "text-foreground/75 bg-muted",
  high: "text-amber-700 bg-amber-500/10 dark:text-amber-300",
}
const taskStatusIcon = (status: TaskStatus) => {
  if (status === "done") return CheckCircle2
  if (status === "in_progress") return Clock3
  return Circle
}
const prettyDate = (value: string | null) => {
  if (!value) return "No deadline"
  try { return format(parseISO(value), "MMM d, yyyy") } catch { return value }
}

function ProjectDialog({
  open, initial, saving, onClose, onSave,
}: {
  open: boolean
  initial: ProjectForm
  saving: boolean
  onClose: () => void
  onSave: (form: ProjectForm) => void
}) {
  const [form, setForm] = useState(initial)
  useEffect(() => { if (open) setForm(initial) }, [open, initial])
  if (!open) return null
  const update = (key: keyof ProjectForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form onSubmit={(event) => { event.preventDefault(); onSave(form) }} className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl border border-border/70 bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-bold">{initial.name ? "Edit project" : "New project"}</h2><p className="mt-1 text-sm text-muted-foreground">Give this project a name and a clear direction.</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-2"><label className="text-sm font-semibold">Project name</label><Input autoFocus required maxLength={90} placeholder="e.g. Portfolio redesign" value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
        <div className="space-y-2"><label className="text-sm font-semibold">Description</label><Textarea rows={3} placeholder="What are you trying to accomplish?" value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><label className="text-sm font-semibold">Status</label><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => update("status", e.target.value)}>{PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="space-y-2"><label className="text-sm font-semibold">Priority</label><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.priority} onChange={(e) => update("priority", e.target.value)}>{PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div className="space-y-2"><label className="text-sm font-semibold">Start date</label><Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} /></div>
          <div className="space-y-2"><label className="text-sm font-semibold">Target date</label><Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Project colour</label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <label className="relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border shadow-sm" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : "#64748b" }}>
              <input type="color" aria-label="Choose project colour" value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : "#64748b"} onChange={(event) => update("color", event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              <span className="pointer-events-none text-xs font-bold text-white drop-shadow">Aa</span>
            </label>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">HEX value</label>
              <Input value={form.color} maxLength={7} placeholder="#64748b" onChange={(event) => update("color", event.target.value)} className="h-9 font-mono uppercase" />
            </div>
            <span className="text-xs text-muted-foreground">Choose any colour</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save project"}</Button></div>
      </form>
    </div>
  )
}

export function ProjectManagementView({ customPageId, readOnly = false }: { customPageId: string; readOnly?: boolean }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all")
  const [taskView, setTaskView] = useState<"board" | "list">("board")
  const [projectView, setProjectView] = useState<"board" | "list">("board")
  const [pendingConfirmation, setPendingConfirmation] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState<ProjectPriority>("medium")
  const [newTaskDueDate, setNewTaskDueDate] = useState("")

  const loadData = useCallback(async () => {
    if (!user?.id) { setProjects([]); setTasks([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    const [projectResult, taskResult] = await Promise.all([
      supabase.from("projects").select("*").eq("user_id", user.id).eq("custom_page_id", customPageId).order("updated_at", { ascending: false }),
      supabase.from("project_tasks").select("*").eq("user_id", user.id).order("sort_order").order("created_at"),
    ])
    if (projectResult.error || taskResult.error) {
      const message = projectResult.error?.message ?? taskResult.error?.message ?? "Unable to load projects."
      setError(message.includes("does not exist") ? "Project storage is not set up yet. Run database/project_management.sql in your Supabase SQL Editor, then reload this page." : message)
    } else {
      setProjects((projectResult.data ?? []) as Project[])
      setTasks((taskResult.data ?? []) as ProjectTask[])
    }
    setLoading(false)
  }, [user?.id, customPageId])

  useEffect(() => { void loadData() }, [loadData])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const projectTasks = useMemo(() => tasks.filter((task) => task.project_id === selectedProjectId), [tasks, selectedProjectId])
  const completedTasks = projectTasks.filter((task) => task.status === "done").length
  const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchesSearch = (project.name + " " + project.description).toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (filter === "all" || project.status === filter)
  }), [projects, search, filter])

  const openCreate = () => { setEditingProject(null); setForm(EMPTY_FORM); setDialogOpen(true) }
  const openEdit = (project: Project) => {
    setEditingProject(project)
    setForm({ name: project.name, description: project.description ?? "", status: project.status, priority: project.priority, color: project.color, start_date: project.start_date ?? "", due_date: project.due_date ?? "" })
    setDialogOpen(true)
  }
  const saveProject = async (value: ProjectForm) => {
    if (!user?.id || readOnly) return
    setSaving(true); setError(null)
    const payload = {
      custom_page_id: customPageId, name: value.name.trim(), description: value.description.trim(), status: value.status,
      priority: value.priority, color: value.color, start_date: value.start_date || null,
      due_date: value.due_date || null, updated_at: new Date().toISOString(),
    }
    const result = editingProject
      ? await supabase.from("projects").update(payload).eq("id", editingProject.id).eq("user_id", user.id).select().single()
      : await supabase.from("projects").insert({ ...payload, user_id: user.id }).select().single()
    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    const saved = result.data as Project
    setProjects((current) => editingProject ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
    setSelectedProjectId(saved.id)
    setDialogOpen(false)
  }
  const deleteProject = (project: Project) => {
    if (readOnly || !user?.id) return
    setPendingConfirmation({
      title: "Delete project?",
      description: `“${project.name}” and all its project tasks will be permanently deleted.`,
      action: async () => {
        const { error: deleteError } = await supabase.from("projects").delete().eq("id", project.id).eq("user_id", user.id)
        if (deleteError) { setError(deleteError.message); return }
        setProjects((current) => current.filter((item) => item.id !== project.id))
        setTasks((current) => current.filter((task) => task.project_id !== project.id))
        setSelectedProjectId(null)
      },
    })
  }
  const addTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (readOnly || !user?.id || !selectedProject || !newTaskTitle.trim()) return
    setSaving(true); setError(null)
    const { data, error: insertError } = await supabase.from("project_tasks").insert({
      project_id: selectedProject.id, user_id: user.id, title: newTaskTitle.trim(),
      description: newTaskDescription.trim(), status: "todo", priority: newTaskPriority,
      due_date: newTaskDueDate || null, sort_order: projectTasks.length,
    }).select().single()
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setTasks((current) => [...current, data as ProjectTask])
    setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskPriority("medium"); setNewTaskDueDate("")
  }
  const updateTask = async (task: ProjectTask, changes: Partial<Pick<ProjectTask, "status" | "priority">>) => {
    if (readOnly) return
    const { data, error: updateError } = await supabase.from("project_tasks").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", task.id).eq("user_id", user?.id).select().single()
    if (updateError) { setError(updateError.message); return }
    setTasks((current) => current.map((item) => item.id === task.id ? data as ProjectTask : item))
  }
  const deleteTask = (task: ProjectTask) => {
    if (readOnly) return
    setPendingConfirmation({
      title: "Delete task?",
      description: `“${task.title}” will be permanently deleted from this project.`,
      action: async () => {
        const { error: deleteError } = await supabase.from("project_tasks").delete().eq("id", task.id).eq("user_id", user?.id)
        if (deleteError) { setError(deleteError.message); return }
        setTasks((current) => current.filter((item) => item.id !== task.id))
      },
    })
  }

  const statusCount = (status: ProjectStatus) => projects.filter((project) => project.status === status).length
  const taskColumns: { status: TaskStatus; title: string }[] = [
    { status: "todo", title: "To do" }, { status: "in_progress", title: "In progress" }, { status: "done", title: "Done" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProjectDialog open={dialogOpen} initial={form} saving={saving} onClose={() => setDialogOpen(false)} onSave={(value) => void saveProject(value)} />
      {pendingConfirmation && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingConfirmation(null) }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="project-confirm-title" className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-5 shadow-2xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></div>
            <h2 id="project-confirm-title" className="text-base font-semibold">{pendingConfirmation.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{pendingConfirmation.description}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingConfirmation(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { const action = pendingConfirmation.action; setPendingConfirmation(null); void action() }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
      {selectedProject ? (
        <div className="mx-auto max-w-[1500px]">
          <div className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => setSelectedProjectId(null)} aria-label="Back to all projects"><ArrowLeft className="h-4 w-4" /></Button>
                <div className="h-8 w-1 rounded-full" style={{ backgroundColor: selectedProject.color }} />
                <div className="min-w-0"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Projects</span><span>/</span><span className="truncate text-foreground">{selectedProject.name}</span></div><h1 className="truncate text-base font-bold">{selectedProject.name}</h1></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-md border border-border px-2.5 py-1.5 text-xs font-medium sm:inline-flex">{statusLabel(selectedProject.status)}</span>
                <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => openEdit(selectedProject)} disabled={readOnly}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => void deleteProject(selectedProject)} disabled={readOnly} aria-label="Delete project"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_270px]">
            <main className="min-w-0 px-4 py-6 sm:px-7 sm:py-8">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: selectedProject.color, backgroundColor: selectedProject.color + "18" }}>{selectedProject.priority} priority</span>{selectedProject.due_date && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Due {prettyDate(selectedProject.due_date)}</span>}</div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{selectedProject.name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedProject.description || "No project description yet."}</p></div>
                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-1">
                  <button onClick={() => setTaskView("board")} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition-colors", taskView === "board" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Board</button>
                  <button onClick={() => setTaskView("list")} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition-colors", taskView === "list" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>List</button>
                </div>
              </div>
              <div className="mb-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Completion</p><div className="mt-1 flex items-baseline gap-1"><span className="text-2xl font-bold tabular-nums">{progress}%</span><span className="text-xs text-muted-foreground">done</span></div><div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: progress + "%", backgroundColor: selectedProject.color }} /></div></div>
                <div className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Total tasks</p><p className="mt-1 text-2xl font-bold tabular-nums">{projectTasks.length}</p><p className="mt-1 text-xs text-muted-foreground">{completedTasks} completed · {projectTasks.length - completedTasks} remaining</p></div>
                <div className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs text-muted-foreground">Target date</p><p className="mt-1 text-lg font-bold">{prettyDate(selectedProject.due_date)}</p><p className="mt-1 text-xs text-muted-foreground">Project deadline</p></div>
              </div>
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold">Work items</h3><p className="mt-0.5 text-xs text-muted-foreground">Plan, track and move work forward.</p></div><span className="text-xs text-muted-foreground">{projectTasks.length} items</span></div>
                <form onSubmit={addTask} className="mb-5 rounded-xl border border-border/70 bg-card p-3">
                  <div className="flex flex-col gap-2 sm:flex-row"><Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add a work item…" className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 sm:flex-1" /><Button type="submit" size="sm" className="h-9 rounded-lg" disabled={readOnly || saving || !newTaskTitle.trim()}><Plus className="mr-1.5 h-4 w-4" />Add task</Button></div>
                  <div className="grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[1fr_140px_160px]"><Input value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Add a description (optional)" className="h-9 text-xs" /><select aria-label="Task priority" className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as ProjectPriority)}>{PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label} priority</option>)}</select><Input aria-label="Task due date" type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="h-9 text-xs" /></div>
                </form>
                {taskView === "board" ? (
                  <div className="grid gap-3 xl:grid-cols-3">{taskColumns.map((column) => {
                    const columnTasks = projectTasks.filter((task) => task.status === column.status)
                    return <div key={column.status} className="min-h-[340px] rounded-xl bg-muted/45 p-3">
                      <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", column.status === "done" ? "bg-emerald-500" : column.status === "in_progress" ? "bg-blue-500" : "bg-muted-foreground/50")} /><h4 className="text-xs font-bold">{column.title}</h4><span className="text-xs text-muted-foreground">{columnTasks.length}</span></div></div>
                      <div className="space-y-2">{columnTasks.map((task) => {
                        const StatusIcon = taskStatusIcon(task.status)
                        return <article key={task.id} className="rounded-lg border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"><div className="flex items-start gap-2"><StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", task.status === "done" ? "text-emerald-600" : "text-muted-foreground")} /><div className="min-w-0 flex-1"><p className={cn("text-sm font-medium leading-5", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</p>{task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", priorityClass[task.priority])}>{task.priority}</span>{task.due_date && <span className="text-[10px] text-muted-foreground">{prettyDate(task.due_date)}</span>}</div></div><button type="button" title="Delete task" onClick={() => void deleteTask(task)} disabled={readOnly} className="rounded p-1 text-muted-foreground opacity-70 hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div><select aria-label={`Status for ${task.title}`} className="mt-3 h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs" value={task.status} onChange={(e) => void updateTask(task, { status: e.target.value as TaskStatus })} disabled={readOnly}>{TASK_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></article>
                      })}{columnTasks.length === 0 && <div className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">Drop work here by changing its status.</div>}</div>
                    </div>
                  })}</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card"><div className="grid grid-cols-[minmax(0,1fr)_120px_100px_40px] gap-3 border-b border-border/70 bg-muted/35 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Task</span><span>Status</span><span>Priority</span><span /></div>{projectTasks.map((task) => <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_120px_100px_40px] items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p>{task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}</div><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(e) => void updateTask(task, { status: e.target.value as TaskStatus })} className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs" disabled={readOnly}>{TASK_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label={`Priority for ${task.title}`} value={task.priority} onChange={(e) => void updateTask(task, { priority: e.target.value as ProjectPriority })} className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs" disabled={readOnly}>{PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" title="Delete task" onClick={() => void deleteTask(task)} disabled={readOnly} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
                )}
              </section>
            </main>
            <aside className="border-t border-border/70 bg-muted/15 px-4 py-6 lg:min-h-[calc(100vh-65px)] lg:border-l lg:border-t-0 lg:px-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project details</h3>
              <div className="mt-4 space-y-4">
                <div><p className="text-[11px] text-muted-foreground">Status</p><p className="mt-1 text-sm font-semibold">{statusLabel(selectedProject.status)}</p></div><div className="border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Priority</p><p className="mt-1 text-sm font-semibold capitalize">{selectedProject.priority}</p></div><div className="border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Start date</p><p className="mt-1 text-sm font-semibold">{prettyDate(selectedProject.start_date)}</p></div><div className="border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Due date</p><p className="mt-1 text-sm font-semibold">{prettyDate(selectedProject.due_date)}</p></div><div className="border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Created</p><p className="mt-1 text-sm font-semibold">{prettyDate(selectedProject.created_at?.slice(0,10) ?? null)}</p></div>
              </div>
              <div className="mt-7 rounded-xl border border-border/70 bg-card p-3"><p className="text-xs font-semibold">Project health</p><div className="mt-3 flex items-center justify-between text-xs"><span className="text-muted-foreground">Tasks completed</span><span className="font-bold">{completedTasks}/{projectTasks.length}</span></div><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: progress + "%", backgroundColor: selectedProject.color }} /></div></div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><FolderKanban className="h-4 w-4" /> WORKSPACE <span>/</span> PROJECTS</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1><p className="mt-1 text-sm text-muted-foreground">Plan work, track progress and keep every initiative moving.</p></div><Button onClick={openCreate} className="h-10 rounded-lg px-4" disabled={readOnly}><Plus className="mr-2 h-4 w-4" />New project</Button></header>
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <section><h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Views</h2><div className="space-y-1">{[{value:"all",label:"All projects"},{value:"active",label:"Active"},{value:"planning",label:"Planning"},{value:"on_hold",label:"On hold"},{value:"completed",label:"Completed"}].map((item) => <button key={item.value} onClick={() => setFilter(item.value as typeof filter)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors", filter === item.value ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}><span>{item.label}</span><span className="text-xs tabular-nums">{item.value === "all" ? projects.length : statusCount(item.value as ProjectStatus)}</span></button>)}</div></section>
              <section className="border-t border-border/70 pt-5"><h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Portfolio</h2><div className="rounded-xl border border-border/70 bg-card p-3"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Active projects</span><span className="font-bold">{statusCount("active")}</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-muted-foreground">Completed</span><span className="font-bold">{statusCount("completed")}</span></div><div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600" style={{ width: (projects.length ? statusCount("completed") / projects.length * 100 : 0) + "%" }} /></div></div></section>
            </aside>
            <main className="min-w-0">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="h-10 rounded-xl pl-9" /></div><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{filteredProjects.length} projects</span><div className="flex rounded-xl border border-border/70 bg-muted/35 p-1"><button onClick={() => setProjectView("board")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", projectView === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>Board</button><button onClick={() => setProjectView("list")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", projectView === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>List</button></div></div></div>
              {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
              {loading ? <div className="space-y-2">{[1,2,3,4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}</div> : filteredProjects.length ? (
                projectView === "board" ? (
                  <div className="grid gap-3 xl:grid-cols-4">{PROJECT_STATUSES.map((status) => {
                    const columnProjects = filteredProjects.filter((project) => project.status === status.value)
                    return <section key={status.value} className="min-h-[300px] rounded-2xl bg-muted/35 p-3">
                      <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", status.value === "completed" ? "bg-emerald-500" : status.value === "active" ? "bg-blue-500" : status.value === "on_hold" ? "bg-amber-500" : "bg-muted-foreground/50")} /><h3 className="text-xs font-semibold">{status.label}</h3></div><span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{columnProjects.length}</span></div>
                      <div className="space-y-2">{columnProjects.map((project) => {
                        const list = tasks.filter((task) => task.project_id === project.id)
                        const done = list.filter((task) => task.status === "done").length
                        const pct = list.length ? Math.round(done / list.length * 100) : 0
                        return <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className="w-full rounded-xl border border-border/65 bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md">
                          <div className="mb-2 flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} /><span className="truncate">{project.name}</span></span><span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold capitalize", priorityClass[project.priority])}>{project.priority}</span></div>
                          <p className="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{project.description || "No description added"}</p>
                          <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground"><span>{list.length} tasks</span><span>{prettyDate(project.due_date)}</span></div>
                          <div className="mt-2 flex items-center gap-2"><div className="h-1 flex-1 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: project.color }} /></div><span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{pct}%</span></div>
                        </button>
                      })}{columnProjects.length === 0 && <div className="rounded-xl border border-dashed border-border/60 px-3 py-8 text-center text-[11px] text-muted-foreground">No projects</div>}</div>
                    </section>
                  })}</div>
                ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card"><div className="hidden grid-cols-[minmax(220px,1.6fr)_120px_100px_120px_110px] gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid"><span>Project</span><span>Status</span><span>Priority</span><span>Progress</span><span>Due date</span></div>{filteredProjects.map((project) => {
                  const list = tasks.filter((task) => task.project_id === project.id)
                  const done = list.filter((task) => task.status === "done").length
                  const pct = list.length ? Math.round(done / list.length * 100) : 0
                  return <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className="grid w-full grid-cols-1 gap-2 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/30 md:grid-cols-[minmax(220px,1.6fr)_120px_100px_120px_110px] md:items-center md:gap-3"><span className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ color: project.color, backgroundColor: project.color + "18" }}>{project.name.slice(0,1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{project.name}</span><span className="block truncate text-xs text-muted-foreground">{project.description || "No description"}</span></span></span><span className="text-xs text-muted-foreground md:block">{statusLabel(project.status)}</span><span className="text-xs capitalize text-muted-foreground">{project.priority}</span><span className="flex items-center gap-2 text-xs"><span className="h-1.5 flex-1 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: pct + "%", backgroundColor: project.color }} /></span><span className="w-8 text-right tabular-nums">{pct}%</span></span><span className="text-xs text-muted-foreground">{prettyDate(project.due_date)}</span></button>
                })}</div>
                )
              ) : <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-5 text-center"><FolderKanban className="h-8 w-8 text-muted-foreground/60" /><h2 className="mt-3 text-sm font-semibold">{projects.length ? "No matching projects" : "Create your first project"}</h2><p className="mt-1 max-w-sm text-xs text-muted-foreground">{projects.length ? "Try another search or choose a different view." : "Start by adding a project to organise work, tasks and deadlines."}</p>{projects.length === 0 && <Button className="mt-4" size="sm" onClick={openCreate} disabled={readOnly}><Plus className="mr-2 h-4 w-4" />Create project</Button>}</div>}
            </main>
          </div>
        </div>
      )}
      {error && selectedProject && <div role="alert" className="mx-auto max-w-[1500px] px-7 pb-5 text-sm text-destructive">{error}</div>}
    </div>
  )
}
