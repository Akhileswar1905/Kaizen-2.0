import { useCallback, useEffect, useState } from "react"
import { addDays, format } from "date-fns"
import { supabase } from "@/lib/supabase"

export const BLOCK_COLORS = [
  "blue",
  "green",
  "amber",
  "rose",
  "violet",
  "slate",
] as const
export type BlockColor = (typeof BLOCK_COLORS)[number]

export interface TimeBlock {
  id: string
  title: string
  date: string // "yyyy-MM-dd"
  start: string // "HH:mm" (24h)
  end: string // "HH:mm" (24h), always after start on the same day
  color: BlockColor
}

export type TimeBlockInput = Omit<TimeBlock, "id">

interface BlockRow {
  id: string
  title: string
  block_date: string
  start_time: string // "HH:mm:ss"
  end_time: string // "HH:mm:ss"
  color: string | null
}

function rowToBlock(row: BlockRow): TimeBlock {
  const color = BLOCK_COLORS.includes(row.color as BlockColor)
    ? (row.color as BlockColor)
    : "blue"
  return {
    id: row.id,
    title: row.title,
    date: row.block_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    color,
  }
}

function inputToRow(input: TimeBlockInput) {
  return {
    title: input.title,
    block_date: input.date,
    start_time: input.start,
    end_time: input.end,
    color: input.color,
  }
}

// Lets the notification scheduler refresh as soon as the planner changes.
const announceChange = () =>
  window.dispatchEvent(new Event("kaizen:time-blocks-changed"))

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Time blocks for one week (7 days starting at `weekStart`), stored in
 * Supabase. Tables are defined in supabase/time_blocks.sql.
 */
export function useTimeBlocks(weekStart: Date) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const from = format(weekStart, "yyyy-MM-dd")
  const to = format(addDays(weekStart, 6), "yyyy-MM-dd")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!active) return

      if (authError || !authData.user) {
        setError("Sign in to use time blocks.")
        setLoading(false)
        return
      }
      setUserId(authData.user.id)

      const { data, error: fetchError } = await supabase
        .from("time_blocks")
        .select("id, title, block_date, start_time, end_time, color")
        .eq("user_id", authData.user.id)
        .gte("block_date", from)
        .lte("block_date", to)
        .order("block_date", { ascending: true })
        .order("start_time", { ascending: true })
      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
        setBlocks([])
      } else {
        setBlocks((data as BlockRow[]).map(rowToBlock))
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [from, to])

  const addBlock = useCallback(
    async (input: TimeBlockInput) => {
      if (!userId) {
        setError("Sign in to add time blocks.")
        return false
      }
      const { data, error: insertError } = await supabase
        .from("time_blocks")
        .insert({ user_id: userId, ...inputToRow(input) })
        .select("id, title, block_date, start_time, end_time, color")
        .single()

      if (insertError) {
        setError(insertError.message)
        return false
      }
      announceChange()
      const block = rowToBlock(data as BlockRow)
      // Only show it if it falls in the week currently on screen.
      if (block.date >= from && block.date <= to) {
        setBlocks((current) => [...current, block])
      }
      return true
    },
    [userId, from, to]
  )

  const updateBlock = useCallback(
    async (id: string, input: TimeBlockInput) => {
      const { error: updateError } = await supabase
        .from("time_blocks")
        .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
        .eq("id", id)

      if (updateError) {
        setError(updateError.message)
        return false
      }
      announceChange()
      setBlocks((current) => {
        const moved = input.date < from || input.date > to
        if (moved) return current.filter((b) => b.id !== id)
        return current.map((b) => (b.id === id ? { id, ...input } : b))
      })
      return true
    },
    [from, to]
  )

  const deleteBlock = useCallback(async (id: string) => {
    let previous: TimeBlock[] = []
    setBlocks((current) => {
      previous = current
      return current.filter((b) => b.id !== id)
    })

    const { error: deleteError } = await supabase
      .from("time_blocks")
      .delete()
      .eq("id", id)

    if (deleteError) {
      setError(deleteError.message)
      setBlocks(previous) // revert on failure
    } else announceChange()
  }, [])

  return { blocks, loading, error, addBlock, updateBlock, deleteBlock }
}
