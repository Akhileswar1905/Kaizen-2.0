import { useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics"
import {
  MAX_WIDGETS,
  resolveIcon,
  type DashboardWidget,
  type WidgetType,
} from "@/lib/workspace"
import { WidgetCard } from "./DashboardWidgets"
import {
  RANGE_LABELS,
  WIDGET_TYPES,
  defaultWidget,
  describeWidget,
} from "@/lib/dashboardWidgets"

type Draft = { id?: string; widget: Omit<DashboardWidget, "id"> }

const RANGES_BY_TYPE: Partial<Record<WidgetType, (1 | 7 | 14 | 30)[]>> = {
  stat: [1, 7, 14, 30],
  chart: [7, 14, 30],
  meter: [1, 7, 30],
}

const fieldClass =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm"

/** Lists the dashboard's widgets and edits them with a live preview. */
export function WidgetManager() {
  const { widgets, addWidget, updateWidget, removeWidget, moveWidget } =
    useWorkspace()
  const metrics = useDashboardMetrics()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    setError(result.error)
    return result
  }

  const firstMetric = metrics.metrics[0]?.id

  if (draft) {
    const widget = draft.widget
    const set = (changes: Partial<DashboardWidget>) =>
      setDraft({ ...draft, widget: { ...widget, ...changes } })
    const usesMetric =
      widget.type === "stat" ||
      widget.type === "chart" ||
      widget.type === "meter"
    const groups = [...new Set(metrics.metrics.map((metric) => metric.group))]
    const metricDef = metrics.metric(widget.metric)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold">
            {draft.id ? "Edit widget" : "Add a widget"}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setDraft(null)}
          >
            Back to widgets
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {WIDGET_TYPES.map((option) => {
            const Icon = resolveIcon(option.icon)
            return (
              <button
                key={option.type}
                type="button"
                aria-pressed={widget.type === option.type}
                onClick={() => {
                  if (widget.type === option.type) return
                  // Start from the new type's defaults, keeping the chosen data source.
                  setDraft({
                    ...draft,
                    widget: defaultWidget(
                      option.type,
                      (usesMetric && widget.metric) || firstMetric
                    ),
                  })
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors",
                  widget.type === option.type
                    ? "border-foreground/40 bg-muted"
                    : "border-border/70 hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-bold">{option.label}</span>
                <span className="hidden text-[10px] leading-snug font-normal text-muted-foreground sm:block">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await run(() =>
                draft.id ? updateWidget(draft.id, widget) : addWidget(widget)
              )
              if (!result.error) setDraft(null)
            }}
          >
            {usesMetric && (
              <div className="grid gap-1.5">
                <Label htmlFor="widget-metric" className="text-xs">
                  Data
                </Label>
                <select
                  id="widget-metric"
                  value={widget.metric ?? ""}
                  onChange={(event) => set({ metric: event.target.value })}
                  className={fieldClass}
                >
                  {!metricDef && (
                    <option value={widget.metric ?? ""}>Choose data…</option>
                  )}
                  {groups.map((group) => (
                    <optgroup key={group} label={group}>
                      {metrics.metrics
                        .filter((metric) => metric.group === group)
                        .map((metric) => (
                          <option key={metric.id} value={metric.id}>
                            {metric.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {metrics.metrics.every(
                  (metric) => !metric.id.includes(":")
                ) && (
                  <p className="text-[11px] text-muted-foreground">
                    Tip: add a Tracker or Journal page and its data shows up
                    here too.
                  </p>
                )}
              </div>
            )}

            {usesMetric && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="widget-range" className="text-xs">
                    Period
                  </Label>
                  <select
                    id="widget-range"
                    value={widget.range ?? 7}
                    onChange={(event) =>
                      set({
                        range: Number(
                          event.target.value
                        ) as DashboardWidget["range"],
                      })
                    }
                    className={fieldClass}
                  >
                    {(RANGES_BY_TYPE[widget.type] ?? [7]).map((range) => (
                      <option key={range} value={range}>
                        {range === 1
                          ? "Today"
                          : range === 7 && widget.type === "meter"
                            ? "Last 7 days"
                            : RANGE_LABELS[range]}
                      </option>
                    ))}
                  </select>
                </div>
                {widget.type === "chart" && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Style</Label>
                    <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5">
                      {(["bars", "line"] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => set({ chartStyle: style })}
                          className={cn(
                            "flex-1 rounded-md py-1.5 text-xs font-bold capitalize",
                            (widget.chartStyle ?? "bars") === style
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground"
                          )}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {widget.type === "meter" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="widget-target" className="text-xs">
                      Goal
                      {metricDef?.unit && metricDef.kind !== "money"
                        ? ` (${metricDef.unit})`
                        : ""}
                    </Label>
                    <Input
                      id="widget-target"
                      type="number"
                      min="0"
                      step="any"
                      value={widget.target ?? ""}
                      onChange={(event) =>
                        set({
                          target:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        })
                      }
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="widget-title" className="text-xs">
                Title{" "}
                {usesMetric && (
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                )}
              </Label>
              <Input
                id="widget-title"
                value={widget.title ?? ""}
                onChange={(event) =>
                  set({ title: event.target.value || undefined })
                }
                maxLength={60}
                placeholder={usesMetric ? metricDef?.label : "Title"}
                className="h-9"
              />
            </div>

            {widget.type === "note" && (
              <div className="grid gap-1.5">
                <Label htmlFor="widget-text" className="text-xs">
                  Text
                </Label>
                <Textarea
                  id="widget-text"
                  value={widget.text ?? ""}
                  onChange={(event) => set({ text: event.target.value })}
                  rows={4}
                  maxLength={1000}
                  placeholder="You can also edit this right on the dashboard."
                />
              </div>
            )}

            {widget.type === "countdown" && (
              <div className="grid gap-1.5">
                <Label htmlFor="widget-date" className="text-xs">
                  Date
                </Label>
                <Input
                  id="widget-date"
                  type="date"
                  value={widget.date ?? ""}
                  onChange={(event) => set({ date: event.target.value })}
                  className="h-9"
                />
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(widget.wide)}
                onChange={(event) => set({ wide: event.target.checked })}
                className="h-4 w-4 accent-foreground"
              />
              Wide (takes two columns)
            </label>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="rounded-lg"
                disabled={
                  busy ||
                  (usesMetric && !metricDef) ||
                  (widget.type === "countdown" && !widget.date)
                }
              >
                {draft.id ? "Save widget" : "Add to dashboard"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
            </div>
          </form>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Preview{metrics.loading ? " · loading your data…" : ""}
            </p>
            <WidgetCard
              widget={{ ...widget, id: "preview" }}
              metrics={metrics}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          Widgets{" "}
          <span className="text-xs font-semibold text-muted-foreground">
            · {widgets.length} of {MAX_WIDGETS}
          </span>
        </h3>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-lg"
          disabled={widgets.length >= MAX_WIDGETS}
          onClick={() => {
            setError(null)
            setDraft({ widget: defaultWidget("chart", firstMetric) })
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add widget
        </Button>
      </div>
      {widgets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No widgets yet. Add a chart of your spending, a goal meter for water,
          a countdown, or a note for the week.
        </p>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/70">
          {widgets.map((widget, index) => {
            const Icon = resolveIcon(
              WIDGET_TYPES.find((item) => item.type === widget.type)?.icon ??
                "LayoutDashboard"
            )
            return (
              <div
                key={widget.id}
                className="flex items-center gap-2 px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {describeWidget(widget, metrics)}
                </p>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={busy || index === 0}
                    onClick={() => void run(() => moveWidget(widget.id, -1))}
                    aria-label="Move widget up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={busy || index === widgets.length - 1}
                    onClick={() => void run(() => moveWidget(widget.id, 1))}
                    aria-label="Move widget down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setError(null)
                      const { id, ...rest } = widget
                      setDraft({ id, widget: rest })
                    }}
                    aria-label="Edit widget"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    disabled={busy}
                    onClick={() => void run(() => removeWidget(widget.id))}
                    aria-label="Delete widget"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
