"use client"

import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { MobileNav } from "./MobileNav"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 border-r border-border">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
