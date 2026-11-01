import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import type { CustomPageContent } from "@/lib/workspace"

export type SaveStatus = "saved" | "saving" | "error"

const SAVE_DELAY_MS = 700

/**
 * Debounced, ordered saving of a custom page's content. Edits stay local and
 * are written at most every SAVE_DELAY_MS, and any pending edit is flushed
 * when the page closes.
 */
export function usePageAutosave(pageId: string) {
  const { updateCustomPage } = useWorkspace()
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<CustomPageContent | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const update = useRef(updateCustomPage)

  useEffect(() => {
    update.current = updateCustomPage
  })

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const content = pending.current
    if (!content) return
    pending.current = null
    // Chain saves so an older write can never land after a newer one.
    queue.current = queue.current.then(async () => {
      const result = await update.current(pageId, { content })
      setError(result.error)
      if (!pending.current) setStatus(result.error ? "error" : "saved")
    })
  }, [pageId])

  const save = useCallback(
    (content: CustomPageContent) => {
      pending.current = content
      setStatus("saving")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush]
  )

  useEffect(() => {
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [flush])

  return { save, status, error }
}
