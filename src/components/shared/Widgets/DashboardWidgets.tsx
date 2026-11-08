import { useState } from "react"
import { format, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Hourglass,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { daysUntil } from "@/lib/pageApps"
import type { DashboardMetrics, Point } from "@/hooks/useDashboardMetrics"
import type { DashboardWidget } from "@/lib/workspace"
import { RANGE_LABELS } from "@/lib/dashboardWidgets"
import { FocusSessionWidget } from "./FocusSessionWidget"

function Shell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[148px] flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-5",
        className
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold">{title}</p>
        {subtitle && (
          <p className="truncate text-xs font-normal text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function MissingMetric({ title }: { title: string }) {
  return (
    <Shell title={title}>
      <p className="mt-3 text-xs text-muted-foreground">
        This widget's data source no longer exists (its page may have been
        deleted). Edit the widget to pick another.
      </p>
    </Shell>
  )
}

/** A 12-ish point trend line in the de-emphasis colour, with the latest point in the accent. */
function Sparkline({ points }: { points: Point[] }) {
  const values = points.map((point) => point.value)
  const defined = values.filter((value): value is number => value !== null)
  if (defined.length < 2) return null
  const max = Math.max(...defined)
  const min = Math.min(0, ...defined)
  const span = max - min || 1
  const width = 120
  const height = 32
  const coords = values.map((value, index) =>
    value === null
      ? null
      : {
          x: (index / (values.length - 1)) * width,
          y: height - 4 - ((value - min) / span) * (height - 8),
        }
  )
  const path = coords.reduce((acc, point, index) => {
    if (!point) return acc
    const previous = coords[index - 1]
    return (
      acc +
      `${previous ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)} `
    )
  }, "")
  const last = [...coords].reverse().find(Boolean)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-28 overflow-visible"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.55}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r={4}
          fill="var(--chart-1)"
          stroke="var(--card)"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}

function StatWidget({
  widget,
  metrics,
}: {
  widget: DashboardWidget
  metrics: DashboardMetrics
}) {
  const def = metrics.metric(widget.metric)
  if (!def || !widget.metric)
    return <MissingMetric title={widget.title || "Stat"} />
  const range = widget.range ?? 7
  const current = metrics.summarize(widget.metric, range)
  const previous = metrics.summarize(widget.metric, range, range)
  const change =
    current !== null && previous !== null && previous !== 0
      ? ((current - previous) / Math.abs(previous)) * 100
      : null
  const good =
    change === null || change === 0 ? null : change > 0 === def.upIsGood
  const comparison = range === 1 ? "yesterday" : `previous ${range} days`
  return (
    <Shell
      title={widget.title || def.label}
      subtitle={`${RANGE_LABELS[range]}${def.agg === "avg" ? " · average" : ""}`}
    >
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="truncate text-3xl font-extrabold">
            {metrics.formatValue(widget.metric, current)}
            {def.unit && def.kind !== "money" && def.kind !== "hours" && (
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                {def.unit}
              </span>
            )}
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-semibold",
              good === null
                ? "text-muted-foreground"
                : good
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
            )}
          >
            {change === null || change === 0 ? (
              <Minus className="h-3.5 w-3.5" />
            ) : change > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {change === null
              ? `No data for ${comparison}`
              : `${change > 0 ? "+" : ""}${Math.round(change)}% vs ${comparison}`}
          </p>
        </div>
        <Sparkline
          points={metrics.series(widget.metric, Math.max(range, 14))}
        />
      </div>
    </Shell>
  )
}

function ChartTooltip({
  active,
  payload,
  metricId,
  metrics,
}: {
  active?: boolean
  payload?: { payload: Point }[]
  metricId: string
  metrics: DashboardMetrics
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const def = metrics.metric(metricId)
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-2.5 py-1.5 shadow-md">
      <p className="text-sm font-extrabold text-foreground tabular-nums">
        {metrics.formatValue(metricId, point.value)}
        {def?.unit && def.kind !== "money" && def.kind !== "hours"
          ? ` ${def.unit}`
          : ""}
      </p>
      <p className="text-[11px] font-normal text-muted-foreground">
        {format(parseISO(point.date), "EEE d MMM")}
      </p>
    </div>
  )
}

