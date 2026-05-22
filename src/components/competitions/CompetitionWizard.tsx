"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { usePlayers } from "@/hooks/usePlayers"
import { useCreateCompetition } from "@/hooks/useCompetitions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"

const step1Schema = z.object({
  type: z.enum(["SINGLE_LEAGUE", "DIVISIONS", "KNOCKOUT"]),
})

const step2Schema = z.object({
  name: z.string().min(1, "Name required"),
  season: z.string().min(1, "Season required"),
  startingScore: z.number().int().positive(),
  bestOf: z.number().int().positive(),
  finishType: z.enum(["DOUBLE_OUT", "STRAIGHT_OUT", "MASTER_OUT"]),
})

const TYPE_INFO = {
  SINGLE_LEAGUE: { label: "Single League", desc: "Round-robin league. All players in one group." },
  DIVISIONS: { label: "Two Divisions", desc: "Two tiers with promotion/relegation at season end." },
  KNOCKOUT: { label: "Knockout", desc: "Seeded bracket tournament (4 or 8 players)." },
}

export function CompetitionWizard() {
  const router = useRouter()
  const { data: players } = usePlayers()
  const { mutate, isPending } = useCreateCompetition()
  const [step, setStep] = useState(1)
  const [type, setType] = useState<"SINGLE_LEAGUE" | "DIVISIONS" | "KNOCKOUT">("SINGLE_LEAGUE")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [div1Players, setDiv1Players] = useState<string[]>([])
  const [div2Players, setDiv2Players] = useState<string[]>([])

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { name: "", season: new Date().getFullYear().toString(), startingScore: 501, bestOf: 7, finishType: "DOUBLE_OUT" as const },
  })

  const finishType = watch("finishType")
  const startingScore = watch("startingScore")
  const bestOf = watch("bestOf")

  function togglePlayer(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function handleCreate() {
    handleSubmit(
      (data) => {
        const payload: Record<string, unknown> = { ...data, type }
        if (type === "SINGLE_LEAGUE" || type === "KNOCKOUT") {
          payload.playerIds = selectedPlayers
        } else {
          payload.divisions = [
            { name: "Division 1", tier: 1, playerIds: div1Players },
            { name: "Division 2", tier: 2, playerIds: div2Players },
          ]
        }

        mutate(payload as Parameters<typeof mutate>[0], {
          onSuccess: (comp) => {
            toast.success("Competition created!")
            router.push(`/competitions/${comp.id}`)
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create competition"),
        })
      },
      () => toast.error("Missing required fields — go back and check the details step"),
    )()
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={cn("w-8 h-1.5 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      {/* Step 1: Type */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg">Choose Competition Type</h2>
          <div className="flex flex-col gap-3">
            {(Object.keys(TYPE_INFO) as Array<keyof typeof TYPE_INFO>).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all",
                  type === t ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
                )}
              >
                <span className="font-semibold">{TYPE_INFO[t].label}</span>
                <span className="text-sm text-muted-foreground">{TYPE_INFO[t].desc}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(2)}>Next →</Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg">Competition Details</h2>
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="Summer League 2025" />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Season</Label>
            <Input {...register("season")} placeholder="2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Starting Score</Label>
              <Select value={String(startingScore)} onValueChange={(v) => setValue("startingScore", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[301, 501, 701].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Format</Label>
              <Select value={String(bestOf)} onValueChange={(v) => setValue("bestOf", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => <SelectItem key={n} value={String(n)}>Bo{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Finish Type</Label>
            <Select value={finishType} onValueChange={(v) => setValue("finishType", v as "DOUBLE_OUT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOUBLE_OUT">Double Out</SelectItem>
                <SelectItem value="STRAIGHT_OUT">Straight Out</SelectItem>
                <SelectItem value="MASTER_OUT">Master Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1">Next →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Players */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg">
            {type === "DIVISIONS" ? "Assign Players to Divisions" : "Select Players"}
          </h2>

          {type !== "DIVISIONS" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{selectedPlayers.length} selected</p>
              {players?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id, selectedPlayers, setSelectedPlayers)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    selectedPlayers.includes(p.id) ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                  <span className="font-medium">{p.name}</span>
                  {selectedPlayers.includes(p.id) && <span className="ml-auto text-primary text-sm">✓</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {["Division 1", "Division 2"].map((divName, divIdx) => {
                const list = divIdx === 0 ? div1Players : div2Players
                const setList = divIdx === 0 ? setDiv1Players : setDiv2Players
                return (
                  <div key={divName} className="flex flex-col gap-2">
                    <p className="font-semibold text-sm">{divName}</p>
                    {players?.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlayer(p.id, list, setList)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all text-left text-sm",
                          list.includes(p.id) ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Back</Button>
            <Button onClick={() => setStep(4)} className="flex-1">Review →</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg">Review & Create</h2>
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{TYPE_INFO[type].label}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Season</span><span className="font-medium">{watch("season")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Format</span><span className="font-medium">Bo{bestOf} • {startingScore} • {finishType.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Players</span><span className="font-medium">{type === "DIVISIONS" ? `${div1Players.length} + ${div2Players.length}` : selectedPlayers.length}</span></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1">← Back</Button>
            <Button onClick={handleCreate} disabled={isPending} className="flex-1">
              {isPending ? "Creating…" : "Create Competition"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
