import { useState } from "react"
import { Check, Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PAYMENTS_ENABLED, PLANS, type Plan, type PlanId } from "@/lib/plans"

interface UpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan
  pageCount: number
  pageLimit: number
}

const price = (plan: Plan) => `₹${plan.pricePerMonth.toLocaleString("en-IN")}`

export function UpgradeDialog({
  open,
  onOpenChange,
  plan,
  pageCount,
  pageLimit,
}: UpgradeDialogProps) {
  const upgrades = PLANS.filter((option) => option.pageLimit > pageLimit)
  const [selected, setSelected] = useState<PlanId | null>(null)
  const chosen =
    upgrades.find((option) => option.id === selected) ?? upgrades[0] ?? null
  const usedPct = pageLimit ? Math.min(100, (pageCount / pageLimit) * 100) : 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Get more pages
          </DialogTitle>
          <DialogDescription>
            You're on the {plan.name} plan. Upgrade to keep adding pages for
            every part of your life.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Custom pages</span>
            <span className="tabular-nums text-muted-foreground">
              {pageCount} of {pageLimit} used
            </span>
          </div>
          <div
            role="meter"
            aria-label="Custom pages used"
            aria-valuemin={0}
            aria-valuemax={pageLimit}
            aria-valuenow={pageCount}
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-foreground/80"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Plans"
          className="grid gap-3 sm:grid-cols-3"
        >
          {PLANS.map((option) => {
            const isCurrent = option.id === plan.id
            const isUpgrade = option.pageLimit > pageLimit
            const isChosen = chosen?.id === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={!isUpgrade}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "flex flex-col rounded-xl border p-4 text-left transition-colors",
                  isChosen
                    ? "border-foreground bg-card ring-1 ring-foreground"
                    : "border-border/70 bg-card hover:border-foreground/40",
                  !isUpgrade && "cursor-default opacity-70 hover:border-border/70"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{option.name}</span>
                  {isCurrent && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {price(option)}
                  </span>
                  {option.pricePerMonth > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / month
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {option.tagline}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {option.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          {chosen ? (
            <Button disabled={!PAYMENTS_ENABLED} className="w-full gap-2">
              {PAYMENTS_ENABLED ? (
                `Upgrade to ${chosen.name} · ${price(chosen)}/month`
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Upgrade to {chosen.name} ·
                  coming soon
                </>
              )}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              You're already on the biggest plan.
            </p>
          )}
          {!PAYMENTS_ENABLED && chosen && (
            <p className="text-center text-xs text-muted-foreground">
              Payments aren't open yet. Until then, delete or merge a page to
              make room.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
