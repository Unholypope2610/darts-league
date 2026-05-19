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
    <div className="flex flex-col h-full" style={{ background: "#050505" }}>
      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
          <Crosshair className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-black text-base tracking-widest uppercase leading-none">Darts</span>
          <span className="text-emerald-500 font-black text-base tracking-widest uppercase leading-none">League</span>
        </div>
        {/* green accent line */}
        <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-emerald-500/60 via-emerald-500/20 to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150",
                isActive
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              )}
              <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-300")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User button */}
      <div className="px-4 py-4 border-t border-white/5">
        <UserButton
          appearance={{
            elements: { avatarBox: "w-8 h-8" },
          }}
        />
      </div>
    </div>
  )
}
