import { Fingerprint } from "lucide-react"
import type { IdentitySummary } from "@/lib/habits"

/** "Every action is a vote for the type of person you wish to become." */
export function IdentityVotes({
  identities,
}: {
  identities: IdentitySummary[]
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Who you're becoming</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every check-in is a vote for your identity.
          </p>
        </div>
        <Fingerprint className="h-4 w-4 text-muted-foreground" />
      </div>

      {identities.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Edit a habit and fill in “I am…”, like{" "}
          <span className="font-semibold text-foreground">a reader</span> or{" "}
          <span className="font-semibold text-foreground">
            someone who moves every day
          </span>
          . Your check-ins will start counting as votes.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {identities.map((item) => {
            const pct = Math.round(item.strength * 100)
            return (
              <li key={item.identity.toLowerCase()}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold">
                    I am {item.identity}
                  </p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {item.votes} {item.votes === 1 ? "vote" : "votes"}
                  </span>
                </div>
                <div
                  role="meter"
                  aria-label={`Identity strength for ${item.identity}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                  {pct}% strength · {item.recentVotes} in the last 30 days ·{" "}
                  {item.habits.join(", ")}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
