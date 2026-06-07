"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { usePlayers } from "@/hooks/usePlayers"
import { useQuery } from "@tanstack/react-query"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { X, ChevronRight, ChevronLeft, Bot } from "lucide-react"
import { BOT_LEVEL_NAMES } from "@/lib/bot/dartbot"

type SoloGameMode = "BOBS_27" | "CRICKET" | "HALF_IT"
type BotSubMode = "CRICKET" | "BOBS_27" | "HALF_IT" | "X01"

const SOLO_MODES: { mode: SoloGameMode; label: string; desc: string; minPlayers: number; maxPlayers: number; duration: string }[] = [
  { mode: "BOBS_27", label: "Bob's 27", desc: "Target each double in order. Hit = score points. Miss = lose points. Starting from 27.", minPlayers: 1, maxPlayers: 4, duration: "~10 min" },
  { mode: "CRICKET", label: "Cricket", desc: "Close numbers 15–20 and Bull by hitting them 3 times. Score on open numbers your opponent hasn't closed.", minPlayers: 2, maxPlayers: 4, duration: "~20 min" },
  { mode: "HALF_IT", label: "Half It", desc: "Score on each target across 12 rounds. Miss a target and your score is halved!", minPlayers: 1, maxPlayers: 4, duration: "~15 min" },
]

const BOT_SUB_MODES: { mode: BotSubMode; label: string; desc: string }[] = [
  { mode: "CRICKET", label: "Cricket", desc: "Close 15–20 and Bull before the bot does" },
  { mode: "BOBS_27", label: "Bob's 27", desc: "Side-by-side doubles game — beat the bot's score" },
  { mode: "HALF_IT", label: "Half It", desc: "12 targets — score more than the bot" },
  { mode: "X01", label: "301 / 501 / 701", desc: "Legs-based x01 — first to win the match" },
]

const X01_FORMATS = [
  { score: 301, label: "301" },
  { score: 501, label: "501" },
  { score: 701, label: "701" },
]

const LEGS_OPTIONS = [1, 2, 3, 4, 5]

// Stat indicators per level (index 0 = Lv.1), derived from probability tables
const BOT_STAT_X01    = [15, 22, 32, 41, 53, 64, 75, 89, 102, 116] // 3-dart avg
const BOT_STAT_CRICKET = [1.5, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 6.9, 7.5] // MPR
const BOT_STAT_BOBS27  = [8, 14, 20, 28, 37, 47, 58, 68, 78, 87] // hit % per dart
const BOT_STAT_HALFIT  = [10, 18, 27, 37, 47, 57, 67, 76, 84, 91] // scoring %

function getBotStatLabel(subMode: BotSubMode | null, level: number): string {
  const i = level - 1
  if (subMode === "X01")     return `~${BOT_STAT_X01[i]} avg`
  if (subMode === "CRICKET") return `~${BOT_STAT_CRICKET[i].toFixed(1)} MPR`
  if (subMode === "BOBS_27") return `${BOT_STAT_BOBS27[i]}% hit rate`
  if (subMode === "HALF_IT") return `${BOT_STAT_HALFIT[i]}% scoring chance`
  return ""
}

interface Props { open: boolean; onClose: () => void }

