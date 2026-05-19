"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Trophy, Calendar } from "lucide-react"
import { cn } from "@/lib/utils/cn"

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/competitions", label: "Leagues", icon: Trophy },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-background z-50">
      <div className="flex">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
