import { Wallet, BookOpen, TrendingUp } from "lucide-react"
import { IncomeTracker } from "../Finance/IncomeTracker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseTracker } from "../Finance/ExpenseTracker"
import { VarsityTracker } from "../Finance/FinanceCourse"

export function FinanceView({ initialTab = "expenses" }: { initialTab?: "income" | "expenses" | "courses" }) {
  return (
    <div className="min-h-screen w-full bg-background px-3 py-5 font-sans text-foreground antialiased sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border/60 pb-5">
          <div className="kaizen-page-heading-icon"><Wallet /></div>
          <div><h1 className="kaizen-page-heading-title">Finance</h1><p className="kaizen-page-heading-description">Manage income, expenses and your monthly budget</p></div>
        </header>

        {/* Tabs for switching between Expenses and Courses */}
        <Tabs key={initialTab} defaultValue={initialTab} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-3">
            <TabsTrigger value="income" className="flex gap-2"><TrendingUp className="h-4 w-4" /> Income</TabsTrigger>
            <TabsTrigger value="expenses" className="flex gap-2">
              <Wallet className="h-4 w-4" /> Expenses
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex gap-2">
              <BookOpen className="h-4 w-4" /> Varsity Course
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="mt-0"><IncomeTracker /></TabsContent>

          <TabsContent value="expenses" className="mt-0">
            <ExpenseTracker />
          </TabsContent>

          <TabsContent value="courses" className="mt-0">
            <VarsityTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
