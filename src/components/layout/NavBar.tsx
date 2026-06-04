"use client"

import React from "react"
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
  Swords,
  Medal,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { UserButton } from "@clerk/nextjs"

const navItems: { href: string; label: string; icon: React.ElementType; exact?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/competitions", label: "Competitions", icon: Trophy },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/matches", label: "Casual", icon: Swords, exact: true },
  { href: "/tables", label: "Tables", icon: BarChart2 },
  { href: "/brackets", label: "Brackets", icon: Target },
  { href: "/practice", label: "Practice Arena", icon: Crosshair },
  { href: "/rankings", label: "Rankings", icon: Medal },
  { href: "/history", label: "Champions Wall", icon: History },
  { href: "/settings/users", label: "Settings", icon: Settings },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(5,5,5,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center h-16 gap-8">

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600"
              style={{ boxShadow: "0 0 14px rgba(220,38,38,0.6)" }}
            >
              <Crosshair className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-red-500 font-black text-lg tracking-tight uppercase">Darts</span>
              <span className="text-emerald-500 font-black text-lg tracking-tight uppercase">League</span>
            </div>
          </Link>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-150",
                    isActive
                      ? "text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-emerald-500"
                      style={{ boxShadow: "0 0 8px rgba(16,185,129,0.8)" }}
                    />
                  )}
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </div>
        </div>
      </div>

      {/* Mobile nav — scrollable row of icons */}
      <div
        className="flex md:hidden items-center gap-1 px-2 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors",
                isActive ? "text-emerald-400" : "text-zinc-600",
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </header>
  )
}
