"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { prewarmSpeech } from "@/lib/utils/speech"

type ModalPlayer = { id: string; name: string; avatarUrl: string | null }

const FINISH_TYPE_LABELS: Record<string, string> = {
  DOUBLE_OUT: "Double Out",
  STRAIGHT_OUT: "Straight Out",
  MASTER_OUT: "Master Out",
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1.5">
        {label}
        <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">set by competition</span>
      </Label>
      <div className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground select-none">
        {value}
      </div>
    </div>
  )
}

interface PreMatchModalProps {
  open: boolean
  playerA: ModalPlayer
  playerB: ModalPlayer
  defaultBestOf?: number
  defaultStartingScore?: number
  defaultFinishType?: string
  locked?: boolean
  onStart: (config: { starterId: string; bestOf: number; startingScore: number; finishType: string; isLocal: boolean }) => void
  onClose?: () => void
}

export function PreMatchModal({
  open,
  playerA,
  playerB,
  defaultBestOf = 7,
  defaultStartingScore = 501,
  defaultFinishType = "DOUBLE_OUT",
  locked = false,
  onStart,
  onClose,
}: PreMatchModalProps) {
  const [bestOf, setBestOf] = useState<number>(defaultBestOf)
  const [startingScore, setStartingScore] = useState<number>(defaultStartingScore)
  const [finishType, setFinishType] = useState<string>(defaultFinishType)
  const [isLocal, setIsLocal] = useState(false)
  const [callerEnabled, setCallerEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("masterCallerEnabled") !== "false"
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.() }}>
      <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Match Setup</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto pr-1">
          {locked ? (
            <>
              <LockedField label="Starting Score" value={String(startingScore)} />
              <LockedField label="Format" value={bestOf === 1 ? "First to 1" : `Best of ${bestOf} legs`} />
              <LockedField label="Finish Type" value={FINISH_TYPE_LABELS[finishType] ?? finishType} />
            </>
          ) : (
            <>
              {/* Starting score */}
              <div className="flex flex-col gap-2">
                <Label>Starting Score</Label>
                <Select value={String(startingScore)} onValueChange={(v) => setStartingScore(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[301, 501, 701].map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Best of */}
              <div className="flex flex-col gap-2">
                <Label>Format</Label>
                <Select value={String(bestOf)} onValueChange={(v) => setBestOf(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n === 1 ? "First to 1" : `Best of ${n} legs`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Finish type */}
              <div className="flex flex-col gap-2">
                <Label>Finish Type</Label>
                <Select value={finishType} onValueChange={(v) => { if (v) setFinishType(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOUBLE_OUT">Double Out</SelectItem>
                    <SelectItem value="STRAIGHT_OUT">Straight Out</SelectItem>
                    <SelectItem value="MASTER_OUT">Master Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Match type */}
          <div className="flex flex-col gap-2">
            <Label>Match Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["Online", "Local"] as const).map((opt) => {
                const active = opt === "Local" ? isLocal : !isLocal
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIsLocal(opt === "Local")}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all border ${
                      active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt === "Local" ? "Local (one device)" : "Online"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Master caller */}
          <div className="flex flex-col gap-2">
            <Label>Master Caller</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["On", "Off"] as const).map((opt) => {
                const active = opt === "On" ? callerEnabled : !callerEnabled
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCallerEnabled(opt === "On")}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all border ${
                      active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          <Button
            onClick={() => { localStorage.setItem("masterCallerEnabled", String(callerEnabled)); prewarmSpeech(); onStart({ starterId: playerA.id, bestOf, startingScore, finishType, isLocal }) }}
            className="w-full"
            size="lg"
          >
            Start Match
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
