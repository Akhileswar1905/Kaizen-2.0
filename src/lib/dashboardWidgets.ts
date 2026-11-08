import { format } from "date-fns"
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics"
import type { DashboardWidget, WidgetType } from "@/lib/workspace"

export const WIDGET_TYPES: {
  type: WidgetType
  label: string
  description: string
  icon: string
}[] = [
  {
    type: "stat",
    label: "Stat",
    description: "One number with its change and a trend line",
    icon: "Hash",
  },
  {
    type: "chart",
    label: "Chart",
    description: "Bars or a line over 7–30 days",
    icon: "ChartColumn",
  },
  {
    type: "meter",
    label: "Goal meter",
    description: "Progress towards a target",
    icon: "Gauge",
  },
  {
    type: "note",
    label: "Note",
    description: "A text field you edit on the dashboard",
    icon: "StickyNote",
  },
  {
    type: "countdown",
    label: "Countdown",
    description: "Days left until a date",
    icon: "Hourglass",
  },
  {
    type: "focus",
    label: "Focus session",
    description: "A focus and break timer with an alarm",
    icon: "Timer",
  },
]

export const RANGE_LABELS: Record<number, string> = {
  1: "Today",
  7: "Last 7 days",
  14: "Last 14 days",
  30: "Last 30 days",
}

/** Sensible starting settings for a new widget of each type. */
export function defaultWidget(
  type: WidgetType,
  firstMetric = "habits.checkins"
): Omit<DashboardWidget, "id"> {
  switch (type) {
    case "stat":
      return { type, metric: firstMetric, range: 7 }
    case "chart":
      return {
        type,
        metric: firstMetric,
        range: 14,
        chartStyle: "bars",
        wide: true,
      }
    case "meter":
      return { type, metric: firstMetric, range: 1, target: 5 }
    case "note":
      return { type, title: "Note", text: "" }
    case "countdown":
      return {
        type,
        title: "Something to look forward to",
        date: format(new Date(Date.now() + 14 * 86_400_000), "yyyy-MM-dd"),
      }
    case "focus":
      return { type, title: "Focus session", focusMinutes: 25, breakMinutes: 5, alarmEnabled: true }
  }
}

/** A one-line summary for lists (e.g. "Chart · Spending · Last 14 days"). */
export function describeWidget(
  widget: DashboardWidget,
  metrics: DashboardMetrics
) {
  const type =
    WIDGET_TYPES.find((item) => item.type === widget.type)?.label ?? "Widget"
  if (widget.type === "note") return `${type} · ${widget.title || "Untitled"}`
  if (widget.type === "countdown" || widget.type === "focus")
    return `${type} · ${widget.title || "Untitled"}`
  const metricLabel =
    metrics.metric(widget.metric)?.label ?? "Missing data source"
  return `${type} · ${widget.title || metricLabel} · ${RANGE_LABELS[widget.range ?? 7] ?? ""}`
}
