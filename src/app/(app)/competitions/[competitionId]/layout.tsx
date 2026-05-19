"use client"

import { use } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCompetition } from "@/hooks/useCompetitions"
import { cn } from "@/lib/utils/cn"

const TABS = [
  { label: "Overview", path: "" },
  { label: "Fixtures", path: "/fixtures" },
  { label: "Table", path: "/table" },
  { label: "Bracket", path: "/bracket" },
  { label: "Settings", path: "/settings" },
]

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ competitionId: string }>
}

export default function CompetitionLayout({ children, params }: LayoutProps) {
  const { competitionId } = use(params)
  const { data: competition } = useCompetition(competitionId)
  const pathname = usePathname()
  const base = `/competitions/${competitionId}`

  return (
    <div className="flex flex-col gap-6">
      {/* Competition header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/competitions" className="hover:text-foreground transition-colors">Competitions</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{competition?.name ?? "…"}</span>
        </div>
        {competition && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            competition.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" :
            competition.status === "DRAFT" ? "bg-amber-500/10 text-amber-400" :
            "bg-muted text-muted-foreground"
          }`}>{competition.status}</span>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const href = base + tab.path
          const isActive = tab.path === "" ? pathname === base : pathname.startsWith(href)
          return (
            <Link
              key={tab.path}
              href={href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
