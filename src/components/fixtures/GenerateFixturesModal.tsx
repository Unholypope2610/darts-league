"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useGenerateFixtures } from "@/hooks/useFixtures"

interface GenerateFixturesModalProps {
  competitionId: string
  open: boolean
  onClose: () => void
}

export function GenerateFixturesModal({ competitionId, open, onClose }: GenerateFixturesModalProps) {
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false)
  const { mutate, isPending } = useGenerateFixtures(competitionId)

  function handleGenerate() {
    mutate(
      { doubleRoundRobin },
      {
        onSuccess: () => {
          toast.success("Fixtures generated!")
          onClose()
        },
        onError: () => toast.error("Failed to generate fixtures"),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Fixtures</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={doubleRoundRobin}
              onChange={(e) => setDoubleRoundRobin(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="font-medium">Double Round Robin</p>
              <p className="text-xs text-muted-foreground">Each pair plays twice (home & away)</p>
            </div>
          </Label>
          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? "Generating…" : "Generate Fixtures"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
