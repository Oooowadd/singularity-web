"use client"

import { motion } from "framer-motion"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

interface Metric {
  label: string
  value: string
  change: string
  trend: "up" | "down"
}

const metrics: Metric[] = [
  { label: "Revenue", value: "$48.2K", change: "+12.5%", trend: "up" },
  { label: "Users", value: "2,847", change: "+8.2%", trend: "up" },
  { label: "Conversion", value: "3.6%", change: "-0.4%", trend: "down" },
  { label: "MRR", value: "$12.4K", change: "+18.3%", trend: "up" },
]

export default function DashboardOverview() {
  return (
    <section className="mx-auto w-full max-w-4xl p-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium text-sm">Overview</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Key performance indicators for this period
          </p>
        </div>
        <div className="grid grid-cols-2">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.08,
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className={`px-4 py-4 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "border-r" : ""}`}
            >
              <p className="text-muted-foreground text-xs">{metric.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-semibold text-2xl tabular-nums">{metric.value}</span>
                <span
                  className={`flex items-center gap-0.5 text-xs ${
                    metric.trend === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {metric.trend === "up" ? (
                    <TrendingUpIcon className="size-3" />
                  ) : (
                    <TrendingDownIcon className="size-3" />
                  )}
                  {metric.change}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
