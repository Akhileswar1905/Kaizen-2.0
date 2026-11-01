import { addDays, subDays } from "date-fns"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { startOfWeek, subWeeks, addWeeks, format } from "date-fns"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useGamification } from "@/contexts/GamificationContext"
import type { ActiveView } from "@/lib/workspace"
import {
  HABIT_V2_FIELDS,
  isMissingHabitColumn,
  type CheckInMode,
  type TimeOfDay,
} from "@/lib/habits"

export type Habit = {
  id: string
  title: string
  description: string
  target_days: number
  icon_name: string
  is_archived: boolean
  // Added by supabase/plans_and_habits.sql; absent on older databases.
  identity?: string
  mini_version?: string
  anchor?: string
  time_of_day?: TimeOfDay
  created_at?: string
}

const stripV2Fields = (fields: Record<string, unknown>) => {
  const rest = { ...fields }
  for (const field of HABIT_V2_FIELDS) delete rest[field]
  return rest
}

export function useTracker() {
  const IconMap = useMemo(() => {
    return Object.keys(Icons).filter((key) => {
      return (
        typeof (Icons as any)[key] === "object" ||
        typeof (Icons as any)[key] === "function"
      )
    })
  }, [])

  const { user } = useAuth() // Get the authenticated user
  const userId = user?.id || "anonymous" // Fallback to "anonymous" if user is not logged in
  const {
    triggerGamificationEvent,
    subtractGamificationPoints,
    playerStats,
    recalculateAndSyncStats,
  } = useGamification()

  const [habits, setHabits] = useState<Habit[]>([])

  // Format: { "habitId-YYYY-MM-DD": true }
  const [logs, setLogs] = useState<Record<string, boolean>>({})
  // Same keys; true when the check-in was the 2-minute version.
  const [miniLogs, setMiniLogs] = useState<Record<string, boolean>>({})
  // Set when the database is missing the columns from plans_and_habits.sql.
  const [habitUpgradeNeeded, setHabitUpgradeNeeded] = useState(false)

  const [currentWeekStart, setCurrentWeekStart] = useState(
    () => startOfWeek(new Date(), { weekStartsOn: 1 }) // 1 = Monday
  )
  const [isLoading, setIsLoading] = useState(true)

  const [sundayReview, setSundayReview] = useState({
    one_percent_win: "",
    adjustments: "",
  })
  const [isSavingReview, setIsSavingReview] = useState(false)

  const [dsaData, setDsaData] = useState<Record<string, any[]>>({})
  const [dsaCompleted, setDsaCompleted] = useState<string[]>([])
  // Add state to store cached notes from the DB: { "problem_id": "notes content" }
  const [dsaNotes, setDsaNotes] = useState<Record<string, string>>({})

  const [journals, setJournals] = useState<any[]>([])
  const [isSavingJournal, setIsSavingJournal] = useState(false)

  const [activeView, setActiveView] = useState<ActiveView>("dashboard")

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true)

    // 1. Fetch Habits
    const { data: habitsData } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId) // Filter habits by the authenticated user

    if (habitsData) setHabits(habitsData)

    // 2. Fetch all logs (you might want to filter this by date range later)
    const { data: logsData } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", userId) // Filter logs by the authenticated user

    if (logsData) {
      const logMap: Record<string, boolean> = {}
      const miniMap: Record<string, boolean> = {}
      logsData.forEach((log) => {
        logMap[`${log.habit_id}-${log.log_date}`] = log.is_completed
        if (log.is_completed && log.is_mini)
          miniMap[`${log.habit_id}-${log.log_date}`] = true
      })
      setLogs(logMap)
      setMiniLogs(miniMap)
    }

    setIsLoading(false)
  }, [userId])

  // Handle checking/unchecking a habit. Pressing the mode a day already has
  // clears it; pressing the other mode switches between full and 2-minute.
  const toggleHabit = async (
    habitId: string,
    date: Date,
    mode: CheckInMode = "full"
  ) => {
    const dateString = format(date, "yyyy-MM-dd")
    const logKey = `${habitId}-${dateString}`
    const currentStatus = logs[logKey] || false
    const wasMini = Boolean(currentStatus && miniLogs[logKey])
    const current: CheckInMode | "none" = currentStatus
      ? wasMini
        ? "mini"
        : "full"
      : "none"
    const next = current === mode ? "none" : mode
    const newStatus = next !== "none"

    // Optimistic UI update (feels instant to the user)
    setLogs((prev) => ({ ...prev, [logKey]: newStatus }))
    setMiniLogs((prev) => ({ ...prev, [logKey]: next === "mini" }))

    // Only send is_mini when it matters, so full check-ins keep working on
    // databases that haven't run plans_and_habits.sql yet.
    const { error } = await supabase.from("habit_logs").upsert(
      {
        user_id: userId,
        habit_id: habitId,
        log_date: dateString,
        is_completed: newStatus,
        ...(next === "mini" || wasMini ? { is_mini: next === "mini" } : {}),
      },
      { onConflict: "habit_id,log_date" }
    )

    // Revert if Supabase fails
    if (error) {
      console.error("Failed to save log:", error)
      if (isMissingHabitColumn(error.message)) setHabitUpgradeNeeded(true)
      setLogs((prev) => ({ ...prev, [logKey]: currentStatus }))
      setMiniLogs((prev) => ({ ...prev, [logKey]: wasMini }))
      return null
    }

    let result = null
    if (current === "none") {
      result = await triggerGamificationEvent({
        type: "HABIT_COMPLETED",
        amount: 1,
      })
    } else if (next === "none") {
      // Subtract points when unchecking a habit to prevent point farming
      await subtractGamificationPoints({ type: "HABIT_COMPLETED", amount: 1 })
    }

    return result
  }

  // Week navigation
  const nextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1))
  const prevWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1))
  }

  const currentWeekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(currentWeekStart, i)
  )

  // --- STATS CALCULATIONS ---

  // 1. Checks this week
  const checksThisWeek = currentWeekDays.reduce((total, date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    let dailyChecks = 0
    habits.forEach((habit) => {
      if (logs[`${habit.id}-${dateStr}`]) dailyChecks++
    })
    return total + dailyChecks
  }, 0)

  // 2. Week Completion Percentage
  const totalTargetDays = habits.reduce(
    (total, habit) => total + habit.target_days,
    0
  )
  const weekCompletionPct =
    totalTargetDays === 0
      ? 0
      : Math.round((checksThisWeek / totalTargetDays) * 100)

  // 3. DSA Streak Calculation
  // Find the specific habit (case-insensitive check)
  const dsaHabit = habits.find((h) => h.title.toLowerCase().includes("dsa"))
  let dsaStreak = 0

  if (dsaHabit) {
    let checkDate = new Date() // Start today
    let dateStr = format(checkDate, "yyyy-MM-dd")

    // If today is NOT checked yet, give them grace and start counting from yesterday
    if (!logs[`${dsaHabit.id}-${dateStr}`]) {
      checkDate = subDays(checkDate, 1)
      dateStr = format(checkDate, "yyyy-MM-dd")
    }

    // Count backwards day-by-day until a break in the chain is found
    while (logs[`${dsaHabit.id}-${dateStr}`]) {
      dsaStreak++
      checkDate = subDays(checkDate, 1)
      dateStr = format(checkDate, "yyyy-MM-dd")
    }
  }

  const addHabit = async (newHabit: any) => {
    const insert = (fields: Record<string, unknown>) =>
      supabase
        .from("habits")
        .insert([{ ...fields, user_id: userId }]) // Inject user_id
        .select()
        .single()

    let { data, error } = await insert(newHabit)
    // Older database: save the basics and ask for the migration.
    if (error && isMissingHabitColumn(error.message)) {
      setHabitUpgradeNeeded(true)
      ;({ data, error } = await insert(stripV2Fields(newHabit)))
    }

    if (error) {
      console.error("Error adding habit:", error)
      return
    }

    // Immediately add it to the UI without refreshing the page
    setHabits([...habits, data])
  }

  const updateHabit = async (habitId: string, updates: any) => {
    const update = (fields: Record<string, unknown>) =>
      supabase
        .from("habits")
        .update(fields)
        .eq("id", habitId)
        .eq("user_id", userId) // Ensure users can only update their own habits
        .select()
        .single()

    let { data, error } = await update(updates)
    if (error && isMissingHabitColumn(error.message)) {
      setHabitUpgradeNeeded(true)
      ;({ data, error } = await update(stripV2Fields(updates)))
    }

    if (error) {
      console.error("Error updating habit:", error)
      return
    }

    // Update state immediately
    setHabits(habits.map((h) => (h.id === habitId ? data : h)))
  }

  const deleteHabit = async (habitId: string) => {
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", userId)

    if (error) {
      console.error("Error deleting habit:", error)
      return
    }

    // Remove from state immediately
    setHabits(habits.filter((h) => h.id !== habitId))
  }

  const saveWeeklyReview = async (winText: string, adjustText: string) => {
    setIsSavingReview(true)
    const formattedDate = format(currentWeekStart, "yyyy-MM-dd")

    const { error } = await supabase.from("weekly_reviews").upsert(
      {
        week_start_date: formattedDate,
        one_percent_win: winText,
        adjustments: adjustText,
        user_id: userId,
      },
      { onConflict: "user_id,week_start_date" } // One review per user per week
    )

    if (!error) {
      await triggerGamificationEvent({ type: "WEEKLY_REVIEW_DONE", amount: 1 })
    } else {
      console.error("Error saving review:", error)
    }
    setIsSavingReview(false)
  }

  const toggleDsaProblem = async (
    problemId: string,
    isCurrentlyCompleted: boolean
  ) => {
    if (isCurrentlyCompleted) {
      // Uncheck it (Delete from Supabase)
      await supabase
        .from("dsa_completions")
        .delete()
        .eq("problem_id", problemId)
        .eq("user_id", userId)
      setDsaCompleted((prev) => prev.filter((id) => id !== problemId))
      await subtractGamificationPoints({ type: "DSA_SOLVED", amount: 1 })
    } else {
      // Check it (Insert to Supabase)
      await supabase
        .from("dsa_completions")
        .insert([{ problem_id: problemId, user_id: userId }])
      setDsaCompleted((prev) => [...prev, problemId])

      await triggerGamificationEvent({
        type: "DSA_SOLVED",
        amount: 1,
      })
    }
  }

  const saveDsaNote = async (problemId: string, noteText: string) => {
    // 1. Guard clause: Ensure we have a user
    if (!user?.id) {
      console.error("No user found")
      return
    }

    // Instantly update local UI state for zero-latency feedback
    setDsaNotes((prev) => ({ ...prev, [problemId]: noteText }))

    // Persist changes directly to the Supabase Cloud using UPSERT
    const { error } = await supabase.from("dsa_completions").upsert(
      {
        user_id: user.id, // Explicitly tie it to the user
        problem_id: problemId, // The ID of the problem
        notes: noteText, // The actual note
      },
      {
        onConflict: "user_id,problem_id", // Tells Supabase how to find the specific row to update
      }
    )

    if (error) {
      console.error("Failed to sync notes to Supabase:", error.message)
      // Optional: Roll back local state if network failure occurs
    }
  }

  const saveJournalEntry = async (dateStr: string, content: string) => {
    setIsSavingJournal(true)

    const { data, error } = await supabase
      .from("journals")
      .upsert(
        { entry_date: dateStr, content: content, user_id: userId },
        { onConflict: "user_id,entry_date" }
      )
      .select()
      .single()

    if (!error && data) {
      await triggerGamificationEvent({ type: "JOURNAL_SAVED", amount: 1 })
      // Update local state so the sidebar reflects the new content immediately
      setJournals((prev) => {
        const exists = prev.find((j) => j.entry_date === dateStr)
        if (exists) {
          return prev.map((j) => (j.entry_date === dateStr ? data : j))
        }
        // If it's a brand new entry, add it and sort by date descending
        return [data, ...prev].sort((a, b) =>
          b.entry_date.localeCompare(a.entry_date)
        )
      })
    } else {
      console.error("Error saving journal:", error)
    }

    setIsSavingJournal(false)
  }

  const fetchWeekData = useCallback(async () => {
    await fetchData()

    const formattedDate = format(currentWeekStart, "yyyy-MM-dd")

    const { data: reviewData } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("week_start_date", formattedDate)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (reviewData) {
      setSundayReview({
        one_percent_win: reviewData.one_percent_win || "",
        adjustments: reviewData.adjustments || "",
      })
    } else {
      setSundayReview({
        one_percent_win: "",
        adjustments: "",
      })
    }

    const { data: problems } = await supabase.from("dsa_problems").select("*")

    if (problems) {
      const grouped = problems.reduce(
        (acc, curr) => {
          if (!acc[curr.category]) {
            acc[curr.category] = []
          }

          acc[curr.category].push(curr)
          return acc
        },
        {} as Record<string, any[]>
      )

      setDsaData(grouped)
    }

    const { data: completions } = await supabase
      .from("dsa_completions")
      .select("problem_id")
      .eq("user_id", userId)

    if (completions) {
      setDsaCompleted(completions.map((c) => c.problem_id))
    }

    const { data: journalData } = await supabase
      .from("journals")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })

    if (journalData) {
      setJournals(journalData)
    }
  }, [currentWeekStart, userId, fetchData])

  const fetchDsaProgress = useCallback(async () => {
    const { data, error } = await supabase.from("dsa_problems").select("id")

    const { data: progressData, error: progressError } = await supabase
      .from("dsa_completions")
      .select("problem_id, notes")
      .eq("user_id", userId)

    if (data && !error && !progressError) {
      const completedIds = progressData?.map((p) => p.problem_id) || []

      const notesMap =
        progressData?.reduce(
          (acc, current) => {
            if (current.notes) {
              acc[current.problem_id] = current.notes
            }

            return acc
          },
          {} as Record<string, string>
        ) || {}

      setDsaCompleted(completedIds)
      setDsaNotes(notesMap)
    }
  }, [userId])

  // ==========================================
  // POMODORO LOGIC (Cross-Browser Synced)
  // ==========================================
  const DEFAULT_WORK_TIME = 25 * 60
  const DEFAULT_BREAK_TIME = 5 * 60

  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_TIME)
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_TIME)
  const [pomoTimeLeft, setPomoTimeLeft] = useState(DEFAULT_WORK_TIME)
  const [isPomoActive, setIsPomoActive] = useState(false)
  const [isPomoBreak, setIsPomoBreak] = useState(false)

  // Keep a ref of the latest state to sync with new tabs without triggering re-connects
  const pomoStateRef = useRef({
    isActive: isPomoActive,
    timeLeft: pomoTimeLeft,
    isBreak: isPomoBreak,
    workDuration,
    breakDuration,
  })

  // Update the ref silently every time state changes
  useEffect(() => {
    pomoStateRef.current = {
      isActive: isPomoActive,
      timeLeft: pomoTimeLeft,
      isBreak: isPomoBreak,
      workDuration,
      breakDuration,
    }
  }, [isPomoActive, pomoTimeLeft, isPomoBreak, workDuration, breakDuration])

  // Load pomodoro settings from Supabase on mount
  useEffect(() => {
    if (!user?.id) return

    const loadPomoSettings = async () => {
      const { data } = await supabase
        .from("pomodoro_settings")
        .select("work_duration, break_duration")
        .eq("user_id", user.id)
        .single()

      if (data) {
        setWorkDuration(data.work_duration)
        setBreakDuration(data.break_duration)
        setPomoTimeLeft(data.work_duration)
      }
    }

    loadPomoSettings()
  }, [user?.id])

  // Save pomodoro settings
  const savePomoSettings = useCallback(
    async (newWorkDuration: number, newBreakDuration: number) => {
      if (!user?.id) return

      setWorkDuration(newWorkDuration)
      setBreakDuration(newBreakDuration)
      // Reset timer when settings change
      setPomoTimeLeft(newWorkDuration)
      setIsPomoActive(false)
      setIsPomoBreak(false)

      await supabase.from("pomodoro_settings").upsert(
        {
          user_id: user.id,
          work_duration: newWorkDuration,
          break_duration: newBreakDuration,
        },
        { onConflict: "user_id" }
      )
    },
    [user?.id]
  )

  // 1. Audio Notification (Loud Hard Mode System Chime)
  const playSystemAlarm = useCallback(() => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext

      if (!AudioContext) return

      const ctx = new AudioContext()

      if (ctx.state === "suspended") {
        ctx.resume()
      }

      const master = ctx.createGain()
      master.gain.value = 0.6
      master.connect(ctx.destination)

      // ---------- REVERB ----------
      const convolver = ctx.createConvolver()

      const impulseLength = ctx.sampleRate * 2.5
      const impulse = ctx.createBuffer(2, impulseLength, ctx.sampleRate)

      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel)

        for (let i = 0; i < impulseLength; i++) {
          const decay = Math.pow(1 - i / impulseLength, 3)

          data[i] = (Math.random() * 2 - 1) * decay * 0.4
        }
      }

      convolver.buffer = impulse

      const reverbGain = ctx.createGain()
      reverbGain.gain.value = 0.35

      convolver.connect(reverbGain)
      reverbGain.connect(master)

      // ---------- ECHO ----------
      const delay = ctx.createDelay(1)

      delay.delayTime.value = 0.32

      const feedback = ctx.createGain()
      feedback.gain.value = 0.28

      delay.connect(feedback)
      feedback.connect(delay)

      const delayGain = ctx.createGain()
      delayGain.gain.value = 0.25

      delay.connect(delayGain)
      delayGain.connect(master)

      const now = ctx.currentTime

      // ---------- BASS IMPACT ----------
      const bass = ctx.createOscillator()
      const bassGain = ctx.createGain()

      bass.type = "sine"

      bass.frequency.setValueAtTime(55, now)
      bass.frequency.exponentialRampToValueAtTime(30, now + 0.5)

      bassGain.gain.setValueAtTime(0.001, now)
      bassGain.gain.exponentialRampToValueAtTime(0.7, now + 0.03)
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)

      bass.connect(bassGain)
      bassGain.connect(master)

      bass.start(now)
      bass.stop(now + 0.8)

      // ---------- ASCENDING CHORD ----------
      const notes = [
        { freq: 220, start: 0.15 },
        { freq: 277.18, start: 0.35 },
        { freq: 329.63, start: 0.55 },
        { freq: 440, start: 0.85 },
      ]

      notes.forEach(({ freq, start }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = "triangle"

        osc.frequency.setValueAtTime(freq, now + start)

        gain.gain.setValueAtTime(0.0001, now + start)

        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.08)

        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 1.8)

        osc.connect(gain)

        gain.connect(master)
        gain.connect(convolver)
        gain.connect(delay)

        osc.start(now + start)
        osc.stop(now + start + 2)
      })

      // ---------- SHIMMER ----------
      const shimmer = ctx.createOscillator()
      const shimmerGain = ctx.createGain()

      shimmer.type = "sine"

      shimmer.frequency.setValueAtTime(880, now + 1.2)

      shimmer.frequency.exponentialRampToValueAtTime(1760, now + 2.4)

      shimmerGain.gain.setValueAtTime(0.0001, now + 1.2)

      shimmerGain.gain.linearRampToValueAtTime(0.08, now + 1.0)

      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8)

      shimmer.connect(shimmerGain)

      shimmerGain.connect(master)
      shimmerGain.connect(convolver)

      shimmer.start(now + 1.2)
      shimmer.stop(now + 2.8)

      // ---------- FINAL ASCENSION SWEEP ----------
      const sweep = ctx.createOscillator()
      const sweepGain = ctx.createGain()

      sweep.type = "sawtooth"

      sweep.frequency.setValueAtTime(400, now + 1.8)

      sweep.frequency.exponentialRampToValueAtTime(1400, now + 2.5)

      sweepGain.gain.setValueAtTime(0.0001, now + 1.8)

      sweepGain.gain.linearRampToValueAtTime(0.12, now + 1.0)

      sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8)

      sweep.connect(sweepGain)

      sweepGain.connect(convolver)
      sweepGain.connect(master)

      sweep.start(now + 1.8)
      sweep.stop(now + 2.8)
    } catch (error) {
      console.error("Failed to play sound:", error)
    }
  }, [])

  // 2. Supabase Realtime Cross-Browser Sync
  useEffect(() => {
    if (!user?.id) return

    const pomoChannel = supabase.channel(`pomo_sync_${user.id}`)

    pomoChannel
      .on("broadcast", { event: "SYNC_STATE" }, ({ payload }) => {
        setIsPomoActive(payload.isActive)
        setPomoTimeLeft(payload.timeLeft)
        setIsPomoBreak(payload.isBreak)
        if (payload.workDuration) setWorkDuration(payload.workDuration)
        if (payload.breakDuration) setBreakDuration(payload.breakDuration)
      })
      .on("broadcast", { event: "REQUEST_STATE" }, () => {
        // Use the REF here. This guarantees we send the freshest data
        // without putting state in the dependency array.
        const current = pomoStateRef.current
        const expectedTime = current.isBreak
          ? current.breakDuration
          : current.workDuration
        if (current.isActive || current.timeLeft !== expectedTime) {
          pomoChannel.send({
            type: "broadcast",
            event: "SYNC_STATE",
            payload: current,
          })
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          pomoChannel.send({
            type: "broadcast",
            event: "REQUEST_STATE",
          })
        }
      })

    return () => {
      // ONLY tear down the websocket when the user logs out or closes the app
      supabase.removeChannel(pomoChannel)
    }
  }, [user?.id]) // DEPENDENCY ARRAY FIXED: Only depends on User ID now

  // Helper to shout our state changes to other browsers
  const broadcastState = useCallback(
    (
      active: boolean,
      time: number,
      breakMode: boolean,
      wDuration?: number,
      bDuration?: number
    ) => {
      if (!user) return
      supabase.channel(`pomo_sync_${user.id}`).send({
        type: "broadcast",
        event: "SYNC_STATE",
        payload: {
          isActive: active,
          timeLeft: time,
          isBreak: breakMode,
          workDuration: wDuration || workDuration,
          breakDuration: bDuration || breakDuration,
        },
      })
    },
    [user, workDuration, breakDuration]
  )

  // 3. Timer Engine (Optimized)
  useEffect(() => {
    let interval: any

    // We only create the interval if it's active AND time is greater than 0.
    if (isPomoActive && pomoTimeLeft > 0) {
      interval = setInterval(() => {
        setPomoTimeLeft((prev) => prev - 1)
      }, 1000)
    }

    return () => clearInterval(interval)
    // The trick here is using `pomoTimeLeft > 0` as a boolean dependency.
    // It prevents the interval from restarting every single second!
  }, [isPomoActive, pomoTimeLeft > 0])

  // 4. Handle Time Completion
  useEffect(() => {
    if (pomoTimeLeft === 0 && isPomoActive) {
      setIsPomoActive(false)
      playSystemAlarm()

      // Auto-switch modes when time is up
      const nextIsBreak = !isPomoBreak
      const nextTime = nextIsBreak ? breakDuration : workDuration

      setIsPomoBreak(nextIsBreak)
      setPomoTimeLeft(nextTime)
      broadcastState(false, nextTime, nextIsBreak, workDuration, breakDuration)
    }
  }, [
    pomoTimeLeft,
    isPomoActive,
    isPomoBreak,
    playSystemAlarm,
    broadcastState,
    workDuration,
    breakDuration,
  ])

  // 5. Action Controls
  const togglePomoTimer = () => {
    const newState = !isPomoActive
    setIsPomoActive(newState)
    broadcastState(
      newState,
      pomoTimeLeft,
      isPomoBreak,
      workDuration,
      breakDuration
    )
  }

  const resetPomoTimer = () => {
    const time = isPomoBreak ? breakDuration : workDuration
    setIsPomoActive(false)
    setPomoTimeLeft(time)
    broadcastState(false, time, isPomoBreak, workDuration, breakDuration)
  }

  const setPomoMode = (mode: "work" | "break") => {
    const isBreak = mode === "break"
    const time = isBreak ? breakDuration : workDuration
    setIsPomoActive(false)
    setIsPomoBreak(isBreak)
    setPomoTimeLeft(time)
    broadcastState(false, time, isBreak, workDuration, breakDuration)
  }

  const formatPomoTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  useEffect(() => {
    fetchWeekData()
    fetchDsaProgress()
    recalculateAndSyncStats()
  }, [fetchWeekData, fetchDsaProgress])

  return {
    IconMap,
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
    dsaStreak,
    currentWeekDays,

    addHabit,
    updateHabit,
    deleteHabit,
    sundayReview,
    setSundayReview,
    saveWeeklyReview,
    isSavingReview,

    dsaData,
    dsaNotes,
    setDsaNotes,
    saveDsaNote,
    dsaCompleted,
    toggleDsaProblem,

    journals,
    saveJournalEntry,
    isSavingJournal,

    activeView,
    setActiveView,
    playerStats,
    triggerGamificationEvent,
    subtractGamificationPoints,
    recalculateAndSyncStats,

    pomoTimeLeft,
    isPomoActive,
    isPomoBreak,
    togglePomoTimer,
    resetPomoTimer,
    setPomoMode,
    formatPomoTime,
    workDuration,
    breakDuration,
    savePomoSettings,
  }
}
