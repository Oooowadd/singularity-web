"use client"

import { motion } from "framer-motion"

type ActionType = "created" | "updated" | "deleted" | "deployed" | "commented"

interface Activity {
  id: string
  user: string
  initials: string
  action: ActionType
  resource: string
  target: string
  time: string
}

const activities: Activity[] = [
  {
    id: "1",
    user: "Sarah Chen",
    initials: "SC",
    action: "deployed",
    resource: "Production",
    target: "v2.4.1",
    time: "2 min ago",
  },
  {
    id: "2",
    user: "James Miller",
    initials: "JM",
    action: "created",
    resource: "Issue",
    target: "Fix header alignment on mobile",
    time: "8 min ago",
  },
  {
    id: "3",
    user: "Emily Zhang",
    initials: "EZ",
    action: "commented",
    resource: "PR #142",
    target: "Refactor auth middleware",
    time: "15 min ago",
  },
  {
    id: "4",
    user: "Michael Torres",
    initials: "MT",
    action: "updated",
    resource: "Dashboard",
    target: "Analytics widget layout",
    time: "32 min ago",
  },
  {
    id: "5",
    user: "Aisha Patel",
    initials: "AP",
    action: "deleted",
    resource: "Branch",
    target: "feature/old-sidebar",
    time: "1 hr ago",
  },
  {
    id: "6",
    user: "David Kim",
    initials: "DK",
    action: "created",
    resource: "Project",
    target: "Mobile App Redesign",
    time: "1 hr ago",
  },
  {
    id: "7",
    user: "Laura Jensen",
    initials: "LJ",
    action: "deployed",
    resource: "Staging",
    target: "v2.5.0-beta.3",
    time: "2 hr ago",
  },
  {
    id: "8",
    user: "Carlos Rivera",
    initials: "CR",
    action: "commented",
    resource: "Issue #89",
    target: "Database migration failing",
    time: "3 hr ago",
  },
  {
    id: "9",
    user: "Priya Sharma",
    initials: "PS",
    action: "updated",
    resource: "Docs",
    target: "API reference v2",
    time: "4 hr ago",
  },
  {
    id: "10",
    user: "Tom Wilson",
    initials: "TW",
    action: "created",
    resource: "Milestone",
    target: "Q2 Launch",
    time: "5 hr ago",
  },
]

const actionLabels: Record<ActionType, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  deployed: "deployed",
  commented: "commented on",
}

const actionDots: Record<ActionType, string> = {
  created: "bg-emerald-500",
  updated: "bg-blue-500",
  deleted: "bg-red-500",
  deployed: "bg-amber-500",
  commented: "bg-foreground/40",
}

export default function DashboardActivityFeed() {
  return (
    <section className="mx-auto w-full max-w-2xl p-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm">Activity</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Recent actions across your workspace
          </p>
        </div>
        <div className="relative">
          <div className="absolute top-0 bottom-0 left-[2.05rem] w-px bg-border" />
          {activities.map((activity, index) => {
            const isLast = index === activities.length - 1
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.06,
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className={`relative flex items-start gap-3 px-4 py-3 ${isLast ? "" : "border-b"}`}
              >
                <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {activity.initials}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span>
                    <span className="text-muted-foreground"> {actionLabels[activity.action]} </span>
                    <span className="font-medium">{activity.resource}</span>
                  </p>
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">{activity.target}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-1">
                  <span className={`size-1.5 rounded-full ${actionDots[activity.action]}`} />
                  <span className="text-muted-foreground text-xs">{activity.time}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