function ChartWidget({
  widget,
  metrics,
}: {
  widget: DashboardWidget
  metrics: DashboardMetrics
}) {
  const def = metrics.metric(widget.metric)
  if (!def || !widget.metric)
    return <MissingMetric title={widget.title || "Chart"} />
  const metricId = widget.metric
  const range = widget.range && widget.range > 1 ? widget.range : 14
  const data = metrics.series(metricId, range)
  const headline = metrics.summarize(metricId, range)
  const axisTick = { fontSize: 10, fill: "var(--muted-foreground)" }
  const yFormat = (value: number) =>
    def.kind === "money"
      ? Intl.NumberFormat(undefined, { notation: "compact" }).format(value)
      : value.toLocaleString(undefined, {
          maximumFractionDigits: 1,
          notation: value >= 10_000 ? "compact" : "standard",
        })
  const common = { data, margin: { top: 6, right: 4, bottom: 0, left: -12 } }

  return (
    <Shell
      title={widget.title || def.label}
      subtitle={`${RANGE_LABELS[range]} · ${def.agg === "avg" ? "average" : "total"} ${metrics.formatValue(metricId, headline)}`}
    >
      <div
        className="mt-3 h-40 w-full"
        role="img"
        aria-label={`${widget.title || def.label}, ${RANGE_LABELS[range].toLowerCase()}`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 320, height: 160 }}
        >
          {widget.chartStyle === "line" ? (
            <AreaChart {...common}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) =>
                  format(parseISO(date), range > 14 ? "d MMM" : "EEE")
                }
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={40}
                allowDecimals={def.kind !== "count"}
                tickFormatter={yFormat}
                domain={def.kind === "mood" ? [1, 5] : [0, "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={<ChartTooltip metricId={metricId} metrics={metrics} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.1}
                connectNulls={false}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--chart-1)",
                  stroke: "var(--card)",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart {...common} barCategoryGap={2}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) =>
                  format(parseISO(date), range > 14 ? "d MMM" : "EEE")
                }
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={40}
                allowDecimals={def.kind !== "count"}
                tickFormatter={yFormat}
                domain={def.kind === "mood" ? [0, 5] : [0, "auto"]}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={<ChartTooltip metricId={metricId} metrics={metrics} />}
              />
              <Bar
                dataKey="value"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* Table view for screen readers: every value without hovering. */}
      <table className="sr-only">
        <caption>{widget.title || def.label}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{metrics.formatValue(metricId, point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}

function MeterWidget({
  widget,
  metrics,
}: {
  widget: DashboardWidget
  metrics: DashboardMetrics
}) {
  const def = metrics.metric(widget.metric)
  if (!def || !widget.metric)
    return <MissingMetric title={widget.title || "Goal"} />
  const range = widget.range ?? 1
  const value = metrics.summarize(widget.metric, range) ?? 0
  const target = Math.max(widget.target ?? 1, 0.0001)
  const percent = Math.min(100, Math.round((value / target) * 100))
  const reached = value >= target
  return (
    <Shell
      title={widget.title || `${def.label} goal`}
      subtitle={RANGE_LABELS[range]}
    >
      <div className="mt-auto pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-extrabold">
            {metrics.formatValue(widget.metric, value)}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">
              / {metrics.formatValue(widget.metric, widget.target ?? 0)}{" "}
              {def.kind !== "money" && def.kind !== "hours" ? def.unit : ""}
            </span>
          </p>
          <span className="text-xs font-bold text-muted-foreground tabular-nums">
            {percent}%
          </span>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full"
          style={{
            background: "color-mix(in oklch, var(--chart-1) 16%, transparent)",
          }}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${percent}% of goal`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, background: "var(--chart-1)" }}
          />
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          {reached ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
              Goal reached
            </>
          ) : (
            `${metrics.formatValue(widget.metric, target - value)} to go`
          )}
        </p>
      </div>
    </Shell>
  )
}

function NoteWidget({
  widget,
  onChange,
}: {
  widget: DashboardWidget
  onChange?: (changes: Partial<DashboardWidget>) => void
}) {
  const [text, setText] = useState(widget.text ?? "")
  return (
    <Shell title={widget.title || "Note"}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text !== (widget.text ?? "") && onChange?.({ text })}
        readOnly={!onChange}
        placeholder="Write anything: a focus for the week, a quote, a reminder…"
        maxLength={1000}
        aria-label={widget.title || "Note"}
        className="mt-2 min-h-[88px] w-full flex-1 resize-none rounded-lg bg-transparent text-sm leading-relaxed font-normal outline-none placeholder:text-muted-foreground focus:bg-muted/40"
      />
    </Shell>
  )
}

function CountdownWidget({ widget }: { widget: DashboardWidget }) {
  if (!widget.date)
    return (
      <Shell
        title={widget.title || "Countdown"}
        subtitle="Pick a date in the widget settings"
      />
    )
  const days = daysUntil(parseISO(widget.date))
  return (
    <Shell
      title={widget.title || "Countdown"}
      subtitle={format(parseISO(widget.date), "EEEE, d MMMM yyyy")}
    >
      <div className="mt-auto flex items-end gap-2 pt-3">
        <Hourglass className="mb-1.5 h-5 w-5 text-muted-foreground" />
        <p className="text-4xl font-extrabold">
          {days === 0 ? "Today" : Math.abs(days)}
        </p>
        {days !== 0 && (
          <p className="pb-1 text-sm font-semibold text-muted-foreground">
            {days > 0 ? (days === 1 ? "day to go" : "days to go") : "days ago"}
          </p>
        )}
      </div>
    </Shell>
  )
}

export function WidgetCard({
  widget,
  metrics,
  onChange,
}: {
  widget: DashboardWidget
  metrics: DashboardMetrics
  onChange?: (changes: Partial<DashboardWidget>) => void
}) {
  switch (widget.type) {
    case "stat":
      return <StatWidget widget={widget} metrics={metrics} />
    case "chart":
      return <ChartWidget widget={widget} metrics={metrics} />
    case "meter":
      return <MeterWidget widget={widget} metrics={metrics} />
    case "note":
      return (
        <NoteWidget
          key={widget.text ?? ""}
          widget={widget}
          onChange={onChange}
        />
      )
    case "countdown":
      return <CountdownWidget widget={widget} />
    case "focus":
      return <FocusSessionWidget widget={widget} />
  }
}
