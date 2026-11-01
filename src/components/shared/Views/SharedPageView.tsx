import { createElement, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { CopyPlus, Eye, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import {
  customPageKindLabel,
  customViewId,
  isWidePage,
  requestOpenView,
  resolveIcon,
  type CustomPageContent,
  type CustomPageKind,
} from "@/lib/workspace"
import { PageBody } from "./CustomPageView"

type SharedPage = {
  title: string
  icon_name: string
  kind: CustomPageKind
  content: CustomPageContent
  updated_at: string
}

export function SharedPageView() {
  const { token = "" } = useParams()
  const { user } = useAuth()
  const { createCustomPage, canCreatePage, pageLimit, openUpgrade } =
    useWorkspace()
  const navigate = useNavigate()
  const [page, setPage] = useState<SharedPage | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading"
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .rpc("get_shared_page", { token })
      .then(({ data, error: rpcError }) => {
        if (!active) return
        const row = (Array.isArray(data) ? data[0] : data) as
          | SharedPage
          | undefined
        if (rpcError || !row) {
          setStatus("missing")
          return
        }
        setPage(row)
        setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [token])

  const saveCopy = async () => {
    if (!page) return
    setSaving(true)
    const result = await createCustomPage({
      title: page.title,
      icon_name: page.icon_name,
      kind: page.kind,
      content: page.content,
    })
    setSaving(false)
    if (result.error || !result.page) {
      setError(result.error)
      return
    }
    requestOpenView(customViewId(result.page.id))
    navigate("/")
  }

  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading shared page…
      </div>
    )

  if (status === "missing" || !page)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <Link2Off className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-extrabold">This link isn't available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page may have stopped being shared, or the link was copied
          incorrectly. Ask the owner for a new link.
        </p>
        <Button asChild variant="outline" className="mt-2 rounded-xl">
          <Link to="/">Go to Kaizen</Link>
        </Button>
      </div>
    )

  const isDocument = ["page", "notes", "checklist"].includes(page.kind)

  return (
    <main className="min-h-screen w-full px-3 py-5 text-foreground antialiased sm:px-6 sm:py-8 xl:px-10">
      <div
        className={
          isWidePage(page.kind)
            ? "mx-auto w-full max-w-[1440px] space-y-5"
            : "mx-auto w-full max-w-[860px] space-y-5"
        }
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              {createElement(resolveIcon(page.icon_name), {
                className: "h-5 w-5",
              })}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                {page.title}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Shared {customPageKindLabel(page.kind).toLowerCase()} · updated{" "}
                {format(parseISO(page.updated_at), "d MMM yyyy")}
              </p>
            </div>
          </div>
          {user ? (
            <Button
              className="gap-1.5 rounded-xl"
              disabled={saving}
              onClick={() => (canCreatePage ? void saveCopy() : openUpgrade())}
              title={
                canCreatePage
                  ? undefined
                  : `You've used all ${pageLimit} pages. Get more pages to save a copy.`
              }
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CopyPlus className="h-4 w-4" />
              )}{" "}
              Save a copy
            </Button>
          ) : (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Sign in to save a copy</Link>
            </Button>
          )}
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <p className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" />
          {isDocument
            ? "View only. You're seeing the owner's latest version."
            : "View only. You can click around, but nothing you change here is saved."}
        </p>

        <PageBody
          kind={page.kind}
          content={page.content}
          onSave={() => {}}
          readOnly
        />

        <p className="pt-6 text-center text-xs text-muted-foreground">
          Made with{" "}
          <Link to="/" className="font-bold text-foreground hover:underline">
            Kaizen
          </Link>
        </p>
      </div>
    </main>
  )
}
