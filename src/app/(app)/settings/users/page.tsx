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

  const [confirmTarget, setConfirmTarget] = useState<"casual-matches" | "competitions" | null>(null)
  const { mutate: clearData, isPending: isClearing } = useMutation({
    mutationFn: (target: string) =>
      fetch(`/api/admin/data?target=${target}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed")
        return r.json()
      }),
    onSuccess: (_, target) => {
      setConfirmTarget(null)
      qc.invalidateQueries({ queryKey: ["competitions"] })
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success(target === "casual-matches" ? "Casual matches cleared" : "Competitions cleared")
    },
    onError: () => toast.error("Failed to clear data"),
  })

  // Per-item deletion
  const { data: competitionsRaw } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
    enabled: isAdmin,
  })
  const competitions: { id: string; name: string; season: string; status: string }[] =
    Array.isArray(competitionsRaw) ? competitionsRaw : []

  const { data: casualMatchesRaw } = useQuery({
    queryKey: ["casual-matches"],
    queryFn: () => fetch("/api/matches").then((r) => r.json()),
    enabled: isAdmin,
  })
  const casualMatches: { id: string; playerA: { name: string }; playerB: { name: string }; startedAt: string; completedAt: string | null }[] =
    Array.isArray(casualMatchesRaw) ? casualMatchesRaw : []

  const [selectedCompetitionId, setSelectedCompetitionId] = useState("")
  const [selectedMatchId, setSelectedMatchId] = useState("")
  const [confirmSpecific, setConfirmSpecific] = useState<{ target: "competition" | "match"; id: string; label: string } | null>(null)

  const { mutate: deleteSpecific, isPending: isDeletingSpecific } = useMutation({
    mutationFn: ({ target, id }: { target: string; id: string }) =>
      fetch(`/api/admin/data?target=${target}&id=${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed")
        return r.json()
      }),
    onSuccess: (_, { target }) => {
      setConfirmSpecific(null)
      setSelectedCompetitionId("")
      setSelectedMatchId("")
      qc.invalidateQueries({ queryKey: ["competitions"] })
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success(target === "competition" ? "Competition deleted" : "Match deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)

  function handleInviteClose(open: boolean) {
    if (!open) {
      setInviteOpen(false)
      setInviteEmail("")
      setInviteUrl(null)
      setCopied(false)
      setIsDuplicate(false)
    }
  }

  function copyInviteUrl() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { mutate: sendInvite, isPending: isSending } = useMutation({
    mutationFn: async ({ email, force }: { email: string; force?: boolean }) => {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, force }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? "Failed to create invitation")
      return data
    },
    onSuccess: (data) => {
      setIsDuplicate(false)
      if (data?.inviteUrl) setInviteUrl(data.inviteUrl)
      toast.success(`Invitation created for ${inviteEmail}`)
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("duplicate")) {
        setIsDuplicate(true)
      } else {
        toast.error(err.message || "Failed to send invitation")
      }
    },
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
                        <span className="truncate">
                          {user.player?.name ?? "Unlinked"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unlinked</SelectItem>
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

      {/* Data Management — admin only */}
      {isAdmin && (
        <div className="rounded-xl border border-destructive/40 p-5 flex flex-col gap-3">
          <div>
            <p className="font-semibold text-destructive">Data Management</p>
            <p className="text-sm text-muted-foreground mt-0.5">Permanently delete test data. These actions cannot be undone.</p>
          </div>
          {/* Bulk delete */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bulk</p>
            <button
              onClick={() => setConfirmTarget("casual-matches")}
              className="w-full py-2 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              Clear all casual matches
            </button>
            <button
              onClick={() => setConfirmTarget("competitions")}
              className="w-full py-2 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              Clear all competitions
            </button>
          </div>

          {/* Delete specific competition */}
          {competitions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Specific Competition</p>
              <div className="flex gap-2">
                <select
                  value={selectedCompetitionId}
                  onChange={(e) => setSelectedCompetitionId(e.target.value)}
                  className="flex-1 h-9 rounded-lg text-sm px-2.5 bg-muted border border-border text-foreground outline-none"
                >
                  <option value="">Select competition…</option>
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const c = competitions.find((x) => x.id === selectedCompetitionId)
                    if (c) setConfirmSpecific({ target: "competition", id: c.id, label: `${c.name} (${c.season})` })
                  }}
                  disabled={!selectedCompetitionId}
                  className="px-3 h-9 rounded-lg text-sm font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Delete specific match */}
          {casualMatches.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Specific Match</p>
              <div className="flex gap-2">
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="flex-1 h-9 rounded-lg text-sm px-2.5 bg-muted border border-border text-foreground outline-none"
                >
                  <option value="">Select match…</option>
                  {casualMatches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.playerA.name} vs {m.playerB.name} · {new Date(m.startedAt).toLocaleDateString()}
                      {m.completedAt ? "" : " (live)"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const m = casualMatches.find((x) => x.id === selectedMatchId)
                    if (m) setConfirmSpecific({ target: "match", id: m.id, label: `${m.playerA.name} vs ${m.playerB.name}` })
                  }}
                  disabled={!selectedMatchId}
                  className="px-3 h-9 rounded-lg text-sm font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmTarget === "casual-matches"
              ? "This will permanently delete all casual match history and stats."
              : "This will permanently delete all competitions, fixtures, and match history."}
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmTarget(null)} disabled={isClearing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmTarget && clearData(confirmTarget)}
              disabled={isClearing}
            >
              {isClearing ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm specific delete */}
      <Dialog open={confirmSpecific !== null} onOpenChange={(open) => { if (!open) setConfirmSpecific(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {confirmSpecific?.target === "competition" ? "competition" : "match"}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <span className="text-foreground font-medium">{confirmSpecific?.label}</span> and all associated data?
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmSpecific(null)} disabled={isDeletingSpecific}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmSpecific && deleteSpecific({ target: confirmSpecific.target, id: confirmSpecific.id })}
              disabled={isDeletingSpecific}
            >
              {isDeletingSpecific ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
      <Dialog open={inviteOpen} onOpenChange={handleInviteClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite a Player</DialogTitle>
          </DialogHeader>
          {inviteUrl ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                <p className="text-xs text-amber-400 font-semibold">They must tap this link to create their account</p>
                <p className="text-xs text-muted-foreground mt-1">Going to the app directly won't work — the link is the only way in.</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-xs break-all text-muted-foreground font-mono select-all">
                {inviteUrl}
              </div>
              <Button onClick={copyInviteUrl} className="w-full">
                {copied ? "Copied!" : "Copy Link to Send via WhatsApp"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                type="email"
                placeholder="player@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setIsDuplicate(false) }}
                onKeyDown={(e) => { if (e.key === "Enter" && inviteEmail) sendInvite({ email: inviteEmail }) }}
              />
              {isDuplicate && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 flex flex-col gap-2">
                  <p className="text-xs text-amber-400">A pending invitation already exists for this email.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendInvite({ email: inviteEmail, force: true })}
                    disabled={isSending}
                    className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  >
                    {isSending ? "Revoking & re-inviting…" : "Revoke & Re-invite"}
                  </Button>
                </div>
              )}
              {!isDuplicate && (
                <Button
                  onClick={() => sendInvite({ email: inviteEmail })}
                  disabled={isSending || !inviteEmail}
                  className="w-full"
                >
                  {isSending ? "Creating…" : "Create Invitation"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
