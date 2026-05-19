"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  BarChart2,
  Target,
  History,
  Settings,
  Crosshair,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { UserButton } from "@clerk/nextjs"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/competitions", label: "Competitions", icon: Trophy },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/tables", label: "Tables", icon: BarChart2 },
  { href: "/brackets", label: "Brackets", icon: Target },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar-background))]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <Crosshair className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight">Darts League</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User button */}
      <div className="px-4 py-4 border-t border-[hsl(var(--sidebar-border))]">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </div>
  )
}
