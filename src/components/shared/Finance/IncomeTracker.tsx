import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { format, parseISO } from "date-fns"
import { Plus, Trash2, Wallet, Loader2, CalendarDays } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

const SOURCES = ["Salary", "Freelance", "Business", "Investment", "Gift", "Allowance", "Other"]

export function IncomeTracker() {
  const { user } = useAuth()
  const { formatMoney, currencySymbol } = useWorkspace()
  const [items, setItems] = useState<any[]>([])
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Salary")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const load = async () => {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "income")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      setErrorMessage(error.message.includes("type") || error.code === "42703" || error.code === "PGRST204"
        ? "Income tracking needs a database update. Run supabase/income_tracking.sql in your Supabase SQL Editor, then reload this page."
        : "Could not load income: " + error.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [user?.id])

  const addIncome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    const parsedAmount = Number(amount)
    if (!user?.id) { setErrorMessage("Please sign in again before adding income."); return }
    if (!title.trim()) { setErrorMessage("Enter a description for this income."); return }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setErrorMessage("Enter an amount greater than zero."); return }

    setSaving(true)
    try {
      const { data, error } = await supabase.from("expenses").insert({
        user_id: user.id, title: title.trim(), amount: parsedAmount, category, type: "income", date,
      }).select().single()
      if (error) {
        if (error.message.includes("type") || error.code === "42703" || error.code === "PGRST204") {
          throw new Error("Income tracking needs a database update. Run supabase/income_tracking.sql in your Supabase SQL Editor, then reload this page.")
        }
        throw new Error(error.message)
      }
      if (data) {
        setItems((current) => [data, ...current])
        setTitle("")
        setAmount("")
        setDate(format(new Date(), "yyyy-MM-dd"))
        setSuccessMessage("Income saved successfully.")
      }
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not save income. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const removeIncome = async (id: string) => {
    setErrorMessage(null)
    const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user?.id).eq("type", "income")
    if (error) { setErrorMessage("Could not delete this income entry: " + error.message); return }
    setItems((current) => current.filter((item) => item.id !== id))
  }
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const thisMonth = items.filter((item) => item.date && item.date.slice(0, 7) === format(new Date(), "yyyy-MM")).reduce((sum, item) => sum + Number(item.amount), 0)

  return <div className="mx-auto w-full max-w-[1440px] space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="border-border/60 bg-card"><CardContent className="p-5"><p className="text-xs font-bold tracking-wider text-muted-foreground">TOTAL RECORDED INCOME</p><p className="mt-3 text-3xl font-extrabold tabular-nums">{formatMoney(total)}</p><p className="mt-1 text-xs text-muted-foreground">{items.length} income entries</p></CardContent></Card>
      <Card className="border-border/60 bg-card"><CardContent className="p-5"><p className="text-xs font-bold tracking-wider text-muted-foreground">THIS MONTH</p><p className="mt-3 text-3xl font-extrabold tabular-nums">{formatMoney(thisMonth)}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p></CardContent></Card>
    </div>
    <Card className="border-border/60 bg-card"><CardContent className="p-5 sm:p-6">
      <div className="mb-5"><h2 className="text-lg font-extrabold">Add income</h2><p className="text-sm text-muted-foreground">Record salary, freelance payments or other money received.</p></div>
      {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">{errorMessage}</div>}
      {successMessage && <div role="status" className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-foreground">{successMessage}</div>}
      <form onSubmit={addIncome} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2"><label className="text-xs font-semibold text-muted-foreground">Source / Description</label><Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g. Monthly salary" required /></div>
        <div className="space-y-2"><label className="text-xs font-semibold text-muted-foreground">Amount ({currencySymbol})</label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" required /></div>
        <div className="space-y-2"><label className="text-xs font-semibold text-muted-foreground">Income category</label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map((source)=><SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><label className="text-xs font-semibold text-muted-foreground">Received on</label><Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} required /></div>
        <Button type="submit" disabled={saving} className="font-bold sm:col-span-2 xl:col-span-4">{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Plus className="mr-2 h-4 w-4"/>}Add income</Button>
      </form>
    </CardContent></Card>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Income history</h2><span className="text-xs text-muted-foreground">{items.length} records</span></div>
      {loading ? <div className="rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">Loading income…</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Wallet className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="font-semibold">No income recorded yet</p><p className="mt-1 text-sm text-muted-foreground">Add your first income entry above.</p></div> : <div className="space-y-2">{items.map((item)=><div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Wallet className="h-4 w-4"/></div><div className="min-w-0"><p className="truncate font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{item.category} · <CalendarDays className="inline h-3 w-3"/> {format(parseISO(item.date), "MMM d, yyyy")}</p></div></div><div className="flex shrink-0 items-center gap-3"><span className="font-mono font-bold">+{formatMoney(Number(item.amount))}</span><Button type="button" variant="ghost" size="icon" onClick={()=>removeIncome(item.id)} aria-label="Delete income"><Trash2 className="h-4 w-4 text-muted-foreground"/></Button></div></div>)}</div>}
    </section>
  </div>
}
