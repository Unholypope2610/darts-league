"use client"

import { useEffect } from "react"
import { NavBar } from "./NavBar"

export function AppShell({ children }: { children: React.ReactNode }) {
  // Ensure every authenticated user has a DB record on first load
  useEffect(() => {
    fetch("/api/auth/sync", { method: "POST" }).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#080808" }}>
      <NavBar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
