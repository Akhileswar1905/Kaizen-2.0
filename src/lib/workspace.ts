import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type BuiltInPageId =
  | "habits"
  | "dsa"
  | "finance"
  | "notes"
  | "planner"
  | "learning-checklist"
  | "journal"
  | "system-design"
  | "workout-tracker"
  | "time-audit"

export type PageId = BuiltInPageId | `custom:${string}`
export type ActiveView = "dashboard" | PageId

// "notes" and "checklist" are legacy kinds; both now open in the page editor.
export type DocumentKind = "page" | "table" | "board"
export type AppKind =
  | "journal"
  | "tracker"
  | "goals"
  | "countdown"
  | "flashcards"
export type CustomPageKind = DocumentKind | AppKind | "notes" | "checklist"

export type ChecklistItem = { id: string; title: string; done: boolean }

export type TableColumnType =
  | "text"
  | "number"
  | "checkbox"
  | "select"
  | "date"
  | "url"
export type TableColumn = {
  id: string
  name: string
  type: TableColumnType
  options?: string[]
}
export type TableCellValue = string | number | boolean | null
export type TableRow = { id: string; cells: Record<string, TableCellValue> }
export type TableContent = { columns: TableColumn[]; rows: TableRow[] }

export type BoardColumn = { id: string; title: string }
export type BoardCard = {
  id: string
  columnId: string
  title: string
  notes?: string
}
export type BoardContent = { columns: BoardColumn[]; cards: BoardCard[] }

export type Mood = 1 | 2 | 3 | 4 | 5
export type JournalEntry = {
  mood?: Mood | null
  html: string
  updatedAt: string
}
export type JournalContent = { entries: Record<string, JournalEntry> }

export type TrackerContent = {
  unit: string
  goal: number
  steps: number[]
  /** yyyy-MM-dd → amount logged that day */
  log: Record<string, number>
}

export type Milestone = { id: string; title: string; done: boolean }
export type Goal = {
  id: string
  title: string
  why?: string
  due?: string | null
  milestones: Milestone[]
  achievedAt?: string | null
  createdAt: string
}
export type GoalsContent = { goals: Goal[] }

export type CountdownEvent = {
  id: string
  title: string
  date: string
  yearly?: boolean
}
export type CountdownContent = {
  events: CountdownEvent[]
  yearlyByDefault?: boolean
}

export type Flashcard = {
  id: string
  front: string
  back: string
  /** Leitner box, 1 (new/hard) to 5 (mastered) */
  box: number
  due: string
}
export type FlashcardsContent = { cards: Flashcard[] }

export type CustomPageContent = {
  html?: string
  items?: ChecklistItem[]
  table?: TableContent
  board?: BoardContent
  journal?: JournalContent
  tracker?: TrackerContent
  goals?: GoalsContent
  countdown?: CountdownContent
  flashcards?: FlashcardsContent
}

export type CustomPage = {
  id: string
  user_id: string
  title: string
  icon_name: string
  kind: CustomPageKind
  content: CustomPageContent
  /** Set when the page is shared by link; anyone with the link can view it. */
  share_token?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type WorkspaceSettings = {
  hidden_pages: string[]
  page_order: string[]
  currency: string
  dashboard: { order: string[]; hidden: string[]; widgets?: DashboardWidget[] }
}

export type WidgetType = "stat" | "chart" | "meter" | "note" | "countdown" | "focus"

export type DashboardWidget = {
  id: string
  type: WidgetType
  title?: string
  /** Metric id from src/lib/dashboardMetrics.ts (stat, chart, meter). */
  metric?: string
  /** Days covered: 1 = today. */
  range?: 1 | 7 | 14 | 30
  chartStyle?: "bars" | "line"
  /** Meter goal. */
  target?: number
  /** Note text. */
  text?: string
  /** Countdown date, yyyy-MM-dd. */
  date?: string
  /** Focus session duration in minutes. */
  focusMinutes?: number
  /** Break duration in minutes. */
  breakMinutes?: number
  /** Play an alarm when a session ends. */
  alarmEnabled?: boolean
  /** Spans two columns on wide screens. */
  wide?: boolean
}

export const MAX_WIDGETS = 12

export type BuiltInPage = {
  id: BuiltInPageId
  label: string
  description: string
  icon: string
}

// Every page except the dashboard can be hidden or reordered per user.
// DSA, System design and Workout are retired: leaving them out of this list
// removes them from Preferences, the menu and the dashboard for everyone.
// Their views are still in the codebase; add an entry back to restore one.
export const BUILT_IN_PAGES: BuiltInPage[] = [
  {
    id: "habits",
    label: "Habits",
    description: "Daily habits, streaks and weekly review",
    icon: "Target",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Income, expenses and budgets",
    icon: "Wallet",
  },
  {
    id: "notes",
    label: "Notes",
    description: "Folders of rich-text notes",
    icon: "StickyNote",
  },
  {
    id: "planner",
    label: "Planner",
    description: "Tasks and weekly time blocks",
    icon: "Calendar",
  },
  {
    id: "learning-checklist",
    label: "Learning",
    description: "Learning tracks and checklists",
    icon: "ListChecks",
  },
  {
    id: "journal",
    label: "Journal",
    description: "Daily journal entries",
    icon: "BookOpen",
  },
  {
    id: "time-audit",
    label: "Time audit",
    description: "Hour-by-hour time tracking",
    icon: "Grid2x2",
  },
]

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  hidden_pages: ["journal", "time-audit"],
  page_order: [],
  currency: "INR",
  dashboard: { order: [], hidden: [], widgets: [] },
}

