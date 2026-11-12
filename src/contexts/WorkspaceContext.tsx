import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import {
  BUILT_IN_PAGES,
  DASHBOARD_SECTIONS,
  DEFAULT_WORKSPACE_SETTINGS,
  MAX_CUSTOM_PAGES,
  MAX_WIDGETS,
  applyOrder,
  newId,
  type DashboardWidget,
  type DashboardSectionId,
  currencySymbol,
  customPageKindLabel,
  customViewId,
  formatMoney,
  type CustomPage,
  type CustomPageContent,
  type CustomPageKind,
  type PageId,
  type WorkspaceSettings,
} from "@/lib/workspace"
import { planById, type Plan } from "@/lib/plans"
import { UpgradeDialog } from "@/components/shared/Widgets/UpgradeDialog"

export type WorkspacePage = {
  id: PageId
  label: string
  description: string
  icon: string
  kind: "built-in" | CustomPageKind
  hidden: boolean
}

type Result = { error: string | null }
type NewCustomPage = {
  title: string
  icon_name: string
  kind: CustomPageKind
  content: CustomPageContent
}
type CustomPageUpdates = Partial<
  Pick<CustomPage, "title" | "icon_name" | "content" | "share_token">
>

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number] & {
  hidden: boolean
}

// Older rows (or no row yet) may lack newer fields such as `dashboard`.
const withDefaults = (
  raw: Partial<WorkspaceSettings> | null | undefined
): WorkspaceSettings => ({
  ...DEFAULT_WORKSPACE_SETTINGS,
  ...(raw ?? {}),
  dashboard: {
    ...DEFAULT_WORKSPACE_SETTINGS.dashboard,
    ...(raw?.dashboard ?? {}),
  },
})

const MIGRATION_HINT =
  "Run supabase/sharing_and_dashboard.sql in the Supabase SQL Editor, then try again."