export function PracticeSetupModal({ open, onClose }: Props) {
  const router = useRouter()
  const { data: players } = usePlayers()
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  // Mode selection
  const [isBotMode, setIsBotMode] = useState(false)

  // Solo flow
  const [soloGameMode, setSoloGameMode] = useState<SoloGameMode | null>(null)
  const [soloVariant, setSoloVariant] = useState<"STANDARD" | "HARD" | "RANDOM">("STANDARD")
  const [isLocal, setIsLocal] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])

  // Bot flow
  const [botSubMode, setBotSubMode] = useState<BotSubMode | null>(null)
  const [botVariant, setBotVariant] = useState<"STANDARD" | "HARD" | "RANDOM">("STANDARD")
  const [botLevel, setBotLevel] = useState(5)
  const [x01Score, setX01Score] = useState(501)
  const [x01CustomScore, setX01CustomScore] = useState("")
  const [x01IsCustom, setX01IsCustom] = useState(false)
  const [finishType, setFinishType] = useState<"DOUBLE_OUT" | "STRAIGHT_OUT">("DOUBLE_OUT")
  const [legsTarget, setLegsTarget] = useState(1)
  const [customLegs, setCustomLegs] = useState("")
  const [isCustomLegs, setIsCustomLegs] = useState(false)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [botThrowDelay, setBotThrowDelay] = useState("4")
  const [isCreating, setIsCreating] = useState(false)

  if (!open) return null

  const soloGame = SOLO_MODES.find((g) => g.mode === soloGameMode)

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (soloGame && prev.length >= soloGame.maxPlayers) return prev
      return [...prev, id]
    })
  }

  function handleClose() {
    setStep(1)
    setIsBotMode(false)
    setSoloGameMode(null)
    setSoloVariant("STANDARD")
    setIsLocal(false)
    setSelectedPlayerIds([])
    setBotSubMode(null)
    setBotVariant("STANDARD")
    setBotLevel(5)
    setBotThrowDelay("1.5")
    setX01Score(501)
    setX01CustomScore("")
    setX01IsCustom(false)
    setFinishType("DOUBLE_OUT")
    setLegsTarget(1)
    setCustomLegs("")
    setIsCustomLegs(false)
    onClose()
  }

  function handleBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  const effectiveStartingScore = x01IsCustom
    ? (parseInt(x01CustomScore, 10) || 501)
    : x01Score
  const effectiveLegsTarget = isCustomLegs
    ? (parseInt(customLegs, 10) || 1)
    : legsTarget

  async function handleCreate() {
    setIsCreating(true)
    try {
      let body: Record<string, unknown>

      if (isBotMode) {
        if (!botSubMode) return
        const myPlayerId = me?.playerId
        if (!myPlayerId) return

        body = {
          gameMode: botSubMode,
          variant: botSubMode === "X01" ? finishType : botVariant,
          playerIds: [myPlayerId],
          isLocal: false,
          isBotGame: true,
          botLevel,
          ...(botSubMode === "X01" ? { startingScore: effectiveStartingScore, legsTarget: effectiveLegsTarget } : {}),
        }
      } else {
        if (!soloGameMode || !soloGame) return
        if (selectedPlayerIds.length < soloGame.minPlayers) return
        body = {
          gameMode: soloGameMode,
          variant: soloVariant,
          playerIds: selectedPlayerIds,
          isLocal,
        }
      }

      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const session = await res.json()
      sessionStorage.setItem(`caller-set-${session.id}`, "true")
      if (isBotMode) {
        const delayMs = Math.round((parseFloat(botThrowDelay) || 1.5) * 1000)
        sessionStorage.setItem(`bot-delay-${session.id}`, String(delayMs))
      }
      handleClose()
      router.push(`/practice/${session.id}`)
    } finally {
      setIsCreating(false)
    }
  }

  const stepTitle = step === 1 ? "Choose Game"
    : step === 2 ? (isBotMode && !botSubMode ? "Choose Mode" : "Options")
    : "Select Players"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={handleBack} className="p-1 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <p className="text-sm font-bold">{stepTitle}</p>
          </div>
          <button onClick={handleClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* ── Step 1: Game Mode ── */}
          {step === 1 && (
            <>
              {/* Solo modes */}
              {SOLO_MODES.map((g) => (
                <button
                  key={g.mode}
                  onClick={() => { setIsBotMode(false); setSoloGameMode(g.mode); setSoloVariant("STANDARD"); setStep(2) }}
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

              {/* vs DartBot */}
              <button
                onClick={() => { setIsBotMode(true); setBotSubMode(null); setStep(2) }}
                className="w-full text-left rounded-xl border border-violet-500/40 bg-violet-500/5 p-4 hover:border-violet-400/60 hover:bg-violet-500/10 transition-all flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" />
                    <p className="font-bold text-sm text-violet-300">vs DartBot</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Play Cricket, Bob's 27, Half It or x01 against a computer opponent at your chosen difficulty.</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              </button>
            </>
          )}

          {/* ── Step 2: Options (solo) ── */}
          {step === 2 && !isBotMode && soloGameMode && (
            <>
              {soloGameMode === "BOBS_27" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difficulty</p>
                  {(["STANDARD", "HARD"] as const).map((v) => (
                    <button key={v} onClick={() => setSoloVariant(v)}
                      className={cn("w-full text-left rounded-xl border p-3 transition-all",
                        soloVariant === v ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/80")}>
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Easy Mode" : "Hard Mode"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v === "STANDARD" ? "Score can go negative — all 21 rounds always play out." : "Game ends immediately if your score drops below 0."}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {soloGameMode === "HALF_IT" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Order</p>
                  {(["STANDARD", "RANDOM"] as const).map((v) => (
                    <button key={v} onClick={() => setSoloVariant(v as "STANDARD" | "RANDOM")}
                      className={cn("w-full text-left rounded-xl border p-3 transition-all",
                        soloVariant === v ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/80")}>
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Standard Order" : "Random Order"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v === "STANDARD" ? "Fixed sequence: 20, 16, Doubles, 17, 18, Trebles, 19, 20, Bull, Colours, Wildcard." : "All 12 targets shuffled — a different order every game."}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {soloGameMode === "CRICKET" && (
                <p className="text-sm text-muted-foreground">No variants for Cricket — standard American rules apply.</p>
              )}

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">Local (one device)</p>
                  <p className="text-xs text-muted-foreground">All players score on this device</p>
                </div>
                <button onClick={() => setIsLocal((v) => !v)}
                  className={cn("w-10 h-6 rounded-full transition-colors relative", isLocal ? "bg-primary" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", isLocal ? "left-4.5" : "left-0.5")} />
                </button>
              </div>

              <button onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all">
                Next — Select Players
              </button>
            </>
          )}

          {/* ── Step 2: Bot sub-mode picker ── */}
          {step === 2 && isBotMode && !botSubMode && (
            <>
              {BOT_SUB_MODES.map((g) => (
                <button key={g.mode} onClick={() => { setBotSubMode(g.mode); setBotVariant("STANDARD") }}
                  className="w-full text-left rounded-xl border border-border p-4 hover:border-violet-400/40 hover:bg-violet-500/5 transition-all flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{g.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </button>
              ))}
            </>
          )}

          {/* ── Step 2: Bot options ── */}
          {step === 2 && isBotMode && botSubMode && (
            <>
              {/* Bot difficulty */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bot Difficulty</p>
                  <span className="text-sm font-bold text-violet-300">{BOT_LEVEL_NAMES[botLevel]} (Lv.{botLevel})</span>
                </div>
                <input
                  type="range" min={1} max={10} step={1} value={botLevel}
                  onChange={(e) => setBotLevel(parseInt(e.target.value, 10))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Novice</span><span>Club</span><span>Elite</span>
                </div>
                {getBotStatLabel(botSubMode, botLevel) && (
                  <p className="text-[11px] text-violet-400/80 text-center font-semibold">
                    {getBotStatLabel(botSubMode, botLevel)}
                  </p>
                )}
              </div>

              {/* Throw delay */}
              <div className="flex items-center justify-between rounded-xl border border-border p-3 gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Throw delay</p>
                  <p className="text-xs text-muted-foreground">Seconds bot waits before each throw (0 = instant)</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number" min={0} max={10} step={0.5}
                    value={botThrowDelay}
                    onChange={(e) => setBotThrowDelay(e.target.value)}
                    className="w-16 bg-muted border border-border rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-violet-500/50"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>

              {/* Bob's 27 variant */}
              {botSubMode === "BOBS_27" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mode</p>
                  {(["STANDARD", "HARD"] as const).map((v) => (
                    <button key={v} onClick={() => setBotVariant(v)}
                      className={cn("w-full text-left rounded-xl border p-3 transition-all",
                        botVariant === v ? "border-violet-500/50 bg-violet-500/10" : "border-border hover:border-border/80")}>
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Easy Mode" : "Hard Mode"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v === "STANDARD" ? "Score can go negative — all 21 rounds play out." : "Eliminated if score drops below 0."}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Half It variant */}
              {botSubMode === "HALF_IT" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Order</p>
                  {(["STANDARD", "RANDOM"] as const).map((v) => (
                    <button key={v} onClick={() => setBotVariant(v as "STANDARD" | "RANDOM")}
                      className={cn("w-full text-left rounded-xl border p-3 transition-all",
                        botVariant === v ? "border-violet-500/50 bg-violet-500/10" : "border-border hover:border-border/80")}>
                      <p className="text-sm font-semibold">{v === "STANDARD" ? "Standard Order" : "Random Order"}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* x01 options */}
              {botSubMode === "X01" && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Starting Score</p>
                    <div className="grid grid-cols-3 gap-2">
                      {X01_FORMATS.map(({ score, label }) => (
                        <button key={score}
                          onClick={() => { setX01Score(score); setX01IsCustom(false) }}
                          className={cn("py-2.5 rounded-xl border font-bold text-sm transition-all",
                            !x01IsCustom && x01Score === score ? "border-violet-500/50 bg-violet-500/10 text-violet-300" : "border-border hover:border-border/80")}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setX01IsCustom((v) => !v)}
                        className={cn("py-2 px-3 rounded-xl border text-sm font-semibold transition-all shrink-0",
                          x01IsCustom ? "border-violet-500/50 bg-violet-500/10 text-violet-300" : "border-border text-muted-foreground hover:border-border/80")}>
                        Custom
                      </button>
                      {x01IsCustom && (
                        <input
                          type="number" min={100} max={999} placeholder="e.g. 401"
                          value={x01CustomScore}
                          onChange={(e) => setX01CustomScore(e.target.value)}
                          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-violet-500/50"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Finish</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["DOUBLE_OUT", "STRAIGHT_OUT"] as const).map((f) => (
                        <button key={f} onClick={() => setFinishType(f)}
                          className={cn("py-2.5 rounded-xl border text-sm font-semibold transition-all",
                            finishType === f ? "border-violet-500/50 bg-violet-500/10 text-violet-300" : "border-border hover:border-border/80")}>
                          {f === "DOUBLE_OUT" ? "Double Out" : "Straight Out"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legs (first to)</p>
                    <div className="grid grid-cols-5 gap-2">
                      {LEGS_OPTIONS.map((n) => (
                        <button key={n} onClick={() => { setLegsTarget(n); setIsCustomLegs(false) }}
                          className={cn("py-2.5 rounded-xl border font-bold text-sm transition-all",
                            !isCustomLegs && legsTarget === n ? "border-violet-500/50 bg-violet-500/10 text-violet-300" : "border-border hover:border-border/80")}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsCustomLegs((v) => !v)}
                        className={cn("py-2 px-3 rounded-xl border text-sm font-semibold transition-all shrink-0",
                          isCustomLegs ? "border-violet-500/50 bg-violet-500/10 text-violet-300" : "border-border text-muted-foreground hover:border-border/80")}>
                        Custom
                      </button>
                      {isCustomLegs && (
                        <input type="number" min={1} max={99} placeholder="e.g. 7"
                          value={customLegs}
                          onChange={(e) => setCustomLegs(e.target.value)}
                          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-violet-500/50"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              <button onClick={handleCreate} disabled={isCreating}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                {isCreating ? "Starting…" : `Start vs DartBot Lv.${botLevel}`}
              </button>
            </>
          )}

          {/* ── Step 3: Player selection (solo) ── */}
          {step === 3 && !isBotMode && soloGame && (
            <>
              <p className="text-xs text-muted-foreground">
                Select {soloGame.minPlayers}–{soloGame.maxPlayers} players ({selectedPlayerIds.length} selected)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(players ?? []).map((p) => {
                  const selected = selectedPlayerIds.includes(p.id)
                  const disabled = !selected && selectedPlayerIds.length >= soloGame.maxPlayers
                  return (
                    <button key={p.id} onClick={() => togglePlayer(p.id)} disabled={disabled}
                      className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                        selected ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/60",
                        disabled && "opacity-40")}>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                      <span className="text-sm font-medium truncate">{p.name.split(" ")[0]}</span>
                    </button>
                  )
                })}
              </div>

              <button onClick={handleCreate}
                disabled={selectedPlayerIds.length < soloGame.minPlayers || isCreating}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                {isCreating ? "Starting…" : "Start Game"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