/** Keeps the menu tidy. Also enforced by a database trigger (supabase/sharing_and_dashboard.sql). */
export const MAX_CUSTOM_PAGES = 8

export type DashboardSectionId =
  | "quick-actions"
  | "widgets"
  | "momentum"
  | "today"
  | "finance"
  | "learning"
  | "pages"
  | "activity"

export const DASHBOARD_SECTIONS: {
  id: DashboardSectionId
  label: string
  description: string
  icon: string
}[] = [
  {
    id: "quick-actions",
    label: "Quick actions",
    description: "Shortcuts to add tasks, habits and money",
    icon: "Zap",
  },
  {
    id: "widgets",
    label: "Your widgets",
    description: "Charts, stats and notes you add yourself",
    icon: "LayoutDashboard",
  },
  {
    id: "momentum",
    label: "Overall progress",
    description: "Weekly activity, streaks and completion",
    icon: "ChartNoAxesColumnIncreasing",
  },
  {
    id: "today",
    label: "Today's focus",
    description: "Today's tasks, habits and schedule",
    icon: "Sun",
  },
  {
    id: "pages",
    label: "Your pages",
    description: "Live status of the pages you created",
    icon: "LayoutGrid",
  },
  {
    id: "finance",
    label: "Finance overview",
    description: "This month's income, spending and savings",
    icon: "Wallet",
  },
  {
    id: "learning",
    label: "Learning progress",
    description: "Your learning checklist",
    icon: "GraduationCap",
  },
  {
    id: "activity",
    label: "Recent activity",
    description: "What you've done in the last 30 days",
    icon: "Activity",
  },
]

/** Sorts ids by a saved order; ids not in the saved order keep their default position after it. */
export function applyOrder<T>(
  items: T[],
  idOf: (item: T) => string,
  order: string[]
) {
  const rank = (id: string) => {
    const index = order.indexOf(id)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => rank(idOf(a.item)) - rank(idOf(b.item)) || a.index - b.index
    )
    .map(({ item }) => item)
}

/** An unguessable token for share links (works without https, unlike randomUUID). */
export function newShareToken() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Public link to a shared page. Set VITE_PUBLIC_APP_URL to your deployed site
 * so links copied from the desktop app or localhost still work for others.
 */
export function shareUrl(token: string) {
  const base =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
      /\/+$/,
      ""
    ) ||
    `${location.origin}${location.pathname.replace(/\/[^/]*\.html$/, "")}`.replace(
      /\/+$/,
      ""
    )
  return `${base}/#/share/${token}`
}

const KIND_LABELS: Record<CustomPageKind, string> = {
  page: "Page",
  notes: "Page",
  checklist: "Page",
  table: "Table",
  board: "Board",
  journal: "Journal",
  tracker: "Tracker",
  goals: "Goals",
  countdown: "Countdowns",
  flashcards: "Flashcards",
}

/** Apps, tables and boards use the full width; documents read better narrower. */
export const isWidePage = (kind: CustomPageKind) =>
  !["page", "notes", "checklist"].includes(kind)

export const customPageKindLabel = (kind: CustomPageKind) =>
  KIND_LABELS[kind] ?? "Page"

// crypto.randomUUID only exists in secure contexts (https/localhost).
export const newId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export const resolveIcon = (name: string): LucideIcon =>
  (Icons as unknown as Record<string, LucideIcon | undefined>)[name] ??
  Icons.FileText

export const customViewId = (id: string): PageId => `custom:${id}`

/** Kaizen.tsx opens this view as soon as it exists (e.g. a page that was just created elsewhere). */
export const OPEN_VIEW_KEY = "kaizen-open-view"
export const requestOpenView = (view: string) =>
  sessionStorage.setItem(OPEN_VIEW_KEY, view)
export const isCustomView = (view: string): view is `custom:${string}` =>
  view.startsWith("custom:")

export const CURRENCIES = [
  { code: "INR", label: "Indian rupee", locale: "en-IN" },
  { code: "USD", label: "US dollar", locale: "en-US" },
  { code: "EUR", label: "Euro", locale: "en-IE" },
  { code: "GBP", label: "British pound", locale: "en-GB" },
  { code: "JPY", label: "Japanese yen", locale: "ja-JP" },
  { code: "AUD", label: "Australian dollar", locale: "en-AU" },
  { code: "CAD", label: "Canadian dollar", locale: "en-CA" },
  { code: "SGD", label: "Singapore dollar", locale: "en-SG" },
  { code: "AED", label: "UAE dirham", locale: "en-AE" },
]

const currencyLocale = (currency: string) =>
  CURRENCIES.find((item) => item.code === currency)?.locale ?? "en-US"

export function formatMoney(
  amount: number,
  currency: string,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount)
}

export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(currencyLocale(currency), {
      style: "currency",
      currency,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  )
}
