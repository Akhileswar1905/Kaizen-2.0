import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Activity,
  Flame,
  X,
  Snowflake, // Added Snowflake icon for the streak freeze
} from "lucide-react"
import { useTracker } from "@/hooks/useTracker"
import { subDays, format } from "date-fns"
import { FloatingMenu } from "../Widgets/FloatingMenu"
import { DsaSheet } from "../Dsa/DsaSheet"
import { JournalView } from "./JournalView"
import * as Icons from "lucide-react"
import { FinanceView } from "./FinanceView"
import { SystemDesignHub } from "./SystemDesignTracker"
import { NotesTracker } from "../Notes"
import { StatusWindow } from "../Widgets/StatusWindow"
import { FloatingClock } from "../Widgets/FloatingClock"
import { useEffect, useState } from "react"
import { WorkoutTracker } from "./WorkoutTracker"
import { PlannerView } from "./PlannerView"
import { CalendarView } from "./CalendarView"
import { TimeAuditView } from "./TimeAuditView"
import { LearningChecklistView } from "./LearningChecklistView"
import { HabitTrackerView } from "./HabitTrackerView"
import { DashboardView } from "./DashboardView"
import { CustomPageView } from "./CustomPageView"
import { WorkspaceSettings } from "../Widgets/WorkspaceSettings"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { OPEN_VIEW_KEY, isCustomView } from "@/lib/workspace"

