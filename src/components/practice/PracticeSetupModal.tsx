"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { usePlayers } from "@/hooks/usePlayers"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { X, ChevronRight, ChevronLeft } from "lucide-react"

type GameMode = "BOBS_27" | "CRICKET" | "HALF_IT"

const GAME_MODES: { mode: GameMode; label: string; desc: string; minPlayers: number; maxPlayers: number; duration: string }[] = [
  { mode: "BOBS_27", label: "Bob's 27", desc: "Target each double in order. Hit = score points. Miss = lose points. Starting from 27.", minPlayers: 1, maxPlayers: 4, duration: "~10 min" },
  { mode: "CRICKET", label: "Cricket", desc: "Close numbers 15–20 and Bull by hitting them 3 times. Score on open numbers your opponent hasn't closed.", minPlayers: 2, maxPlayers: 4, duration: "~20 min" },
  { mode: "HALF_IT", label: "Half It", desc: "Score on each target across 12 rounds. Miss a target and your score is halved!", minPlayers: 1, maxPlayers: 4, duration: "~15 min" },
]

interface Props { open: boolean; onClose: () => void }

export function PracticeSetupModal({ open, onClose }: Props) {
  const router = useRouter()
  const { data: players } = usePlayers()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [gameMode, setGameMode] = useState<GameMode | null>(null)
  const [variant, setVariant] = useState<"STANDARD" | "HARD" | "RANDOM">("STANDARD")
  const [isLocal, setIsLocal] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  if (!open) return null

  const selectedGame = GAME_MODES.find((g) => g.mode === gameMode)

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (selectedGame && prev.length >= selectedGame.maxPlayers) return prev
      return [...prev, id]
    })
  }

  function handleClose() {
    setStep(1)
    setGameMode(null)
    setVariant("STANDARD")
    setIsLocal(false)
    setSelectedPlayerIds([])
    onClose()
  }

  async function handleCreate() {
    if (!gameMode || !selectedGame) return
    if (selectedPlayerIds.length < selectedGame.minPlayers) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameMode, variant, playerIds: selectedPlayerIds, isLocal }),
      })
      const session = await res.json()
      sessionStorage.setItem(`caller-set-${session.id}`, "true")
      handleClose()
      router.push(`/practice/${session.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="p-1 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <p className="text-sm font-bold">
              {step === 1 ? "Choose Game" : step === 2 ? "Options" : "Select Players"}
            </p>
          </div>
          <button onClick={handleClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Step 1 — Game Mode */}
          {step === 1 && (
            <>
              {GAME_MODES.map((g) => (
                <button
                  key={g.mode}
                  onClick={() => { setGameMode(g.mode); setVariant("STANDARD"); setStep(2) }}
                  className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-muted/30 transition-all flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-sm">{g.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{g.minPlayers}–{g.maxPlayers} players · {g.duration}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </button>
              ))}
            </>
          )}

          {/* Step 2 — Options */}
          {step === 2 && gameMode && (
            <>
              {gameMode === "BOBS_27" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difficulty</p>
                  {(["STANDARD", "HARD"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-all",
                        variant === v ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/80",
                      )}
                    >
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Easy Mode" : "Hard Mode"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v === "STANDARD"
                          ? "Score can go negative — all 21 rounds always play out."
                          : "Game ends immediately if your score drops below 0."}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {gameMode === "HALF_IT" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Order</p>
                  {(["STANDARD", "RANDOM"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-all",
                        variant === v ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/80",
                      )}
                    >
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Standard Order" : "Random Order"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v === "STANDARD"
                          ? "Fixed Dartscounter sequence: 20, 16, Doubles, 17, 18, Trebles, 19, 20, Bull, Colours, Wildcard."
                          : "All 12 targets shuffled — a different order every game."}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {gameMode === "CRICKET" && (
                <p className="text-sm text-muted-foreground">No variants for Cricket — standard American rules apply.</p>
              )}

              {/* Local toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">Local (one device)</p>
                  <p className="text-xs text-muted-foreground">Both players score on this device</p>
                </div>
                <button
                  onClick={() => setIsLocal((v) => !v)}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative",
                    isLocal ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", isLocal ? "left-4.5" : "left-0.5")} />
                </button>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all"
              >
                Next — Select Players
              </button>
            </>
          )}

          {/* Step 3 — Players */}
          {step === 3 && selectedGame && (
            <>
              <p className="text-xs text-muted-foreground">
                Select {selectedGame.minPlayers}–{selectedGame.maxPlayers} players ({selectedPlayerIds.length} selected)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(players ?? []).map((p) => {
                  const selected = selectedPlayerIds.includes(p.id)
                  const disabled = !selected && selectedPlayerIds.length >= selectedGame.maxPlayers
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      disabled={disabled}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                        selected ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/60",
                        disabled && "opacity-40",
                      )}
                    >
                      <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                      <span className="text-sm font-medium truncate">{p.name.split(" ")[0]}</span>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleCreate}
                disabled={selectedPlayerIds.length < selectedGame.minPlayers || isCreating}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isCreating ? "Starting…" : "Start Game"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
