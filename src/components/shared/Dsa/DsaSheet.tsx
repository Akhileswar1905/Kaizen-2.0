import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  ExternalLink,
  Code2,
  Loader2,
  Trophy,
  CheckCircle2,
  FileText,
  Save,
  Search,
  Target,
  BookOpen,
  ArrowUpRight,
} from "lucide-react"
import { useTracker } from "@/hooks/useTracker"

export function DsaSheet() {
  // Assumes useTracker now provides:
  // - dsaNotes: Record<string, string> (e.g., { "problem-123": "Used two pointers..." })
  // - saveDsaNote: (problemId: string, note: string) => Promise<void>
  const {
    dsaData,
    dsaCompleted,
    toggleDsaProblem,
    dsaNotes = {},
    saveDsaNote,
  } = useTracker()

  // Track which problem card elements have their notes drawer expanded
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  )

  // Keep local draft states so typing is ultra-smooth and doesn't trigger cloud updates on every keystroke
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  if (Object.keys(dsaData).length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="animate-pulse text-sm font-medium text-muted-foreground">
          Syncing with Supabase...
        </p>
      </div>
    )
  }

  const firstCategory = Object.keys(dsaData)[0]

  const allProblems = Object.values(dsaData).flat()
  const totalCount = allProblems.length
  const completedCount = dsaCompleted.length
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const toggleNotesDrawer = (problemId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [problemId]: !prev[problemId] }))

    // Initialize the local input text with existing database notes if not already touched
    if (localNotes[problemId] === undefined) {
      setLocalNotes((prev) => ({
        ...prev,
        [problemId]: dsaNotes[problemId] || "",
      }))
    }
  }

  return (
    <div className="dsa-workspace mx-auto max-w-5xl animate-in space-y-7 p-4 duration-500 fade-in slide-in-from-bottom-4 md:p-7">
      {/* Dynamic Header Workspace */}
      <div className="dsa-header flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3"><div className="kaizen-page-heading-icon"><Code2 /></div><div><h1 className="kaizen-page-heading-title">DSA Sheet</h1>
            <p className="kaizen-page-heading-description">
              Build problem-solving skills through structured practice.
            </p></div></div>
          </div>
        </div>

        {/* Gamified Analytics Card */}
        <div className="dsa-progress flex items-center gap-4 rounded-2xl border bg-card/40 p-3 px-4 shadow-sm backdrop-blur-md sm:w-auto">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-30 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono text-foreground">
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Topic navigator and focused problem workspace */}
      <div className="dsa-overview grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Target className="h-4 w-4" /> Your practice overview
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-black tracking-tight">{completedCount}<span className="ml-1 text-base font-semibold text-muted-foreground">/ {totalCount}</span></p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">problems completed</p>
            </div>
            <p className="text-2xl font-black tracking-tight">{progressPercent}%</p>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/75 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-muted/25 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><BookOpen className="h-4 w-4" /> Practice library</div>
          <div><p className="text-3xl font-black tracking-tight">{Object.keys(dsaData).length}</p><p className="mt-1 text-sm font-medium text-muted-foreground">learning topics</p></div>
        </div>
      </div>

      <div className="dsa-layout grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="dsa-topic-panel rounded-2xl border border-border/60 bg-card/60 p-3">
          <div className="px-2 pb-3 pt-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Topics</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose a track to practice</p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {Object.entries(dsaData).map(([category, problems]) => {
              const done = problems.filter((p) => dsaCompleted.includes(p.id)).length
              const selected = (activeCategory || firstCategory) === category
              const pct = problems.length ? Math.round((done / problems.length) * 100) : 0
              return (
                <button key={category} type="button" onClick={() => setActiveCategory(category)}
                  className={`dsa-topic w-full rounded-xl border p-3 text-left transition-all ${selected ? "border-foreground/15 bg-muted shadow-sm" : "border-transparent hover:border-border/70 hover:bg-muted/50"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${selected ? "text-foreground" : "text-muted-foreground"}`}>{category}</span>
                    {selected && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <span className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{done} of {problems.length} solved</span><span>{pct}%</span>
                  </span>
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-foreground/55" style={{ width: `${pct}%` }} />
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="dsa-problem-workspace min-w-0 space-y-4">
          {(() => {
            const category = activeCategory || firstCategory
            const problems = dsaData[category] || []
            const filteredProblems = problems.filter((problem) => problem.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
            const doneInCategory = problems.filter((p) => dsaCompleted.includes(p.id)).length
            return <>
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/65 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current topic</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight">{category}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{doneInCategory} completed · {problems.length - doneInCategory} remaining</p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Find a problem..." className="h-10 rounded-xl border-border/70 bg-background/70 pl-9" />
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <div><h3 className="text-sm font-bold">Problem set</h3><p className="text-xs text-muted-foreground">Work through each problem and capture your approach.</p></div>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">{filteredProblems.length} problems</span>
              </div>

              <div className="space-y-2.5">
                {filteredProblems.map((problem, index) => {
                  const isDone = dsaCompleted.includes(problem.id)
                  const isExpanded = !!expandedNotes[problem.id]
                  const hasExistingNote = !!dsaNotes[problem.id]?.trim()
                  const difficulty = problem.difficulty === "Easy" ? "Easy" : problem.difficulty === "Medium" ? "Medium" : "Hard"
                  return (
                    <article key={problem.id} className={`dsa-problem-row group overflow-hidden rounded-2xl border border-border/70 bg-card/75 transition-all hover:border-foreground/20 hover:shadow-md ${isDone ? "is-solved" : ""}`}>
                      <div className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
                        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground sm:flex">{String(index + 1).padStart(2, "0")}</span>
                        <Checkbox id={problem.id} checked={isDone} onCheckedChange={() => toggleDsaProblem(problem.id, isDone)} className="h-5 w-5 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1">
                          <label htmlFor={problem.id} className={`block cursor-pointer text-sm font-bold leading-snug ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>{problem.title}</label>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{difficulty}</span>
                            {isDone && <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> Completed</span>}
                            {hasExistingNote && <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><FileText className="h-3 w-3" /> Notes saved</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant={isExpanded ? "secondary" : "ghost"} size="icon" onClick={() => toggleNotesDrawer(problem.id)} className="h-9 w-9 rounded-xl text-muted-foreground" title="Toggle notes"><FileText className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-xl text-muted-foreground"><a href={problem.url} target="_blank" rel="noreferrer" title="Open problem"><ExternalLink className="h-4 w-4" /></a></Button>
                        </div>
                      </div>
                      {isExpanded && <div className="space-y-3 border-t border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">YOUR APPROACH & NOTES</span>{localNotes[problem.id] !== dsaNotes[problem.id] && <span className="text-[10px] font-semibold text-muted-foreground">Unsaved changes</span>}</div>
                        <div className="flex items-end gap-2">
                          <Textarea className="min-h-20 flex-1 rounded-xl border-border/70 bg-background/80 text-sm leading-relaxed" placeholder="Capture the key insight, algorithm, complexity and what you learned..." value={localNotes[problem.id] ?? (dsaNotes[problem.id] || "")} onChange={(e) => setLocalNotes((prev) => ({ ...prev, [problem.id]: e.target.value }))} />
                          <Button size="icon" onClick={() => saveDsaNote(problem.id, localNotes[problem.id] ?? dsaNotes[problem.id] ?? "")} className="h-10 w-10 shrink-0 rounded-xl" title="Save notes"><Save className="h-4 w-4" /></Button>
                        </div>
                      </div>}
                    </article>
                  )
                })}
                {filteredProblems.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Search className="mx-auto h-6 w-6 text-muted-foreground/60" /><p className="mt-2 text-sm font-semibold">No matching problems</p><p className="mt-1 text-xs text-muted-foreground">Try another search term.</p></div>}
              </div>
            </>
          })()}
        </section>
      </div>
    </div>
  )
}
