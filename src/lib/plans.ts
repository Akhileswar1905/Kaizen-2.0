import { MAX_CUSTOM_PAGES } from "@/lib/workspace"

export type PlanId = "free" | "plus" | "pro"

export type Plan = {
  id: PlanId
  name: string
  /** Custom pages allowed (matches user_plans.page_limit). */
  pageLimit: number
  /** Monthly price in rupees; 0 for free. */
  pricePerMonth: number
  tagline: string
  perks: string[]
}

// Placeholder pricing: edit freely. The database only stores the page limit.
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    pageLimit: MAX_CUSTOM_PAGES,
    pricePerMonth: 0,
    tagline: "Everything you need to start",
    perks: [
      `${MAX_CUSTOM_PAGES} custom pages`,
      "All page templates and apps",
      "Dashboard widgets and reminders",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    pageLimit: 20,
    pricePerMonth: 99,
    tagline: "Room for every area of your life",
    perks: [
      "20 custom pages",
      "Everything in Free",
      "Support Kaizen's development",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    pageLimit: 50,
    pricePerMonth: 199,
    tagline: "For people who track everything",
    perks: ["50 custom pages", "Everything in Plus", "Early access to new apps"],
  },
]

/** False until a payment provider is wired up. */
export const PAYMENTS_ENABLED = false

export const planById = (id: string | null | undefined) =>
  PLANS.find((plan) => plan.id === id) ?? PLANS[0]
