import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  Loader2,
  Trash2,
  PieChart as PieChartIcon,
  Coffee,
  Car,
  ShoppingBag,
  Zap,
  Film,
  Tag,
  TrendingUp,
  Activity,
  Calendar,
  ChevronRight,
  BarChart3,
  Wallet,
  Target,
  AlertCircle,
} from "lucide-react"
import { format, subDays, startOfMonth, parseISO, isSameMonth } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGamification } from "@/contexts/GamificationContext"

// Recharts primitives
import {
  PieChart,
  Pie,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

// Shadcn Chart Components
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const CATEGORIES = [
  "General",
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
]

const chartConfig = {
  amount: { label: "Amount", color: "hsl(var(--chart-1))" },
  general: { label: "General", color: "hsl(var(--chart-1))" },
  food: { label: "Food", color: "hsl(var(--chart-2))" },
  transport: { label: "Transport", color: "hsl(var(--chart-3))" },
  shopping: { label: "Shopping", color: "hsl(var(--chart-4))" },
  bills: { label: "Bills", color: "hsl(var(--chart-5))" },
  entertainment: { label: "Entertainment", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

const getCategoryIcon = (category: string, className: string = "h-4 w-4") => {
  switch (category) {
    case "Food":
      return <Coffee className={className} />
    case "Transport":
      return <Car className={className} />
    case "Shopping":
      return <ShoppingBag className={className} />
    case "Bills":
      return <Zap className={className} />
    case "Entertainment":
      return <Film className={className} />
    default:
      return <Tag className={className} />
  }
}

export function ExpenseTracker() {
  const { user } = useAuth()
  const { formatMoney, currencySymbol } = useWorkspace()
  const { triggerGamificationEvent, subtractGamificationPoints } =
    useGamification()

  // Data State
  const [expenses, setExpenses] = useState<any[]>([])
  const [limits, setLimits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form States
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingLimit, setIsSubmittingLimit] = useState(false)

  // Expense Form
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("General")
  const [date, setDate] = useState<Date>(new Date())

  // Limit Form
  const [limitCategory, setLimitCategory] = useState("General")
  const [limitAmount, setLimitAmount] = useState("")

  useEffect(() => {
    if (user) {
      fetchExpenses()
      fetchLimits()
    }
  }, [user])

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("type", "expense")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })

    if (!error && data) setExpenses(data)
    setLoading(false)
  }

  const fetchLimits = async () => {
    const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd")
    const { data, error } = await supabase
      .from("expense_limits")
      .select("*")
      .eq("month_start", currentMonthStart)

    if (!error && data) setLimits(data)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount) return
    setIsSubmitting(true)

    const newExpense = {
      user_id: user?.id,
      title,
      amount: parseFloat(amount),
      category,
      type: "expense",
      date: format(date, "yyyy-MM-dd"),
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert(newExpense)
      .select()
      .single()

    if (!error && data) {
      setExpenses([data, ...expenses])
      setTitle("")
      setAmount("")
      setDate(new Date())
      await triggerGamificationEvent({ type: "FINANCE_LOGGED", amount: 1 })
    }
    setIsSubmitting(false)
  }

  const handleSetLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!limitAmount) return
    setIsSubmittingLimit(true)

    const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd")
    const parsedAmount = parseFloat(limitAmount)

    // Check if limit already exists for this category this month
    const existingLimit = limits.find(
      (l) => l.category === limitCategory && l.month_start === currentMonthStart
    )

    if (existingLimit) {
      const { data, error } = await supabase
        .from("expense_limits")
        .update({ limit_amount: parsedAmount })
        .eq("id", existingLimit.id)
        .select()
        .single()

      if (!error && data) {
        setLimits(limits.map((l) => (l.id === data.id ? data : l)))
      }
    } else {
      const { data, error } = await supabase
        .from("expense_limits")
        .insert({
          user_id: user?.id,
          category: limitCategory,
          month_start: currentMonthStart,
          limit_amount: parsedAmount,
        })
        .select()
        .single()

      if (!error && data) {
        setLimits([...limits, data])
      }
    }

    setLimitAmount("")
    setIsSubmittingLimit(false)
  }

  const handleDelete = async (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id))
    await supabase.from("expenses").delete().match({ id })
    await subtractGamificationPoints({ type: "FINANCE_LOGGED", amount: 1 })
  }

  // --- ANALYTICS COMPUTATIONS ---

  // 1. KPI Totals
  const totalSpent = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount), 0),
    [expenses]
  )

  const highestCategory = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.forEach((exp) => {
      totals[exp.category] = (totals[exp.category] || 0) + Number(exp.amount)
    })
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
    return sorted.length > 0
      ? { name: sorted[0][0], amount: sorted[0][1] }
      : null
  }, [expenses])

  // 2. Budget & Limits Analysis (Current Month)
  const budgetAnalysis = useMemo(() => {
    const currentMonthStart = startOfMonth(new Date())
    const currentMonthExpenses = expenses.filter((exp) =>
      isSameMonth(parseISO(exp.date), currentMonthStart)
    )

    const spentByCategory: Record<string, number> = {}
    currentMonthExpenses.forEach((exp) => {
      spentByCategory[exp.category] =
        (spentByCategory[exp.category] || 0) + Number(exp.amount)
    })

    return limits
      .map((limit) => {
        const spent = spentByCategory[limit.category] || 0
        const percentage = Math.min((spent / limit.limit_amount) * 100, 100)
        const remaining = limit.limit_amount - spent
        let statusColor = "bg-emerald-500"
        if (percentage > 85) statusColor = "bg-destructive"
        else if (percentage > 65) statusColor = "bg-amber-500"

        return {
          category: limit.category,
          limit: limit.limit_amount,
          spent,
          remaining,
          percentage,
          statusColor,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)
  }, [expenses, limits])

  // 3. Category Distribution (Donut)
  const categoryAnalytics = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.forEach((exp) => {
      totals[exp.category] = (totals[exp.category] || 0) + Number(exp.amount)
    })
    return Object.entries(totals)
      .map(([name, amount]) => ({
        category: name,
        value: amount,
        fill: `var(--chart-${CATEGORIES.indexOf(name) + 1})`,
      }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  // 4. Daily Trend
  const dailyTrend = useMemo(() => {
    const days = Array.from({ length: 7 })
      .map((_, i) => format(subDays(new Date(), i), "MMM dd"))
      .reverse()
    const trendData = days.map((day) => ({ name: day, amount: 0 }))
    expenses.forEach((exp) => {
      const expDate = format(parseISO(exp.date), "MMM dd")
      const dayIndex = trendData.findIndex((d) => d.name === expDate)
      if (dayIndex !== -1) trendData[dayIndex].amount += Number(exp.amount)
    })
    return trendData
  }, [expenses])

  // 5. Monthly Distribution
  const monthlyDistribution = useMemo(() => {
    const monthsData: Record<string, number> = {}
    expenses.forEach((exp) => {
      const monthKey = format(parseISO(exp.date), "MMM yyyy")
      monthsData[monthKey] = (monthsData[monthKey] || 0) + Number(exp.amount)
    })
    // Convert to array and take last 6 months chronologically
    return Object.entries(monthsData)
      .map(([name, amount]) => ({ name, amount }))
      .reverse()
      .slice(-6)
  }, [expenses])

  // --- RENDER ---
  if (loading)
    return (
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-6 p-6">
        <div className="h-32 rounded-2xl bg-muted/20" />
        <div className="flex gap-6">
          <div className="h-64 flex-1 rounded-2xl bg-muted/10" />
          <div className="h-64 flex-1 rounded-2xl bg-muted/10" />
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl animate-in space-y-8 p-2 duration-700 fade-in sm:p-6">
      {/* 1. KPI Stats Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Net Outflow
              </p>
              <Wallet className="h-4 w-4 text-primary opacity-50" />
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-xl font-light text-muted-foreground">
                {currencySymbol}
              </span>
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {totalSpent.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Total Logs
              </p>
              <Activity className="h-4 w-4 text-primary opacity-50" />
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {expenses.length}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Transactions
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Highest Drain
              </p>
              <TrendingUp className="h-4 w-4 text-destructive opacity-50" />
            </div>
            <div className="mt-4 flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-foreground">
                {highestCategory?.name || "N/A"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {formatMoney(highestCategory?.amount || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Monthly Budget Tracking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="border-border/50 bg-card/20 lg:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <Target className="h-4 w-4" /> Current Month Budget Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {budgetAnalysis.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                No limits configured for {format(new Date(), "MMMM")}.
              </div>
            ) : (
              <div className="grid gap-5">
                {budgetAnalysis.map((budget) => (
                  <div key={budget.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        {getCategoryIcon(
                          budget.category,
                          "h-4 w-4 text-muted-foreground"
                        )}
                        {budget.category}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {formatMoney(budget.spent)}
                        </span>
                        <span className="text-muted-foreground">
                          / {formatMoney(budget.limit)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          budget.statusColor
                        )}
                        style={{ width: `${budget.percentage}%` }}
                      />
                    </div>
                    {budget.remaining < 0 && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <AlertCircle className="h-3 w-3" /> Over budget by{" "}
                        {formatMoney(Math.abs(budget.remaining))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/20 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Set Category Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetLimit} className="space-y-4">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                  Category
                </label>
                <Select value={limitCategory} onValueChange={setLimitCategory}>
                  <SelectTrigger className="bg-background/50 focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                  Limit Amount ({currencySymbol})
                </label>
                <Input
                  type="number"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="bg-background/50 font-mono focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>
              <Button
                disabled={isSubmittingLimit}
                type="submit"
                variant="secondary"
                className="w-full font-bold"
              >
                {isSubmittingLimit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Limit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 3. Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Distribution Chart */}
        <Card className="flex flex-col border-border/50 bg-card/20 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <BarChart3 className="h-4 w-4" /> Monthly Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-[250px] flex-1 p-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                data={monthlyDistribution}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--muted))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="amount"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 7-Day Trend Area Chart */}
        <Card className="flex flex-col border-border/50 bg-card/20 lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <TrendingUp className="h-4 w-4" /> 7-Day Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-[250px] flex-1 p-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart
                data={dailyTrend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--chart-1)"
                  fillOpacity={1}
                  fill="url(#fillAmount)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Category Donut Chart */}
        <Card className="flex flex-col border-border/50 bg-card/20 lg:col-span-3">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <PieChartIcon className="h-4 w-4" /> Split
            </CardTitle>
          </CardHeader>
          <CardContent className="relative flex min-h-[250px] flex-1 items-center justify-center">
            {categoryAnalytics.length > 0 ? (
              <>
                <ChartContainer
                  config={chartConfig}
                  className="h-[250px] w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={categoryAnalytics}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      stroke="none"
                    />
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Total
                  </span>
                  <span className="text-lg font-black">
                    {currencySymbol}
                    {totalSpent > 999
                      ? (totalSpent / 1000).toFixed(1) + "k"
                      : totalSpent}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data to display.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Input Form */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <form
            onSubmit={handleAddExpense}
            className="grid grid-cols-1 items-end gap-4 sm:grid-cols-12"
          >
            <div className="space-y-2 sm:col-span-4">
              <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                Detail
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Terminal access, supplies, etc."
                className="border-border/50 bg-background/50 shadow-inner focus-visible:ring-1 focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                Amount
              </label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="border-border/50 bg-background/50 font-mono shadow-inner focus-visible:ring-1 focus-visible:ring-primary"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
              <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-border/50 bg-background/50 shadow-inner focus:ring-1 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-3">
              <label className="ml-1 text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start border-border/50 bg-background/50 text-left font-normal shadow-inner hover:bg-background/80 hover:text-foreground",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto border-border/50 p-0">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              disabled={isSubmitting}
              type="submit"
              className="mt-2 w-full font-bold tracking-wide transition-all hover:opacity-90 sm:col-span-12"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add Expense"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 5. Ledger List */}
      <div className="space-y-4 pt-4">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
          <ChevronRight className="h-3 w-3" /> Recent Transactions
        </h3>
        <div className="grid gap-3">
          {expenses.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/50 py-8 text-center text-sm text-muted-foreground">
              No transactions found. Begin tracking.
            </div>
          )}
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="group flex items-center justify-between rounded-xl border border-border/20 bg-card/40 p-4 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card/60"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {getCategoryIcon(expense.category, "h-4 w-4")}
                </div>
                <div>
                  <p className="font-bold tracking-tight text-foreground">
                    {expense.title}
                  </p>
                  <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    {expense.category} •{" "}
                    {format(parseISO(expense.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-base font-black text-foreground">
                  -{formatMoney(expense.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(expense.id)}
                  className="h-8 w-8 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
