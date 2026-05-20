"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { InstallPrompt } from "@/components/shared/InstallPrompt"

function ActiveCompetitionsBadge() {
  const { data } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
    staleTime: 60_000,
  })

  const activeCount = Array.isArray(data)
    ? data.filter((c: { status: string }) => c.status === "ACTIVE").length
    : 0

  if (activeCount === 0) return null

  return (
    <Link href="/competitions">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
        <Activity className="w-3 h-3" />
        {activeCount} Active
      </div>
    </Link>
  )
}

export function TopBar() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border shrink-0">
      <ActiveCompetitionsBadge />
      <div className="ml-auto flex items-center gap-2 relative">
        <InstallPrompt />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  )
}
