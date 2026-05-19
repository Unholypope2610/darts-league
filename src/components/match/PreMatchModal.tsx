"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import type { PlayerMeta } from "@/types/api"

interface PreMatchModalProps {
  open: boolean
  playerA: PlayerMeta
  playerB: PlayerMeta
  defaultBestOf?: number
  defaultStartingScore?: number
  defaultFinishType?: string
  onStart: (config: { starterId: string; bestOf: number; startingScore: number; finishType: string }) => void
}

export function PreMatchModal({
  open,
  playerA,
  playerB,
  defaultBestOf = 7,
  defaultStartingScore = 501,
  defaultFinishType = "DOUBLE_OUT",
  onStart,
}: PreMatchModalProps) {
  const [starter, setStarter] = useState<string>(playerA.id)
  const [bestOf, setBestOf] = useState<number>(defaultBestOf)
  const [startingScore, setStartingScore] = useState<number>(defaultStartingScore)
  const [finishType, setFinishType] = useState<string>(defaultFinishType)

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Match Setup</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
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
                {[3, 5, 7, 9, 11].map((n) => (
                  <SelectItem key={n} value={String(n)}>Best of {n} legs</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Finish type */}
          <div className="flex flex-col gap-2">
            <Label>Finish Type</Label>
            <Select value={finishType} onValueChange={setFinishType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DOUBLE_OUT">Double Out</SelectItem>
                <SelectItem value="STRAIGHT_OUT">Straight Out</SelectItem>
                <SelectItem value="MASTER_OUT">Master Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Who throws first */}
          <div className="flex flex-col gap-2">
            <Label>First Throw</Label>
            <div className="grid grid-cols-2 gap-2">
              {[playerA, playerB].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStarter(p.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    starter === p.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                  <span className="text-sm font-medium truncate max-w-[80px]">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => onStart({ starterId: starter, bestOf, startingScore, finishType })}
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
