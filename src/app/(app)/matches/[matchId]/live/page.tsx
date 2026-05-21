"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MessageCircle, RotateCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useLiveMatch } from "@/hooks/useLiveMatch"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { useMatchChat } from "@/hooks/useMatchChat"
import { LiveScoringLayout } from "@/components/match/LiveScoring/LiveScoringLayout"
import { MatchChatPanel } from "@/components/match/LiveChat/MatchChatPanel"
import { Skeleton } from "@/components/ui/skeleton"
import { prewarmSpeech } from "@/lib/utils/speech"

type Role = "playerA" | "playerB" | "spectator"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function LiveMatchPage({ params }: PageProps) {
  const { matchId } = use(params)
  const router = useRouter()
  const { isLoading, error } = useLiveMatch(matchId)
  const isMatchWon = useLiveMatchStore((s) => s.isMatchWon)
  const playerA = useLiveMatchStore((s) => s.playerA)
  const playerB = useLiveMatchStore((s) => s.playerB)
  const createdByUserId = useLiveMatchStore((s) => s.createdByUserId)

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    if (typeof window === "undefined") return null
    return (sessionStorage.getItem(`match-role-${matchId}`) as Role | null) ?? null
  })

  function handleRoleSelect(role: Role) {
    prewarmSpeech()
    sessionStorage.setItem(`match-role-${matchId}`, role)
    setSessionRole(role)
  }

  // Redirect to summary only if the match was ALREADY complete when the page loaded.
  const wasAlreadyCompleteRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (!isLoading && wasAlreadyCompleteRef.current === null) {
      wasAlreadyCompleteRef.current = isMatchWon
      if (isMatchWon) router.replace(`/matches/${matchId}`)
    }
  }, [isLoading, isMatchWon, matchId, router])

  const isMatchAdmin = !!me?.id && (me.id === createdByUserId || me.role === "ADMIN")

  const qc = useQueryClient()
  const [adminConfirm, setAdminConfirm] = useState<"abandon" | "restart" | null>(null)

  const { mutate: abandon, isPending: isAbandoning } = useMutation({
    mutationFn: () =>
      fetch(`/api/matches/${matchId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success("Match abandoned")
      router.push("/matches")
    },
    onError: () => toast.error("Failed to abandon match"),
  })

  const { mutate: restart, isPending: isRestarting } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/matches/${matchId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAId: playerA?.id,
          playerBId: playerB?.id,
          bestOf: 7,
          startingScore: 501,
          finishType: "DOUBLE_OUT",
          startingPlayerId: playerA?.id,
        }),
      })
      return res.json()
    },
    onSuccess: (newMatch) => {
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success("Match restarted!")
      router.push(`/matches/${newMatch.id}/live`)
    },
    onError: () => toast.error("Failed to restart match"),
  })

  const [isChatOpen, setIsChatOpen] = useState(false)

  const myPlayerId = me?.playerId ?? null
  const derivedRole: Role =
    myPlayerId && playerA?.id === myPlayerId ? "playerA"
    : myPlayerId && playerB?.id === myPlayerId ? "playerB"
    : "spectator"

  const myRole: Role = sessionRole ?? derivedRole

  const userName =
    myRole === "playerA" ? (playerA?.name ?? "Player A")
    : myRole === "playerB" ? (playerB?.name ?? "Player B")
    : (me?.email?.split("@")[0] ?? "Spectator")

  const chat = useMatchChat({
    matchId,
    userId: me?.id ?? "",
    userName,
    isOpen: isChatOpen,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load match.</p>
      </div>
    )
  }

  const showRolePrompt =
    !sessionRole && derivedRole === "spectator" && !!me && !!playerA && !!playerB

  return (
    <>
      {showRolePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 w-full max-w-xs">
            <p className="text-sm font-semibold text-center text-foreground">Who are you in this match?</p>
            <button
              onClick={() => handleRoleSelect("playerA")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerA.name}
            </button>
            <button
              onClick={() => handleRoleSelect("playerB")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerB.name}
            </button>
            <button
              onClick={() => handleRoleSelect("spectator")}
              className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Just spectating
            </button>
          </div>
        </div>
      )}

      <LiveScoringLayout myRole={myRole} />

      {/* Admin confirm overlay */}
      {adminConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAdminConfirm(null)} />
          <div className="relative w-full max-w-sm mx-auto bg-card rounded-t-2xl border-t border-border shadow-2xl px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col gap-3">
            <p className="text-sm font-semibold text-center">
              {adminConfirm === "abandon" ? "Abandon this match?" : "Restart with the same settings?"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setAdminConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-muted text-muted-foreground">Cancel</button>
              <button
                onClick={() => adminConfirm === "abandon" ? abandon() : restart()}
                disabled={isAbandoning || isRestarting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${adminConfirm === "abandon" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}
              >
                {isAbandoning || isRestarting ? "…" : adminConfirm === "abandon" ? "Yes, abandon" : "Yes, restart"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin controls — floating above chat button, match creator only */}
      {isMatchAdmin && !isMatchWon && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2">
          <button
            onClick={() => setAdminConfirm("restart")}
            className="size-10 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow active:scale-95 transition-all"
            aria-label="Restart match"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={() => setAdminConfirm("abandon")}
            className="size-10 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shadow active:scale-95 transition-all"
            aria-label="Abandon match"
          >
            <XCircle className="size-4" />
          </button>
        </div>
      )}

      {/* Floating chat button */}
      <button
        onClick={() => setIsChatOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-all"
        aria-label="Open chat"
      >
        <MessageCircle className="size-5" />
        {chat.unreadCount > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
          </span>
        )}
      </button>

      {playerA && playerB && (
        <MatchChatPanel
          chat={chat}
          playerAName={playerA.name}
          playerBName={playerB.name}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </>
  )
}
