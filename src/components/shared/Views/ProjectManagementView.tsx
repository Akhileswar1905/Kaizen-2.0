import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  ArrowLeft, CalendarDays, CheckCircle2, Circle, Clock3,
  FolderKanban, Pencil, Plus, Search, Trash2, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
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
  const deleteProject = async (project: Project) => {
    if (readOnly || !user?.id || !window.confirm(`Delete "${project.name}" and all its project tasks?`)) return
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", project.id).eq("user_id", user.id)
    if (deleteError) { setError(deleteError.message); return }
    setProjects((current) => current.filter((item) => item.id !== project.id))
    setTasks((current) => current.filter((task) => task.project_id !== project.id))
    setSelectedProjectId(null)
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
  const deleteTask = async (task: ProjectTask) => {
    if (readOnly) return
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    const { error: deleteError } = await supabase.from("project_tasks").delete().eq("id", task.id).eq("user_id", user?.id)
    if (deleteError) { setError(deleteError.message); return }
    setTasks((current) => current.filter((item) => item.id !== task.id))
  }

  const statusCount = (status: ProjectStatus) => projects.filter((project) => project.status === status).length
  const taskColumns: { status: TaskStatus; title: string }[] = [
    { status: "todo", title: "To do" }, { status: "in_progress", title: "In progress" }, { status: "done", title: "Done" },
  ]

  return (
    <div className="min-h-screen px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-7">
        {selectedProject ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: selectedProject.color }} />
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.08] blur-3xl" style={{ backgroundColor: selectedProject.color }} />
              <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-3">
                  <Button variant="outline" size="icon" className="mt-0.5 shrink-0 rounded-xl" onClick={() => setSelectedProjectId(null)} aria-label="Back to projects"><ArrowLeft className="h-4 w-4" /></Button>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Project workspace</span><span className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-semibold">{statusLabel(selectedProject.status)}</span></div>
                    <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{selectedProject.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{selectedProject.description || "A focused space for this project's work."}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedProject.color }} />{selectedProject.priority} priority</span><span className="h-1 w-1 rounded-full bg-border" /><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Due {prettyDate(selectedProject.due_date)}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(selectedProject)} disabled={readOnly}><Pencil className="mr-2 h-3.5 w-3.5" />Edit project</Button><Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={() => void deleteProject(selectedProject)} disabled={readOnly} aria-label="Delete project"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-none"><CardContent className="flex h-full items-center justify-between p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Overall progress</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{progress}<span className="text-lg text-muted-foreground">%</span></p><p className="mt-1 text-xs text-muted-foreground">{completedTasks} of {projectTasks.length} tasks completed</p></div><div className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(${selectedProject.color} ${progress}%, hsl(var(--muted)) 0)` }}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-xs font-bold">{progress}%</div></div></CardContent></Card>
              <Card className="rounded-2xl border-border/60 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Task breakdown</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{projectTasks.length}</p><p className="mt-1 text-xs text-muted-foreground">{Math.max(0, projectTasks.length - completedTasks)} remaining · {completedTasks} done</p></CardContent></Card>
              <Card className="rounded-2xl border-border/60 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Target date</p><p className="mt-2 text-lg font-bold">{prettyDate(selectedProject.due_date)}</p><p className="mt-1 text-xs text-muted-foreground">Keep the momentum going</p></CardContent></Card>
            </div>
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Project tasks</h2><p className="text-sm text-muted-foreground">Break the project into manageable pieces of work.</p></div><span className="text-xs text-muted-foreground">{projectTasks.length} tasks · {progress}% complete</span></div>
              <form onSubmit={addTask} className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row"><Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add a task to this project…" className="sm:flex-1" /><Button type="submit" disabled={readOnly || saving || !newTaskTitle.trim()}><Plus className="mr-1.5 h-4 w-4" />Add task</Button></div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_170px]"><Input value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Description (optional)" /><select aria-label="Task priority" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as ProjectPriority)}>{PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label} priority</option>)}</select><Input aria-label="Task due date" type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} /></div>
              </form>
              <div className="grid gap-3 lg:grid-cols-3">
                {taskColumns.map((column) => {
                  const columnTasks = projectTasks.filter((task) => task.status === column.status)
                  return <div key={column.status} className="min-h-64 rounded-2xl border border-border/70 bg-muted/20 p-3.5"><div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", column.status === "done" ? "bg-emerald-500" : column.status === "in_progress" ? "bg-amber-500" : "bg-muted-foreground/50")} /><h3 className="text-sm font-bold">{column.title}</h3></div><span className="rounded-lg border border-border/60 bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{columnTasks.length}</span></div><div className="space-y-2">{columnTasks.map((task) => {
                    const StatusIcon = taskStatusIcon(task.status)
                    return <div key={task.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"><div className="flex items-start gap-2"><StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", task.status === "done" ? "text-emerald-600" : "text-muted-foreground")} /><div className="min-w-0 flex-1"><p className={cn("text-sm font-semibold", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</p>{task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priorityClass[task.priority])}>{task.priority}</span>{task.due_date && <span className="text-[10px] text-muted-foreground">{prettyDate(task.due_date)}</span>}</div></div><button type="button" title="Delete task" onClick={() => void deleteTask(task)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-3"><select aria-label={`Status for ${task.title}`} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={task.status} onChange={(e) => void updateTask(task, { status: e.target.value as TaskStatus })}>{TASK_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
                  })}{columnTasks.length === 0 && <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">No tasks here yet.</p>}</div></div>
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-emerald-500/[0.07] blur-3xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-600/15 bg-emerald-600/[0.07] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400"><FolderKanban className="h-3.5 w-3.5" /> Project workspace</div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Make progress, <span className="text-emerald-700 dark:text-emerald-400">project by project.</span></h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A clear view of what you're building, what's moving, and what needs attention next.</p></div>
                <Button onClick={openCreate} className="h-11 shrink-0 rounded-xl px-5 shadow-sm"><Plus className="mr-2 h-4 w-4" />New project</Button>
              </div>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr]">
              <Card className="relative overflow-hidden rounded-2xl border-emerald-700/15 bg-emerald-700/[0.045] shadow-none"><CardContent className="relative flex h-full items-center justify-between p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Your portfolio</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{projects.length}</p><p className="mt-1 text-xs text-muted-foreground">Projects in this space</p></div><FolderKanban className="mr-1 h-8 w-8 text-emerald-700/60 dark:text-emerald-400/60" /></CardContent></Card>
              <Card className="rounded-2xl border-border/60 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Active</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{statusCount("active")}</p><p className="mt-1 text-xs text-muted-foreground">Currently moving</p></CardContent></Card>
              <Card className="rounded-2xl border-border/60 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Planning</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{statusCount("planning")}</p><p className="mt-1 text-xs text-muted-foreground">Up next</p></CardContent></Card>
              <Card className="rounded-2xl border-border/60 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Completed</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{statusCount("completed")}</p><p className="mt-1 text-xs text-muted-foreground">Across this space</p></CardContent></Card>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="pl-9" /></div><div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">{[{value:"all",label:"All"},{value:"active",label:"Active"},{value:"planning",label:"Planning"},{value:"on_hold",label:"On hold"},{value:"completed",label:"Completed"}].map((item) => <button key={item.value} onClick={() => setFilter(item.value as typeof filter)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", filter === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{item.label}</button>)}</div></div>
            {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
            {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-border/60 bg-muted/30" />)}</div> : filteredProjects.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredProjects.map((project) => {
                const projectTaskList = tasks.filter((task) => task.project_id === project.id)
                const done = projectTaskList.filter((task) => task.status === "done").length
                const pct = projectTaskList.length ? Math.round(done / projectTaskList.length * 100) : 0
                return <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-0 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-lg"><div className="h-1.5 w-full" style={{ backgroundColor: project.color }} /><div className="p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{statusLabel(project.status)}</span><span className="text-[10px] font-semibold text-muted-foreground">{project.priority} priority</span></div><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} /><h2 className="truncate font-bold">{project.name}</h2></div><span className="h-8 w-8 shrink-0 rounded-xl border border-border/50 shadow-inner" style={{ backgroundColor: project.color + "20" }}><span className="flex h-full items-center justify-center text-sm font-bold" style={{ color: project.color }}>{project.name.slice(0,1).toUpperCase()}</span></span></div><p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">{project.description || "No description added."}</p><div className="mt-5 flex items-center justify-between text-xs"><span className="font-medium text-muted-foreground">Progress</span><span className="font-bold tabular-nums">{pct}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: project.color }} /></div><div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground"><span>{done}/{projectTaskList.length} tasks</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{prettyDate(project.due_date)}</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-muted-foreground">Open workspace</span><span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 transition-all group-hover:border-emerald-700/30 group-hover:bg-emerald-700 group-hover:text-white" aria-hidden>↗</span></div></div></button>
              })}</div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-5 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FolderKanban className="h-6 w-6" /></span><h2 className="mt-4 font-bold">{projects.length ? "No matching projects" : "Your projects start here"}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{projects.length ? "Try another search or status filter." : "Create a project to organise milestones, tasks, priorities and deadlines in one place."}</p>{projects.length === 0 && <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create your first project</Button>}</div>
            )}
          </>
        )}
        {error && selectedProject && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      </div>
      <ProjectDialog open={dialogOpen} initial={form} saving={saving} onClose={() => setDialogOpen(false)} onSave={(value) => void saveProject(value)} />
    </div>
  )
}
