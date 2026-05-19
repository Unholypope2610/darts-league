"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
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
  const { data: users, isLoading } = useQuery<DbUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  })
  const { data: players } = useQuery<PlayerOption[]>({
    queryKey: ["players"],
    queryFn: () => fetch("/api/players").then((r) => r.json()),
  })

  const { mutate: updateUser } = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: string; playerId?: string | null | undefined }) =>
      fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] })
      toast.success("User updated!")
    },
    onError: () => toast.error("Failed to update user"),
  })

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
        title="Users"
        description="Manage who has access and their roles"
        actions={
          <Button onClick={() => setInviteOpen(true)} size="sm">
            Invite Player
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
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
              {users?.map((user) => (
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
                        {players?.map((p) => (
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
      )}

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
