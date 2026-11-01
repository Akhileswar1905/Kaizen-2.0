import { createElement, useState } from "react"
import {
  AlertCircle,
  Check,
  Copy,
  Globe,
  Loader2,
  Settings2,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { usePageAutosave, type SaveStatus } from "@/hooks/usePageAutosave"
import {
  customPageKindLabel,
  isWidePage,
  newShareToken,
  resolveIcon,
  shareUrl,
  type ChecklistItem,
  type CustomPage,
  type CustomPageContent,
  type CustomPageKind,
} from "@/lib/workspace"
import { PageEditor } from "../Pages/PageEditor"
import { TableView } from "../Pages/TableView"
import { BoardView } from "../Pages/BoardView"
import { JournalApp } from "../Pages/apps/JournalApp"
import { TrackerApp } from "../Pages/apps/TrackerApp"
import { GoalsApp } from "../Pages/apps/GoalsApp"
import { CountdownApp } from "../Pages/apps/CountdownApp"
import { FlashcardsApp } from "../Pages/apps/FlashcardsApp"

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Pages created as the old "checklist" kind open as a to-do list in the editor.
const checklistToHtml = (items: ChecklistItem[] = []) =>
  items.length
    ? `<ul data-type="taskList">${items.map((item) => `<li data-type="taskItem" data-checked="${item.done}"><p>${escapeHtml(item.title)}</p></li>`).join("")}</ul>`
    : ""

/**
 * The body of a custom page. With `readOnly`, documents can't be edited and
 * app changes stay on screen only (nothing is saved), for shared links.
 */
export function PageBody({
  kind,
  content,
  onSave,
  readOnly = false,
}: {
  kind: CustomPageKind
  content: CustomPageContent
  onSave: (content: CustomPageContent) => void
  readOnly?: boolean
}) {
  switch (kind) {
    case "journal":
      return (
        <JournalApp
          initial={content.journal}
          onChange={(journal) => onSave({ journal })}
        />
      )
    case "tracker":
      return (
        <TrackerApp
          initial={content.tracker}
          onChange={(tracker) => onSave({ tracker })}
        />
      )
    case "goals":
      return (
        <GoalsApp
          initial={content.goals}
          onChange={(goals) => onSave({ goals })}
        />
      )
    case "countdown":
      return (
        <CountdownApp
          initial={content.countdown}
          onChange={(countdown) => onSave({ countdown })}
        />
      )
    case "flashcards":
      return (
        <FlashcardsApp
          initial={content.flashcards}
          onChange={(flashcards) => onSave({ flashcards })}
        />
      )
    case "table":
      return (
        <TableView
          initial={content.table}
          onChange={(table) => onSave({ table })}
        />
      )
    case "board":
      return (
        <BoardView
          initial={content.board}
          onChange={(board) => onSave({ board })}
        />
      )
    default:
      return (
        <>
          <PageEditor
            initialHtml={content.html ?? checklistToHtml(content.items)}
            onChange={(html) => onSave({ html })}
            editable={!readOnly}
            showTemplates={!readOnly}
          />
          {!readOnly && (
            <p className="pt-6 text-xs text-muted-foreground">
              Tip: type{" "}
              <kbd className="rounded border border-border px-1">/</kbd> for
              blocks, <kbd className="rounded border border-border px-1">#</kbd>{" "}
              for a heading,{" "}
              <kbd className="rounded border border-border px-1">[ ]</kbd> for a
              to-do, or select text to format it.
            </p>
          )}
        </>
      )
  }
}

function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus
  error: string | null
}) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    )
  if (status === "error")
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={error ?? undefined}
      >
        <AlertCircle className="h-3 w-3" /> Not saved{error ? `: ${error}` : ""}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3 w-3" /> Saved
    </span>
  )
}

function SharePopover({ page }: { page: CustomPage }) {
  const { updateCustomPage } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = page.share_token ? shareUrl(page.share_token) : null

  const setToken = async (token: string | null) => {
    setBusy(true)
    const result = await updateCustomPage(page.id, { share_token: token })
    setBusy(false)
    setError(
      result.error && /share_token/.test(result.error)
        ? "Sharing isn't set up in your database yet. Run supabase/sharing_and_dashboard.sql in the Supabase SQL Editor."
        : result.error
    )
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it.")
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={page.share_token ? "secondary" : "outline"}
          className="h-10 shrink-0 gap-1.5 rounded-xl px-3"
          title="Share this page"
        >
          {page.share_token ? (
            <Globe className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {page.share_token ? "Shared" : "Share"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 rounded-xl p-4">
        <div>
          <p className="text-sm font-extrabold">Share this page</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Anyone with the link can view “{page.title}”. They can't change your
            page, and you can turn the link off at any time.
          </p>
        </div>
        {link ? (
          <>
            <div className="flex gap-1.5">
              <Input
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 text-xs"
                aria-label="Share link"
              />
              <Button
                size="sm"
                className="h-9 shrink-0 gap-1 rounded-lg"
                onClick={() => void copy()}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={busy}
                onClick={() => void setToken(newShareToken())}
                title="The old link stops working"
              >
                New link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => void setToken(null)}
              >
                Stop sharing
              </Button>
            </div>
          </>
        ) : (
          <Button
            className="w-full gap-1.5 rounded-lg"
            disabled={busy}
            onClick={() => void setToken(newShareToken())}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}{" "}
            Create a share link
          </Button>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Render with `key={page.id}` so switching pages starts fresh editor state. */
export function CustomPageView({
  page,
  onOpenSettings,
}: {
  page: CustomPage
  onOpenSettings: () => void
}) {
  const { updateCustomPage } = useWorkspace()
  const { save, status, error } = usePageAutosave(page.id)
  const [title, setTitle] = useState(page.title)
  const [titleError, setTitleError] = useState<string | null>(null)

  const saveTitle = async () => {
    const clean = title.trim()
    if (!clean) {
      setTitle(page.title)
      return
    }
    if (clean === page.title) return
    const result = await updateCustomPage(page.id, { title: clean })
    setTitleError(result.error)
  }

  return (
    <main className="min-h-screen w-full px-3 py-5 text-foreground antialiased sm:px-6 sm:py-8 xl:px-10">
      <div
        className={
          isWidePage(page.kind)
            ? "mx-auto w-full max-w-[1440px] space-y-5"
            : "mx-auto w-full max-w-[860px] space-y-5"
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              {createElement(resolveIcon(page.icon_name), {
                className: "h-5 w-5",
              })}
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(event) =>
                  event.key === "Enter" && event.currentTarget.blur()
                }
                maxLength={60}
                aria-label="Page title"
                className="w-full truncate rounded-md bg-transparent text-2xl font-extrabold tracking-tight outline-none focus:bg-muted/40 sm:text-3xl"
              />
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{customPageKindLabel(page.kind)}</span>
                <span aria-hidden>·</span>
                <SaveIndicator
                  status={titleError ? "error" : status}
                  error={titleError ?? error}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <SharePopover page={page} />
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={onOpenSettings}
              title="Manage pages"
              aria-label="Manage pages"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <PageBody kind={page.kind} content={page.content} onSave={save} />
      </div>
    </main>
  )
}
