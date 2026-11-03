import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { systemDesignSyllabus, type SystemModule } from "@/lib/systemDesign"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  ExternalLink,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGamification } from "@/contexts/GamificationContext"

interface SystemDesignHubProps {
  onBack: () => void
}

export function SystemDesignHub({ onBack }: SystemDesignHubProps) {
  const { user } = useAuth()
  const userId = user?.id
  const { triggerGamificationEvent, subtractGamificationPoints } =
    useGamification()

  const [selectedModule, setSelectedModule] = useState<SystemModule | null>(
    null
  )
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) fetchUserProgress()
  }, [userId])

  const fetchUserProgress = async () => {
    const { data } = await supabase
      .from("system_design_progress")
      .select("module_number, topic_index")
      .eq("user_id", userId)

    if (data) {
      const keys = new Set(
        data.map((row) => `${row.module_number}-${row.topic_index}`)
      )
      setCompletedSet(keys)
    }
    setLoading(false)
  }

  const toggleTopicCompletion = async (moduleId: number, topicIdx: number) => {
    if (!userId) return
    const key = `${moduleId}-${topicIdx}`
    const updated = new Set(completedSet)
    const isDone = updated.has(key)

    if (isDone) {
      updated.delete(key)
      await supabase.from("system_design_progress").delete().match({
        user_id: userId,
        module_number: moduleId,
        topic_index: topicIdx,
      })
      await subtractGamificationPoints({
        type: "SYSTEM_DESIGN_MODULE",
        amount: 1,
      })
    } else {
      updated.add(key)
      await supabase.from("system_design_progress").upsert({
        user_id: userId,
        module_number: moduleId,
        topic_index: topicIdx,
      })
      await triggerGamificationEvent({
        type: "SYSTEM_DESIGN_MODULE",
        amount: 1,
      })
    }
    setCompletedSet(updated)
  }

  const totalTopicsCount = systemDesignSyllabus.reduce(
    (acc, m) => acc + m.topics.length,
    0
  )
  const systemCompletionRate =
    Math.round((completedSet.size / totalTopicsCount) * 100) || 0

  if (loading)
    return (
      <div className="flex min-h-screen justify-center p-4 sm:p-6 md:p-8">
        <div className="h-96 w-full max-w-5xl animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
      </div>
    )

  // ---------------------------------------------------------------------------
  // GRID OVERVIEW DASHBOARD VIEW
  // ---------------------------------------------------------------------------
  if (!selectedModule) {
    return (
      <div className="animate-fade-in flex min-h-screen justify-center bg-background p-4 font-sans text-foreground sm:p-6 md:p-8">
        <div className="w-full max-w-5xl space-y-8">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="h-9 w-9 shrink-0 rounded-xl border-border/60 transition-all duration-200 hover:bg-muted/50 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="kaizen-page-heading-icon"><Layers /></div>
                <div className="min-w-0">
                  <h1 className="kaizen-page-heading-title">System Design Architecture</h1>
                  <p className="kaizen-page-heading-description">
                    Continuous mastery of large-scale foundations
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Core Jumbotron Panel */}
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl space-y-1.5">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <BookOpen className="h-4 w-4 text-foreground/60" />
                  Curriculum Blueprint
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  A structured engineering indexing interface tracking
                  blueprints mapped directly from Donnie Martin's Open Source
                  Core Primer repository.
                </p>
              </div>
              <div className="w-full shrink-0 rounded-xl border border-border/40 bg-muted/10 p-4 sm:w-64">
                <div className="mb-2 flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  <span>Total Milestones</span>
                  <span className="font-mono font-semibold text-foreground">
                    {systemCompletionRate}%
                  </span>
                </div>
                <Progress
                  value={systemCompletionRate}
                  className="h-1.5 bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Grid Layout Layer */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemDesignSyllabus.map((mod) => {
              const completedCount = mod.topics.filter((_, idx) =>
                completedSet.has(`${mod.id}-${idx}`)
              ).length
              const isFullyCompleted = completedCount === mod.topics.length

              return (
                <Card
                  key={mod.id}
                  className={cn(
                    "group relative overflow-hidden border border-border/40 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-sm",
                    isFullyCompleted && "border-border/60 bg-muted/5"
                  )}
                >
                  <CardContent className="flex h-full flex-col justify-between space-y-5 px-5 pt-5 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-3xl font-bold tracking-tighter text-foreground opacity-15 select-none">
                          {String(mod.id).padStart(2, "0")}
                        </span>
                        <span className="rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                          {mod.totalChapters || mod.topics.length} Chapters
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-foreground/90">
                          {mod.title}
                        </h3>
                        <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground/80">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/30 pt-3">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Index Status:{" "}
                        <span className="font-mono font-bold text-foreground">
                          {completedCount}
                        </span>
                        <span className="text-muted-foreground/40">
                          /{mod.topics.length}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModule(mod)}
                        className="h-7 rounded-lg border border-transparent px-2.5 text-xs font-semibold text-foreground/80 hover:border-border/40 hover:bg-muted"
                      >
                        Enter Module
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // INNER MODULE DOCUMENTATION DETAILED VIEW
  // ---------------------------------------------------------------------------
  const moduleCompletedCount = selectedModule.topics.filter((_, idx) =>
    completedSet.has(`${selectedModule.id}-${idx}`)
  ).length
  const modulePercent =
    Math.round((moduleCompletedCount / selectedModule.topics.length) * 100) || 0

  return (
    <div className="animate-fade-in flex min-h-screen justify-center bg-background p-4 font-sans text-foreground sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <div className="flex h-[calc(100vh-6rem)] min-h-150 w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Navigation Context Node Header */}
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/10 px-6 py-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg border-border/60 transition-transform hover:bg-background active:scale-95"
                  onClick={() => setSelectedModule(null)}
                >
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </Button>
                <div>
                  <h2 className="line-clamp-1 text-sm font-bold tracking-tight text-foreground">
                    {selectedModule.title}
                  </h2>
                  <p className="hidden text-[11px] text-muted-foreground sm:block">
                    Module technical index mapping & progress checkpoints
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="xs:block hidden text-right">
                  <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Completion Rate
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground/90">
                    {moduleCompletedCount}/{selectedModule.topics.length} (
                    {modulePercent}%)
                  </span>
                </div>
                <Progress
                  value={modulePercent}
                  className="h-1.5 w-24 bg-muted"
                />
              </div>
            </div>

            {/* Nested Document Layout Matrix */}
            <ScrollArea className="flex-1 bg-muted/5 px-6 py-4">
              <div className="mx-auto max-w-3xl space-y-2 py-2">
                {selectedModule.topics.map((topic, index) => {
                  const isDone = completedSet.has(
                    `${selectedModule.id}-${index}`
                  )
                  return (
                    <div
                      key={index}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border border-border/40 p-3.5 transition-all duration-200 hover:border-border/80 hover:bg-card",
                        isDone
                          ? "border-border/20 bg-muted/10 opacity-70 hover:opacity-100"
                          : "bg-card"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <button
                          onClick={() =>
                            toggleTopicCompletion(selectedModule.id, index)
                          }
                          className="shrink-0 transition-transform focus:outline-none active:scale-90"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5 stroke-2 text-foreground" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                          )}
                        </button>
                        <div className="min-w-0 space-y-0.5">
                          <span
                            className={cn(
                              "block truncate text-sm font-semibold tracking-tight text-foreground transition-colors",
                              isDone &&
                                "text-muted-foreground/70 line-through decoration-muted-foreground/30"
                            )}
                          >
                            {topic.title}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/70">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3 opacity-60" />{" "}
                              {topic.readTime || "10m"}
                            </span>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="font-mono">
                              Chapter {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-lg border border-transparent opacity-0 transition-opacity group-hover:opacity-100 hover:border-border/40 hover:bg-muted"
                        asChild
                      >
                        <a
                          href={`https://github.com/donnemartin/system-design-primer#${topic.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