export default function KaizenTracker() {
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [isStreaksModalOpen, setIsStreaksModalOpen] = useState(false)
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"pages" | "dashboard" | "general">("pages")
  const openSettings = (tab: "pages" | "dashboard" | "general" = "pages") => {
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }
  const [financeInitialTab, setFinanceInitialTab] = useState<"income" | "expenses" | "courses">("expenses")
  const { isLoading: isWorkspaceLoading, isPageVisible, customPages, visiblePages } = useWorkspace()

  const {
    habits,
    logs,
    miniLogs,
    habitUpgradeNeeded,
    currentWeekStart,
    isLoading,
    toggleHabit,
    nextWeek,
    prevWeek,
    checksThisWeek,
    weekCompletionPct,
    currentWeekDays,
    addHabit,
    updateHabit,
    deleteHabit,
    sundayReview,
    setSundayReview,
    saveWeeklyReview,
    isSavingReview,
    activeView,
    setActiveView,
    playerStats,
    dsaData,
    dsaCompleted,
  } = useTracker()

  // NEW LOGIC: Advanced streak calculator with 21-day Streak Freeze
  const getHabitStreakDetails = (habitId: string) => {
    let streak = 0
    let freezeUsed = false
    let frozenDateStr: string | null = null // Track the exact frozen date
    let currentDate = new Date()

    // 1. Grace period: Check if today is logged
    let dateStr = format(currentDate, "yyyy-MM-dd")
    if (!logs[`${habitId}-${dateStr}`]) {
      currentDate = subDays(currentDate, 1)
    }

    // 2. Iterate backward through history
    while (true) {
      dateStr = format(currentDate, "yyyy-MM-dd")
      if (logs[`${habitId}-${dateStr}`]) {
        streak++
        currentDate = subDays(currentDate, 1)
      } else {
        // Missed a day! Can we apply a Streak Freeze?
        if (!freezeUsed) {
          let tempDate = subDays(currentDate, 1)
          let historicalStreak = 0

          // Calculate the historical contiguous streak BEFORE this missed day
          while (true) {
            let tempStr = format(tempDate, "yyyy-MM-dd")
            if (logs[`${habitId}-${tempStr}`]) {
              historicalStreak++
              tempDate = subDays(tempDate, 1)
            } else {
              break
            }
          }

          // If the user maintained at least a 21-day streak, trigger the freeze for 1 day
          if (historicalStreak >= 21) {
            freezeUsed = true
            frozenDateStr = dateStr // Remember which date was saved by the freeze
            streak += historicalStreak // Bridge the streak
            currentDate = tempDate // Skip past the historical streak
          } else {
            break // Not enough days maintained for a freeze; streak breaks
          }
        } else {
          break // Missed multiple days, or freeze already consumed
        }
      }
    }

    return { streak, freezeUsed, frozenDateStr }
  }

  // Wrapper helper to keep the sort logic working simply
  const getHabitStreak = (habitId: string) =>
    getHabitStreakDetails(habitId).streak

  // Calculate the Highest Active Streak for the KPI Card
  const highestActiveStreak =
    habits.filter((h) => !h.is_archived).length > 0
      ? Math.max(
          ...habits
            .filter((h) => !h.is_archived)
            .map((h) => getHabitStreak(h.id))
        )
      : 0

  // Notifications ask for a page (e.g. "Open planner") through a window event.
  useEffect(() => {
    const onNavigate = (event: Event) => {
      const view = (event as CustomEvent<string>).detail
      if (view === "dashboard" || isPageVisible(view)) setActiveView(view as typeof activeView)
    }
    window.addEventListener("kaizen:navigate", onNavigate)
    return () => window.removeEventListener("kaizen:navigate", onNavigate)
  }, [isPageVisible, setActiveView])

  // Open a page requested before we got here (e.g. a shared page just saved to this workspace).
  useEffect(() => {
    if (isWorkspaceLoading) return
    const pending = sessionStorage.getItem(OPEN_VIEW_KEY)
    if (!pending) return
    sessionStorage.removeItem(OPEN_VIEW_KEY)
    if (isPageVisible(pending)) setActiveView(pending as typeof activeView)
  }, [isWorkspaceLoading, isPageVisible, setActiveView])

  // If the current page gets hidden or deleted, fall back to the dashboard.
  useEffect(() => {
    if (!isWorkspaceLoading && !isPageVisible(activeView)) setActiveView("dashboard")
  }, [isWorkspaceLoading, isPageVisible, activeView, setActiveView])

  const renderContent = () => {
    if (isCustomView(activeView)) {
      const page = customPages.find((item) => `custom:${item.id}` === activeView)
      if (page) return <div className="kaizen-page kaizen-page--custom"><CustomPageView key={page.id} page={page} onOpenSettings={() => openSettings()} /></div>
    }
    if (activeView === "habits") {
      return <div className="kaizen-page kaizen-page--habits"><HabitTrackerView habits={habits} logs={logs} miniLogs={miniLogs} habitUpgradeNeeded={habitUpgradeNeeded} currentWeekStart={currentWeekStart} isLoading={isLoading} toggleHabit={toggleHabit} nextWeek={nextWeek} prevWeek={prevWeek} checksThisWeek={checksThisWeek} weekCompletionPct={weekCompletionPct} currentWeekDays={currentWeekDays} addHabit={addHabit} updateHabit={updateHabit} deleteHabit={deleteHabit} sundayReview={sundayReview} setSundayReview={setSundayReview} saveWeeklyReview={saveWeeklyReview} isSavingReview={isSavingReview} getHabitStreakDetails={getHabitStreakDetails} highestActiveStreak={highestActiveStreak} onOpenStatus={() => setIsStatusOpen(true)} onOpenMultiplayer={() => setIsMultiplayerOpen(true)} onOpenStreaks={() => setIsStreaksModalOpen(true)} /></div>
    }
    if (activeView === "dsa") {
      return <div className="kaizen-page kaizen-page--dsa"><DsaSheet /></div>
    }
    if (activeView === "journal") {
      return <div className="kaizen-page kaizen-page--journal"><JournalView onBack={() => setActiveView("dashboard")} /></div>
    }
    if (activeView === "finance") {
      return <div className="kaizen-page kaizen-page--finance"><FinanceView initialTab={financeInitialTab} /></div>
    }
    if (activeView === "system-design") {
      return <div className="kaizen-page kaizen-page--system-design"><SystemDesignHub onBack={() => setActiveView("dashboard")} /></div>
    }
    if (activeView === "notes") {
      return <div className="kaizen-page kaizen-page--notes"><NotesTracker /></div>
    }
    if (activeView === "workout-tracker") {
      return <div className="kaizen-page kaizen-page--workout"><WorkoutTracker onBack={() => setActiveView("dashboard")} /></div>
    }
    if (activeView === "planner") {
      return <div className="kaizen-page kaizen-page--planner"><PlannerView /></div>
    }
    if (activeView === "calendar") {
      return <div className="kaizen-page kaizen-page--calendar"><CalendarView /></div>
    }
    if (activeView === "time-audit") {
      return <div className="kaizen-page kaizen-page--time-audit"><TimeAuditView onBack={() => setActiveView("dashboard")} /></div>
    }
    if (activeView === "learning-checklist") {
      return <div className="kaizen-page kaizen-page--learning"><LearningChecklistView /></div>
    }

    return (
      <DashboardView
        habits={habits}
        logs={logs}
        toggleHabit={toggleHabit}
        highestActiveStreak={highestActiveStreak}
        dsaData={dsaData}
        dsaCompleted={dsaCompleted}
        setActiveView={setActiveView}
        onOpenStatus={() => setIsStatusOpen(true)}
        onOpenSettings={openSettings}
        onOpenFinanceTab={(tab) => { setFinanceInitialTab(tab); setActiveView("finance") }}
      />
    )
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-muted/20 via-background to-background">
      <StatusWindow
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        stats={playerStats}
      />

      {isMultiplayerOpen && (
        <div className="fixed inset-0 z-100 flex items-end justify-center bg-background/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/50 bg-card/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight">
                  Multiplayer Mode
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a private room and invite friends to share live habits.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMultiplayerOpen(false)}
                className="h-8 w-8 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-border/50 bg-background/50 p-4">
                <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Room ID
                </p>
                <p className="mt-2 font-mono text-xl font-black">
                  KAIZEN-ROOM-01
                </p>
              </div>
              <Button className="w-full">Create / Join Room</Button>
              <Button variant="outline" className="w-full">
                Copy Invite Link
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Habit Streaks Modal WITH FREEZE INDICATORS */}
      {isStreaksModalOpen && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-sm duration-200 fade-in">
          <Card className="relative w-full max-w-md overflow-hidden border-border/50 bg-card/95 shadow-xl backdrop-blur-md">
            <CardHeader className="border-b border-border/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Active Streaks
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsStreaksModalOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
                {habits
                  .filter((h) => !h.is_archived)
                  .sort((a, b) => getHabitStreak(b.id) - getHabitStreak(a.id))
                  .map((habit) => {
                    const { streak, freezeUsed } = getHabitStreakDetails(
                      habit.id
                    )
                    const IconComponent =
                      (Icons as any)[habit.icon_name] || Activity

                    return (
                      <div
                        key={habit.id}
                        className="flex flex-col gap-2 rounded-xl border border-border/30 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg border border-border/50 bg-background p-2 text-foreground/80 shadow-sm">
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold">
                              {habit.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Streak Freeze Indicator Badge */}
                            {freezeUsed && (
                              <div
                                className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1"
                                title="A Streak Freeze was automatically applied to save this streak."
                              >
                                <Snowflake className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-[10px] font-bold text-blue-600 uppercase dark:text-blue-400">
                                  Frozen
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                                {streak} {streak === 1 ? "Day" : "Days"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                {habits.filter((h) => !h.is_archived).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No active habits to track.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {renderContent()}

      <WorkspaceSettings
        key={`${settingsTab}-${isSettingsOpen}`}
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        onOpenPage={setActiveView}
      />

      <FloatingClock />

      <FloatingMenu
        pages={visiblePages}
        activeView={activeView}
        onNavigate={setActiveView}
        onOpenSettings={() => openSettings()}
      />
    </div>
  )
}