interface WorkspaceContextType {
  isLoading: boolean
  errorMessage: string | null
  settings: WorkspaceSettings
  customPages: CustomPage[]
  /** All pages in the user's order, including hidden ones. */
  pages: WorkspacePage[]
  visiblePages: WorkspacePage[]
  isPageVisible: (id: string) => boolean
  setPageHidden: (id: PageId, hidden: boolean) => Promise<Result>
  movePage: (id: PageId, direction: -1 | 1) => Promise<Result>
  setCurrency: (currency: string) => Promise<Result>
  setClockVisibility: (device: "mobile" | "desktop", visible: boolean) => Promise<Result>
  createCustomPage: (
    input: NewCustomPage
  ) => Promise<Result & { page?: CustomPage }>
  updateCustomPage: (id: string, updates: CustomPageUpdates) => Promise<Result>
  deleteCustomPage: (id: string) => Promise<Result>
  /** How many custom pages this user's plan allows. */
  pageLimit: number
  plan: Plan
  /** True while the user is below their page limit. */
  canCreatePage: boolean
  /** Opens the "get more pages" dialog. */
  openUpgrade: () => void
  dashboardSections: DashboardSection[]
  setDashboardSectionHidden: (
    id: DashboardSectionId,
    hidden: boolean
  ) => Promise<Result>
  moveDashboardSection: (
    id: DashboardSectionId,
    direction: -1 | 1
  ) => Promise<Result>
  widgets: DashboardWidget[]
  addWidget: (widget: Omit<DashboardWidget, "id">) => Promise<Result>
  updateWidget: (
    id: string,
    changes: Partial<DashboardWidget>
  ) => Promise<Result>
  removeWidget: (id: string) => Promise<Result>
  moveWidget: (id: string, direction: -1 | 1) => Promise<Result>
  formatMoney: (amount: number, maximumFractionDigits?: number) => string
  currencySymbol: string
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

// Cached locally so the workspace still works before supabase/workspace.sql has been run.
const SETTINGS_CACHE_KEY = "kaizen-workspace-settings-v1"

const readCachedSettings = (userId: string): WorkspaceSettings => {
  try {
    const raw = localStorage.getItem(`${SETTINGS_CACHE_KEY}:${userId}`)
    return withDefaults(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_WORKSPACE_SETTINGS
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<WorkspaceSettings>(
    DEFAULT_WORKSPACE_SETTINGS
  )
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [planRow, setPlanRow] = useState<{
    plan: string
    page_limit: number
  } | null>(null)
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setSettings(DEFAULT_WORKSPACE_SETTINGS)
      setCustomPages([])
      setPlanRow(null)
      setIsLoading(false)
      return
    }

    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      const [settingsResult, pagesResult, planResult] = await Promise.all([
        supabase
          .from("workspace_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("custom_pages")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order")
          .order("created_at"),
        // Missing until supabase/plans_and_habits.sql runs; the default limit applies.
        supabase
          .from("user_plans")
          .select("plan,page_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])
      if (!active) return

      if (settingsResult.error) {
        setErrorMessage(settingsResult.error.message)
        setSettings(readCachedSettings(user.id))
      } else {
        setSettings(
          settingsResult.data
            ? withDefaults(settingsResult.data)
            : readCachedSettings(user.id)
        )
      }

      if (pagesResult.error) setErrorMessage(pagesResult.error.message)
      else setCustomPages((pagesResult.data ?? []) as CustomPage[])

      setPlanRow(planResult.error ? null : planResult.data)

      setIsLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [user?.id])

  const saveSettings = async (next: WorkspaceSettings): Promise<Result> => {
    setSettings(next)
    if (!user?.id) return { error: null }
    localStorage.setItem(
      `${SETTINGS_CACHE_KEY}:${user.id}`,
      JSON.stringify(next)
    )
    // Rows read with select("*") carry user_id/updated_at; send only our own fields.
    const fields: Partial<WorkspaceSettings & { user_id: string }> = { ...next }
    delete fields.user_id
    const { error } = await supabase
      .from("workspace_settings")
      .upsert(
        { ...fields, user_id: user.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
    if (error) {
      const message = error.message.includes("dashboard")
        ? `Your database is missing the dashboard settings column. ${MIGRATION_HINT}`
        : error.message
      setErrorMessage(message)
      return { error: message }
    }
    return { error: null }
  }

  const pages = useMemo<WorkspacePage[]>(() => {
    const all: WorkspacePage[] = [
      ...BUILT_IN_PAGES.map((page) => ({
        ...page,
        kind: "built-in" as const,
        hidden: false,
      })),
      ...customPages.map((page) => ({
        id: customViewId(page.id),
        label: page.title,
        description: `Your ${customPageKindLabel(page.kind).toLowerCase()}`,
        icon: page.icon_name,
        kind: page.kind,
        hidden: false,
      })),
    ].map((page) => ({
      ...page,
      hidden: settings.hidden_pages.includes(page.id),
    }))

    // Pages the user hasn't explicitly ordered keep their registry order.
    return applyOrder(all, (page) => page.id, settings.page_order)
  }, [customPages, settings.hidden_pages, settings.page_order])

  const visiblePages = useMemo(
    () => pages.filter((page) => !page.hidden),
    [pages]
  )

  const isPageVisible = useCallback(
    (id: string) =>
      id === "dashboard" || visiblePages.some((page) => page.id === id),
    [visiblePages]
  )

  const setPageHidden = (id: PageId, hidden: boolean) =>
    saveSettings({
      ...settings,
      hidden_pages: hidden
        ? [...new Set([...settings.hidden_pages, id])]
        : settings.hidden_pages.filter((pageId) => pageId !== id),
    })

  const movePage = (id: PageId, direction: -1 | 1) => {
    const order = pages.map((page) => page.id as string)
    const from = order.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= order.length)
      return Promise.resolve({ error: null })
    ;[order[from], order[to]] = [order[to], order[from]]
    return saveSettings({ ...settings, page_order: order })
  }

  const setCurrency = (currency: string) =>
    saveSettings({ ...settings, currency })

  const setClockVisibility = (device: "mobile" | "desktop", visible: boolean) =>
    saveSettings({
      ...settings,
      dashboard: {
        ...settings.dashboard,
        clockVisibility: {
          mobile: settings.dashboard.clockVisibility?.mobile ?? true,
          desktop: settings.dashboard.clockVisibility?.desktop ?? true,
          [device]: visible,
        },
      },
    })

  const plan = planById(planRow?.plan)
  const pageLimit = planRow?.page_limit ?? MAX_CUSTOM_PAGES
  const limitMessage = `You can have up to ${pageLimit} pages on the ${plan.name} plan. Delete one or get more pages.`

  const createCustomPage = async (input: NewCustomPage) => {
    if (!user?.id) return { error: "Sign in to create pages." }
    if (customPages.length >= pageLimit) return { error: limitMessage }
    const { data, error } = await supabase
      .from("custom_pages")
      .insert([{ user_id: user.id, ...input, sort_order: customPages.length }])
      .select("*")
      .single()
    if (error)
      return {
        error: error.message.includes("custom_pages_kind_check")
          ? "Your database doesn't allow this page type yet. Run supabase/custom_pages_v2.sql in the Supabase SQL Editor, then try again."
          : error.message.includes("Page limit")
            ? limitMessage
            : error.message,
      }
    const page = data as CustomPage
    setCustomPages((prev) => [...prev, page])
    return { error: null, page }
  }

  const updateCustomPage = async (id: string, updates: CustomPageUpdates) => {
    if (!user?.id) return { error: "Sign in to edit pages." }
    const previous = customPages.find((page) => page.id === id)
    setCustomPages((prev) =>
      prev.map((page) => (page.id === id ? { ...page, ...updates } : page))
    )
    const { data, error: updateError } = await supabase
      .from("custom_pages")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
    // An update blocked by row level security succeeds with zero rows, so treat that as a failure too.
    const error =
      updateError ??
      (data?.length
        ? null
        : { message: "This page couldn't be saved. It may have been deleted." })
    if (error) {
      if (previous)
        setCustomPages((prev) =>
          prev.map((page) => (page.id === id ? previous : page))
        )
      return { error: error.message }
    }
    return { error: null }
  }

  const deleteCustomPage = async (id: string) => {
    if (!user?.id) return { error: "Sign in to edit pages." }
    const { error } = await supabase
      .from("custom_pages")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { error: error.message }
    setCustomPages((prev) => prev.filter((page) => page.id !== id))
    const viewId = customViewId(id)
    if (
      settings.hidden_pages.includes(viewId) ||
      settings.page_order.includes(viewId)
    ) {
      await saveSettings({
        ...settings,
        hidden_pages: settings.hidden_pages.filter(
          (pageId) => pageId !== viewId
        ),
        page_order: settings.page_order.filter((pageId) => pageId !== viewId),
      })
    }
    return { error: null }
  }

  const dashboardSections = useMemo<DashboardSection[]>(
    () =>
      applyOrder(
        DASHBOARD_SECTIONS.map((section) => ({
          ...section,
          hidden: settings.dashboard.hidden.includes(section.id),
        })),
        (section) => section.id,
        settings.dashboard.order
      ),
    [settings.dashboard]
  )

  const setDashboardSectionHidden = (id: DashboardSectionId, hidden: boolean) =>
    saveSettings({
      ...settings,
      dashboard: {
        ...settings.dashboard,
        hidden: hidden
          ? [...new Set([...settings.dashboard.hidden, id])]
          : settings.dashboard.hidden.filter((sectionId) => sectionId !== id),
      },
    })

  const moveDashboardSection = (id: DashboardSectionId, direction: -1 | 1) => {
    const order = dashboardSections.map((section) => section.id as string)
    const from = order.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= order.length)
      return Promise.resolve({ error: null })
    ;[order[from], order[to]] = [order[to], order[from]]
    return saveSettings({
      ...settings,
      dashboard: { ...settings.dashboard, order },
    })
  }

  const widgets = settings.dashboard.widgets ?? []
  const saveWidgets = (next: DashboardWidget[]) =>
    saveSettings({
      ...settings,
      dashboard: { ...settings.dashboard, widgets: next },
    })

  const addWidget = (widget: Omit<DashboardWidget, "id">) =>
    widgets.length >= MAX_WIDGETS
      ? Promise.resolve({ error: `You can have up to ${MAX_WIDGETS} widgets.` })
      : saveWidgets([...widgets, { ...widget, id: newId() }])

  const updateWidget = (id: string, changes: Partial<DashboardWidget>) =>
    saveWidgets(
      widgets.map((widget) =>
        widget.id === id ? { ...widget, ...changes } : widget
      )
    )

  const removeWidget = (id: string) =>
    saveWidgets(widgets.filter((widget) => widget.id !== id))

  const moveWidget = (id: string, direction: -1 | 1) => {
    const from = widgets.findIndex((widget) => widget.id === id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= widgets.length)
      return Promise.resolve({ error: null })
    const next = [...widgets]
    ;[next[from], next[to]] = [next[to], next[from]]
    return saveWidgets(next)
  }

  const value: WorkspaceContextType = {
    isLoading,
    errorMessage,
    settings,
    customPages,
    pages,
    visiblePages,
    isPageVisible,
    setPageHidden,
    movePage,
    setCurrency,
    setClockVisibility,
    createCustomPage,
    updateCustomPage,
    deleteCustomPage,
    pageLimit,
    plan,
    canCreatePage: customPages.length < pageLimit,
    openUpgrade: () => setIsUpgradeOpen(true),
    dashboardSections,
    setDashboardSectionHidden,
    moveDashboardSection,
    widgets,
    addWidget,
    updateWidget,
    removeWidget,
    moveWidget,
    formatMoney: (amount, maximumFractionDigits) =>
      formatMoney(amount, settings.currency, maximumFractionDigits),
    currencySymbol: currencySymbol(settings.currency),
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {user && (
        <UpgradeDialog
          open={isUpgradeOpen}
          onOpenChange={setIsUpgradeOpen}
          plan={plan}
          pageCount={customPages.length}
          pageLimit={pageLimit}
        />
      )}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context)
    throw new Error("useWorkspace must be used within a WorkspaceProvider")
  return context
}
