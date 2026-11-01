import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Bell,
  LayoutDashboard,
  MoreHorizontal,
  Settings2,
  X,
} from "lucide-react"
import { useNotifications } from "@/contexts/NotificationContext"
import { cn } from "@/lib/utils"
import type { WorkspacePage } from "@/contexts/WorkspaceContext"
import { resolveIcon, type ActiveView } from "@/lib/workspace"

interface FloatingMenuProps {
  pages: WorkspacePage[]
  activeView: string
  onNavigate: (view: ActiveView) => void
  onOpenSettings: () => void
}

export function FloatingMenu({
  pages,
  activeView,
  onNavigate,
  onOpenSettings,
}: FloatingMenuProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const items = [
    {
      label: "Dashboard",
      view: "dashboard" as ActiveView,
      icon: LayoutDashboard,
      action: () => onNavigate("dashboard"),
    },
    ...pages.map((page) => ({
      label: page.label,
      view: page.id as ActiveView,
      icon: resolveIcon(page.icon),
      action: () => onNavigate(page.id),
    })),
  ]
  const settingsItem = {
    label: "Customize",
    view: "settings" as ActiveView,
    icon: Settings2,
    action: onOpenSettings,
  }
  const { openCenter } = useNotifications()
  const notificationsItem = {
    label: "Reminders",
    view: "notifications" as ActiveView,
    icon: Bell,
    action: openCenter,
  }

  const mobilePrimary = items.slice(0, 4)
  const mobileMore = [...items.slice(4), notificationsItem, settingsItem]
  // On wider screens the dock shows this many pages; the rest go under "More".
  const DESKTOP_DOCK_PAGES = 10
  const desktopPrimary = items.slice(0, DESKTOP_DOCK_PAGES)
  const desktopMore = items.slice(DESKTOP_DOCK_PAGES)
  const moreIsActive = mobileMore.some((item) => item.view === activeView)
  const desktopMoreIsActive = desktopMore.some(
    (item) => item.view === activeView
  )

  const renderMoreGrid = (list: typeof items, className: string) => (
    <div
      className={cn(
        "kaizen-dock-more pointer-events-auto absolute right-3 bottom-[calc(100%+0.65rem)] grid w-[min(19rem,calc(100vw-1.5rem))] grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {list.map((item) => (
        <button
          key={item.view}
          type="button"
          onClick={() => navigate(item.action)}
          aria-current={activeView === item.view ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-[11px] font-semibold transition-colors",
            activeView === item.view
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-5 w-5" strokeWidth={2} />
          <span className="w-full truncate">{item.label}</span>
        </button>
      ))}
    </div>
  )

  const navigate = (action: () => void) => {
    action()
    setMoreOpen(false)
  }

  const renderIconButton = (item: (typeof items)[number], compact = false) => (
    <Button
      key={item.view}
      variant="ghost"
      size="icon"
      title={item.label}
      aria-label={item.label}
      aria-current={activeView === item.view ? "page" : undefined}
      onClick={() => navigate(item.action)}
      className={cn(
        "shrink-0 rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
        compact ? "h-11 w-11" : "h-10 w-10 sm:h-12 sm:w-12",
        "focus-visible:ring-2 focus-visible:ring-primary",
        activeView === item.view
          ? "is-active bg-foreground/10 text-foreground shadow-sm ring-1 ring-foreground/10 hover:bg-foreground/10 hover:text-foreground"
          : "text-muted-foreground"
      )}
    >
      <item.icon
        className="h-5 w-5"
        strokeWidth={activeView === item.view ? 2.5 : 1.9}
      />
    </Button>
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:pb-0">
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="pointer-events-auto fixed inset-0 z-[-1] bg-background/20"
            onClick={() => setMoreOpen(false)}
          />
          {renderMoreGrid(mobileMore, "sm:hidden")}
          {desktopMore.length > 0 &&
            renderMoreGrid(desktopMore, "hidden sm:grid sm:right-auto")}
        </>
      )}

      <div className="kaizen-dock pointer-events-auto flex w-full max-w-[min(100%,28rem)] items-center justify-around gap-1 rounded-2xl p-1.5 shadow-xl sm:hidden">
        {mobilePrimary.map((item) => renderIconButton(item, true))}
        <Button
          variant="ghost"
          size="icon"
          title="More pages"
          aria-label={moreOpen ? "Close more pages" : "More pages"}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary",
            moreOpen || moreIsActive
              ? "bg-foreground/10 text-foreground ring-1 ring-foreground/10"
              : ""
          )}
        >
          {moreOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MoreHorizontal className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="kaizen-dock pointer-events-auto hidden max-w-[calc(100vw-1.5rem)] items-end gap-1.5 rounded-2xl p-2 sm:flex sm:gap-2 sm:p-2.5">
        {desktopPrimary.map((item) => renderIconButton(item))}
        {desktopMore.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            title={`${desktopMore.length} more pages`}
            aria-label={moreOpen ? "Close more pages" : "More pages"}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "h-12 w-12 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary",
              moreOpen || desktopMoreIsActive
                ? "bg-foreground/10 text-foreground ring-1 ring-foreground/10"
                : ""
            )}
          >
            {moreOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <MoreHorizontal className="h-5 w-5" />
            )}
          </Button>
        )}
        <span
          className="mx-0.5 h-8 w-px self-center bg-border/70"
          aria-hidden
        />
        {renderIconButton(notificationsItem)}
        {renderIconButton(settingsItem)}
      </div>
    </div>
  )
}
