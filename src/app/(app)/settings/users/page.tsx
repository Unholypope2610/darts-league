"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DbUser {
  id: string
  email: string
  role: string
  playerId: string | null
  player: { id: string; name: string } | null
}

interface PlayerOption {
  id: string
  name: string
}

export default function UsersSettingsPage() {
  const qc = useQueryClient()

  const { data: meData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const isAdmin = meData?.role === "ADMIN"

  const { data: usersRaw, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
    enabled: isAdmin,
  })
  const users: DbUser[] = Array.isArray(usersRaw) ? usersRaw : []

  const { data: playersRaw } = useQuery({
    queryKey: ["players"],
    queryFn: () => fetch("/api/players").then((r) => r.json()),
  })
  const players: PlayerOption[] = Array.isArray(playersRaw) ? playersRaw : []

  const { mutate: updateUser } = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: string; playerId?: string | null }) =>
      fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: id, ...data }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] })
      toast.success("User updated!")
    },
    onError: () => toast.error("Failed to update user"),
  })

  const [installEvent, setInstallEvent] = useState<null | { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) { setInstalled(true); return }
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const handler = (e: Event) => { e.preventDefault(); setInstallEvent(e as never) }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleInstall() {
    if (installEvent) {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === "accepted") setInstalled(true)
      setInstallEvent(null)
    }
  }

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const { mutate: sendInvite, isPending: isSending } = useMutation({
    mutationFn: (email: string) =>
      fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then((r) => r.json()),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}!`)
      setInviteEmail("")
      setInviteOpen(false)
    },
    onError: () => toast.error("Failed to send invitation"),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage users and app preferences"
        actions={
          isAdmin ? (
            <Button onClick={() => setInviteOpen(true)} size="sm">
              Invite Player
            </Button>
          ) : undefined
        }
      />

      {/* Users table — only shown if admin */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : isAdmin ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Linked Player</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(role) => { if (role) updateUser({ id: user.id, role }) }}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="PLAYER">Player</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.playerId ?? "none"}
                      onValueChange={(val) => updateUser({ id: user.id, playerId: val === "none" ? null : val })}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue placeholder="Unlinked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unlinked</SelectItem>
                        {/* Include current player even if players list hasn't loaded */}
                        {user.player && !players.find((p) => p.id === user.player!.id) && (
                          <SelectItem value={user.player.id}>{user.player.name}</SelectItem>
                        )}
                        {players.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Install App */}
      <div className="rounded-xl border border-border p-5 flex flex-col gap-3">
        <div>
          <p className="font-semibold">Install App</p>
          <p className="text-sm text-muted-foreground mt-0.5">Add Darts League to your home screen for a full-screen experience.</p>
        </div>
        {installed ? (
          <p className="text-sm text-emerald-400">Already installed</p>
        ) : installEvent ? (
          <Button onClick={handleInstall} className="w-fit gap-2">
            <Download className="w-4 h-4" />
            Install App
          </Button>
        ) : isIOS ? (
          <p className="text-sm text-muted-foreground">On iPhone: tap the <strong className="text-foreground">Share</strong> button in Safari → <strong className="text-foreground">"Add to Home Screen"</strong></p>
        ) : (
          <p className="text-sm text-muted-foreground">In Chrome: click the <strong className="text-foreground">install icon (⊕)</strong> in the address bar, or open the browser menu → <strong className="text-foreground">"Install Darts League"</strong></p>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !o && setInviteOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite a Player</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="player@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button
              onClick={() => sendInvite(inviteEmail)}
              disabled={isSending || !inviteEmail}
              className="w-full"
            >
              {isSending ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
