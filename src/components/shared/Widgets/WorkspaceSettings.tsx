import { useState } from "react"
import { useTheme } from "@/components/theme-provider"
import * as Icons from "lucide-react"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { IconPicker } from "./IconPicker"
import { WidgetManager } from "./WidgetManager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspace, type WorkspacePage } from "@/contexts/WorkspaceContext"
import {
  CURRENCIES,
  resolveIcon,
  type CustomPage,
  type PageId,
} from "@/lib/workspace"
import {
  PAGE_TEMPLATES,
  defaultTitle,
  type PageTemplate,
} from "@/lib/pageTemplates"

export type SettingsTab = "pages" | "dashboard" | "general"

interface WorkspaceSettingsProps {
  isOpen: boolean
  onClose: () => void
  onOpenPage: (id: PageId) => void
  /** Tab shown when the dialog opens (remount with a new key to apply). */
  initialTab?: SettingsTab
}

type Editing = { mode: "create" } | { mode: "edit"; page: CustomPage }

export function WorkspaceSettings({
  isOpen,
  onClose,
  onOpenPage,
  initialTab = "pages",
}: WorkspaceSettingsProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const { theme, setTheme } = useTheme()
  const {
    pages,
    customPages,
    settings,
    errorMessage,
    setPageHidden,
    movePage,
    setCurrency,
    createCustomPage,
    updateCustomPage,
    deleteCustomPage,
    canCreatePage,
    pageLimit,
    plan,
    openUpgrade,
    dashboardSections,
    setDashboardSectionHidden,
    moveDashboardSection,
  } = useWorkspace()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<CustomPage | null>(null)
  const [title, setTitle] = useState("")
  const [iconName, setIconName] = useState("FileText")
  const [template, setTemplate] = useState<PageTemplate>(PAGE_TEMPLATES[0])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = async (action: () => Promise<{ error: string | null }>) => {
    setSaving(true)
    const result = await action()
    setSaving(false)
    setActionError(result.error)
    return result
  }

  const openCreate = () => {
    setTitle("")
    setIconName(PAGE_TEMPLATES[0].icon)
    setTemplate(PAGE_TEMPLATES[0])
    setActionError(null)
    setEditing({ mode: "create" })
  }

  const openEdit = (page: CustomPage) => {
    setTitle(page.title)
    setIconName(page.icon_name)
    setActionError(null)
    setEditing({ mode: "edit", page })
  }

  const customPageFor = (page: WorkspacePage) =>
    customPages.find((item) => `custom:${item.id}` === page.id)

  const savePage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    if (editing.mode === "create") {
      setSaving(true)
      const result = await createCustomPage({
        title: title.trim() || defaultTitle(template),
        icon_name: iconName,
        kind: template.kind,
        content: template.build(),
      })
      setSaving(false)
      setActionError(result.error)
      if (result.error || !result.page) return
      setEditing(null)
      onClose()
      onOpenPage(`custom:${result.page.id}`)
      return
    }
    if (!title.trim()) return
    const result = await run(() =>
      updateCustomPage(editing.page.id, {
        title: title.trim(),
        icon_name: iconName,
      })
    )
    if (!result.error) setEditing(null)
  }

  const removePage = async () => {
    if (!deleting) return
    const result = await run(() => deleteCustomPage(deleting.id))
    if (!result.error) setDeleting(null)
  }

  return (
    <>
      <Dialog
        open={isOpen && !editing && !deleting}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customize your workspace</DialogTitle>
            <DialogDescription>
              Choose your pages, build your dashboard with widgets, and set your
              preferences.
            </DialogDescription>
          </DialogHeader>

          {(errorMessage || actionError) && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive"
            >
              {actionError ?? errorMessage}
              {!actionError && (
                <span className="mt-1 block font-normal text-muted-foreground">
                  Run <code>supabase/workspace.sql</code> in your Supabase SQL
                  Editor to save these settings to your account.
                </span>
              )}
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as SettingsTab)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

            <TabsContent value="pages" className="mt-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">
                    Pages{" "}
                    <span className="text-xs font-semibold text-muted-foreground">
                      · {customPages.length} of {pageLimit} custom pages
                    </span>
                  </h3>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg"
                    onClick={canCreatePage ? openCreate : openUpgrade}
                  >
                    {canCreatePage ? (
                      <>
                        <Plus className="h-3.5 w-3.5" /> New page
                      </>
                    ) : (
                      <>
                        <Icons.Sparkles className="h-3.5 w-3.5" /> Get more
                        pages
                      </>
                    )}
                  </Button>
                </div>
                {!canCreatePage && (
                  <p className="text-xs text-muted-foreground">
                    You've used all {pageLimit} custom pages on the {plan.name}{" "}
                    plan. Delete or combine a page, or{" "}
                    <button
                      type="button"
                      onClick={openUpgrade}
                      className="font-semibold text-foreground underline underline-offset-2"
                    >
                      get more pages
                    </button>
                    .
                  </p>
                )}
                <div className="divide-y divide-border/50 rounded-xl border border-border/70">
                  <div className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground">
                    <Icons.LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm font-semibold">
                      Dashboard
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      Always shown
                    </span>
                  </div>
                  {pages.map((page, index) => {
                    const PageIcon = resolveIcon(page.icon)
                    const custom = customPageFor(page)
                    return (
                      <div
                        key={page.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2",
                          page.hidden && "opacity-55"
                        )}
                      >
                        <PageIcon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {page.label}
                          </p>
                          <p className="truncate text-[11px] font-normal text-muted-foreground">
                            {page.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={saving || index === 0}
                            onClick={() =>
                              void run(() => movePage(page.id, -1))
                            }
                            aria-label={`Move ${page.label} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={saving || index === pages.length - 1}
                            onClick={() => void run(() => movePage(page.id, 1))}
                            aria-label={`Move ${page.label} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={saving}
                            onClick={() =>
                              void run(() =>
                                setPageHidden(page.id, !page.hidden)
                              )
                            }
                            aria-label={
                              page.hidden
                                ? `Show ${page.label}`
                                : `Hide ${page.label}`
                            }
                            title={
                              page.hidden ? "Show in menu" : "Hide from menu"
                            }
                          >
                            {page.hidden ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {custom && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(custom)}
                                aria-label={`Edit ${page.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-destructive"
                                onClick={() => {
                                  setActionError(null)
                                  setDeleting(custom)
                                }}
                                aria-label={`Delete ${page.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="dashboard" className="mt-4 space-y-6">
              <WidgetManager />
              <section className="space-y-2">
                <h3 className="text-sm font-bold">Sections</h3>
                <p className="text-xs font-normal text-muted-foreground">
                  Choose which sections appear on your dashboard, and in what
                  order. Sections for hidden pages stay hidden.
                </p>
                <div className="divide-y divide-border/50 rounded-xl border border-border/70">
                  {dashboardSections.map((section, index) => {
                    const SectionIcon = resolveIcon(section.icon)
                    return (
                      <div
                        key={section.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2",
                          section.hidden && "opacity-55"
                        )}
                      >
                        <SectionIcon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {section.label}
                          </p>
                          <p className="truncate text-[11px] font-normal text-muted-foreground">
                            {section.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={saving || index === 0}
                            onClick={() =>
                              void run(() =>
                                moveDashboardSection(section.id, -1)
                              )
                            }
                            aria-label={`Move ${section.label} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={
                              saving || index === dashboardSections.length - 1
                            }
                            onClick={() =>
                              void run(() =>
                                moveDashboardSection(section.id, 1)
                              )
                            }
                            aria-label={`Move ${section.label} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={saving}
                            onClick={() =>
                              void run(() =>
                                setDashboardSectionHidden(
                                  section.id,
                                  !section.hidden
                                )
                              )
                            }
                            aria-label={
                              section.hidden
                                ? `Show ${section.label}`
                                : `Hide ${section.label}`
                            }
                            title={
                              section.hidden
                                ? "Show on dashboard"
                                : "Hide from dashboard"
                            }
                          >
                            {section.hidden ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="general" className="mt-4 space-y-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold">Appearance</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Choose how Kaizen looks on this device.</p>
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
                  {([
                    { value: "light", label: "Light", Icon: Sun },
                    { value: "dark", label: "Dark", Icon: Moon },
                    { value: "system", label: "System", Icon: Monitor },
                  ] as const).map(({ value, label, Icon }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={theme === value ? "secondary" : "outline"}
                      aria-pressed={theme === value}
                      onClick={() => setTheme(value)}
                      className={cn("h-auto flex-col gap-2 rounded-xl py-3", theme === value && "border-primary/40 bg-primary/10 text-primary")}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </section>
              <section className="grid gap-2 border-t border-border/60 pt-5">
                <Label
                  htmlFor="workspace-currency"
                  className="text-sm font-bold"
                >
                  Currency
                </Label>
                <select
                  id="workspace-currency"
                  value={settings.currency}
                  disabled={saving}
                  onChange={(e) => void run(() => setCurrency(e.target.value))}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} · {currency.label}
                    </option>
                  ))}
                </select>
              </section>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!saving && !open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "edit" ? "Edit page" : "Create a page"}
            </DialogTitle>
            <DialogDescription>
              Your page gets its own spot in the menu.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePage} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-page-title">Name</Label>
              <Input
                id="custom-page-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required={editing?.mode === "edit"}
                maxLength={60}
                placeholder={
                  editing?.mode === "create"
                    ? defaultTitle(template)
                    : "Page name"
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <IconPicker
                selectedIconName={iconName}
                onSelectIcon={setIconName}
              />
            </div>
            {editing?.mode === "create" && (
              <div className="grid gap-2">
                <Label>Start from</Label>
                {(
                  [
                    {
                      group: "app",
                      label: "Apps",
                      description:
                        "Ready-to-use tools that track things for you",
                    },
                    {
                      group: "document",
                      label: "Pages, tables & boards",
                      description: "Free-form documents you fill in",
                    },
                  ] as const
                ).map((section) => (
                  <div key={section.group} className="space-y-1.5">
                    <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      {section.label} ·{" "}
                      <span className="tracking-normal normal-case">
                        {section.description}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAGE_TEMPLATES.filter(
                        (option) => option.group === section.group
                      ).map((option) => {
                        const TemplateIcon = resolveIcon(option.icon)
                        const selected = template.id === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              // Follow the template's icon unless the user picked their own.
                              if (iconName === template.icon)
                                setIconName(option.icon)
                              setTemplate(option)
                            }}
                            aria-pressed={selected}
                            className={cn(
                              "flex items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
                              selected
                                ? "border-foreground/40 bg-muted"
                                : "border-border/70 hover:bg-muted/50"
                            )}
                          >
                            <TemplateIcon className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-sm font-bold">
                                {option.name}
                              </span>
                              <span className="block text-[11px] leading-snug font-normal text-muted-foreground">
                                {option.description}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || (editing?.mode === "edit" && !title.trim())}
              >
                {saving
                  ? "Saving…"
                  : editing?.mode === "edit"
                    ? "Save changes"
                    : "Create page"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!saving && !open) setDeleting(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this page?</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” and everything on it will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removePage()}
              disabled={saving}
            >
              {saving ? "Deleting…" : "Delete page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
