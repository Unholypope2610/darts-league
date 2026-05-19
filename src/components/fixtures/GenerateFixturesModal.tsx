"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useGenerateFixtures } from "@/hooks/useFixtures"

interface GenerateFixturesModalProps {
  competitionId: string
  open: boolean
  onClose: () => void
}

export function GenerateFixturesModal({ competitionId, open, onClose }: GenerateFixturesModalProps) {
  const [rounds, setRounds] = useState(1)
  const { mutate, isPending } = useGenerateFixtures(competitionId)

  function handleGenerate() {
    mutate(
      { rounds },
      {
        onSuccess: () => {
          toast.success("Fixtures generated!")
          onClose()
        },
        onError: () => toast.error("Failed to generate fixtures"),
      },
    )
  }

  const roundLabels: Record<number, string> = {
    1: "1× each",
    2: "2× each (home & away)",
    3: "3× each",
    4: "4× each",
    5: "5× each",
    6: "6× each",
    7: "7× each",
    8: "8× each",
    9: "9× each",
    10: "10× each",
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Fixtures</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>How many times does each pair play?</Label>
            <Select value={String(rounds)} onValueChange={(v) => { if (v) setRounds(Number(v)) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[320px]">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{roundLabels[n]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? "Generating…" : "Generate Fixtures"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
