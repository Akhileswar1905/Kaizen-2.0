import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { Eye, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { NoteContentPreview } from "../Notes"

type SharedNote = {
  title: string
  content: string
  created_at: string
}

export function SharedNoteView() {
  const { token = "" } = useParams()
  const [note, setNote] = useState<SharedNote | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading")

  useEffect(() => {
    let active = true
    supabase.rpc("get_shared_note", { token }).then(({ data, error }) => {
      if (!active) return
      const row = (Array.isArray(data) ? data[0] : data) as SharedNote | undefined
      if (error || !row) {
        setStatus("missing")
        return
      }
      setNote(row)
      setStatus("ready")
    })
    return () => { active = false }
  }, [token])

  if (status === "loading") return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading shared note…
    </div>
  )

  if (status === "missing" || !note) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Link2Off className="h-8 w-8 text-muted-foreground" />
      <h1 className="text-xl font-extrabold">This link isn't available</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This note may have stopped being shared, or the link was copied incorrectly. Ask the owner for a new link.
      </p>
      <Button asChild variant="outline" className="mt-2 rounded-xl"><Link to="/">Go to Kaizen</Link></Button>
    </div>
  )

  return (
    <main className="min-h-screen w-full px-3 py-6 text-foreground antialiased sm:px-6 sm:py-10">
      <article className="mx-auto w-full max-w-[860px] space-y-5">
        <header className="border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="kaizen-page-heading-icon"><Eye className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h1 className="kaizen-page-heading-title break-words">{note.title}</h1>
              <p className="kaizen-page-heading-description">
                Shared note · {format(parseISO(note.created_at), "d MMM yyyy")}
              </p>
            </div>
          </div>
        </header>
        <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" /> View only. You're seeing the owner's latest version.
        </p>
        <div className="note-preview min-w-0 break-words">
          <style>{`
            .note-preview h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 .6rem; }
            .note-preview h2 { font-size: 1.35rem; font-weight: 700; margin: 1.5rem 0 .6rem; }
            .note-preview h3 { font-size: 1.1rem; font-weight: 600; margin: 1.25rem 0 .5rem; }
            .note-preview p { margin-bottom: 1rem; line-height: 1.7; }
            .note-preview ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
            .note-preview ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
            .note-preview li { margin-bottom: .4rem; line-height: 1.65; }
            .note-preview a { color: var(--primary); text-decoration: underline; }
            .note-preview blockquote { border-left: 3px solid var(--border); padding-left: 1rem; margin-bottom: 1rem; color: var(--muted-foreground); }
            .note-preview pre { background: var(--muted); padding: 1rem; border-radius: 12px; overflow-x: auto; margin-bottom: 1rem; border: 1px solid var(--border); }
            .note-preview code { font-family: ui-monospace, SFMono-Regular, monospace; background: var(--muted); padding: .15rem .4rem; border-radius: 6px; font-size: .88em; }
            .note-preview pre code { background: transparent; padding: 0; }
            .note-preview img { max-width: 100%; border-radius: 10px; }
            .note-preview table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
            .note-preview th, .note-preview td { border: 1px solid var(--border); padding: .65rem .75rem; text-align: left; vertical-align: top; }
            .note-preview th { background: var(--muted); font-weight: 650; }
            .note-preview { overflow-wrap: anywhere; }
            .note-mermaid-diagram { width: 100%; margin: 1.25rem 0; overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--card); padding: 1rem; }
            .note-mermaid-diagram svg { display: block; max-width: 100%; height: auto; margin-inline: auto; }
            .note-mermaid-error { margin: 1rem 0; border: 1px solid var(--destructive); border-radius: 8px; padding: .75rem; color: var(--destructive); font-size: .85rem; }
          `}</style>
          <NoteContentPreview html={note.content} />
        </div>
        <p className="pt-6 text-center text-xs text-muted-foreground">
          Made with <Link to="/" className="font-bold text-foreground hover:underline">Kaizen</Link>
        </p>
      </article>
    </main>
  )
}
