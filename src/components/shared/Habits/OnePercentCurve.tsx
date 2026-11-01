import { format, parseISO } from "date-fns"
import { TrendingUp } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import type { CurvePoint } from "@/lib/habits"

const times = (value: number) =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 2 : 1,
    maximumFractionDigits: value < 10 ? 2 : 1,
  })}×`

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: CurvePoint }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-2.5 py-1.5 shadow-md">
      <p className="text-sm font-extrabold text-foreground tabular-nums">
        {times(point.value)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {format(parseISO(point.date), "EEE d MMM")}
      </p>
    </div>
  )
}

/** Kaizen's 1% rule, drawn from your own check-ins. */
export function OnePercentCurve({ points }: { points: CurvePoint[] }) {
  const last = points.at(-1)
  const previous = points.at(-2)
  const value = last?.value ?? 1
  const change = (value - 1) * 100
  // Where today's daily rate leads if it holds for a year.
  const dailyFactor = last && previous ? last.value / previous.value : 1
  const yearOut = dailyFactor ** 365
  const axisTick = { fontSize: 10, fill: "var(--muted-foreground)" }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">The 1% curve</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A good week makes you 1% better each day. A bad one costs 1%.
          </p>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>

      {points.length < 2 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Add a habit and check in to start your curve.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="text-5xl font-bold tracking-tighter tabular-nums">
              {times(value)}
            </span>
            <span
              className={cn(
                "mb-1.5 text-sm font-semibold",
                change >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {change >= 0 ? "+" : "−"}
              {Math.abs(change).toFixed(1)}% since{" "}
              {format(parseISO(points[1].date), "d MMM")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            At today's pace, a year from now you'd be at{" "}
            <span className="font-semibold text-foreground">
              {times(yearOut)}
            </span>
            .
          </p>

          <div className="mt-4 h-44">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 480, height: 176 }}
            >
              <AreaChart
                data={points}
                margin={{ top: 6, right: 4, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date: string) =>
                    format(parseISO(date), "d MMM")
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  width={44}
                  domain={[
                    (min: number) => Math.min(0.98, min - 0.01),
                    (max: number) => Math.max(1.02, max + 0.01),
                  ]}
                  tickFormatter={(tick: number) => `${tick.toFixed(2)}×`}
                />
                <ReferenceLine
                  y={1}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Start",
                    position: "insideBottomRight",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={<CurveTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="var(--chart-1)"
                  fillOpacity={0.1}
                  baseValue={1}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{
                    r: 4,
                    fill: "var(--chart-1)",
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Your 1% curve by day</caption>
            <tbody>
              {points.slice(1).map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  <td>{times(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
