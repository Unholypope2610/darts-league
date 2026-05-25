"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Shuffle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { prewarmSpeech } from "@/lib/utils/speech"

interface ChallengeModalProps {
  open: boolean
  opponent: { id: string; name: string; avatarUrl: string | null }
  myPlayerId: string | null
  onClose: () => void
}

export function ChallengeModal({ open, opponent, myPlayerId, onClose }: ChallengeModalProps) {
  const router = useRouter()
  const [starterIsMe, setStarterIsMe] = useState(true)
  const [bestOf, setBestOf] = useState(7)
  const [startingScore, setStartingScore] = useState(501)
  const [finishType, setFinishType] = useState("DOUBLE_OUT")
  const [isLocal, setIsLocal] = useState(false)

  const startingPlayerId = starterIsMe ? myPlayerId : opponent.id

  const { mutate: sendChallenge, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAId: myPlayerId,
          playerBId: opponent.id,
          bestOf,
          startingScore,
          finishType,
          startingPlayerId,
          isLocal,
        }),
      }).then((r) => r.json()),
    onSuccess: (match) => {
      toast.success("Challenge sent!")
      onClose()
      router.push(`/matches/${match.id}/live`)
    },
    onError: () => toast.error("Failed to create match"),
  })

  const canChallenge = !!myPlayerId && !!opponent.id

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white font-black text-lg">Challenge</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Opponent display */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
            <PlayerAvatar name={opponent.name} avatarUrl={opponent.avatarUrl} size="sm" />
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Challenging</p>
              <p className="text-sm font-bold text-white">{opponent.name}</p>
            </div>
          </div>

          {/* Who starts */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Who Starts?</label>
              <button
                type="button"
                onClick={() => setStarterIsMe(Math.random() < 0.5)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <Shuffle className="size-3" />
                Randomise
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["You", opponent.name] as const).map((label, i) => {
                const active = i === 0 ? starterIsMe : !starterIsMe
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStarterIsMe(i === 0)}
                    className="py-2 rounded-lg text-sm font-semibold transition-all truncate px-2"
                    style={{
                      background: active ? "rgba(16,185,129,0.15)" : "#1a1a1a",
                      border: active ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#10b981" : "#71717a",
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Match type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Match Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["Online", "Local"] as const).map((opt) => {
                const active = opt === "Local" ? isLocal : !isLocal
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIsLocal(opt === "Local")}
                    className="py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: active ? "rgba(16,185,129,0.15)" : "#1a1a1a",
                      border: active ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#10b981" : "#71717a",
                    }}
                  >
                    {opt === "Online" ? "Online" : "Local (one device)"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Format + Starting score */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Format</label>
              <Select value={String(bestOf)} onValueChange={(v) => { if (v) setBestOf(Number(v)) }}>
                <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">First to 1</SelectItem>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <SelectItem key={n} value={String(n)}>Best of {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Starting</label>
              <Select value={String(startingScore)} onValueChange={(v) => { if (v) setStartingScore(Number(v)) }}>
                <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[301, 501, 701].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Finish type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Finish</label>
            <Select value={finishType} onValueChange={(v) => { if (v) setFinishType(v) }}>
              <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOUBLE_OUT">Double Out</SelectItem>
                <SelectItem value="STRAIGHT_OUT">Straight Out</SelectItem>
                <SelectItem value="MASTER_OUT">Master Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => { prewarmSpeech(); sendChallenge() }}
            disabled={!canChallenge || isPending}
            className="w-full py-3 rounded-xl font-black text-black text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{
              background: canChallenge ? "linear-gradient(135deg, #10b981, #059669)" : "#333",
              boxShadow: canChallenge ? "0 0 20px rgba(16,185,129,0.3)" : "none",
            }}
          >
            {isPending ? "Sending…" : "Send Challenge 🎯"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
