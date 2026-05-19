"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface SeasonEndModalProps {
  competitionId: string
  open: boolean
  onClose: () => void
}

export function SeasonEndModal({ competitionId, open, onClose }: SeasonEndModalProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setIsPending(true)
    try {
      const res = await fetch(`/api/competitions/${competitionId}/season-end`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success("Season ended. Promotion/relegation applied!")
      router.refresh()
      onClose()
    } catch {
      toast.error("Failed to end season")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End Season</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This will apply promotion and relegation between divisions based on the final standings, and mark the competition as completed.
          </p>
          <p className="text-sm font-medium text-amber-400">This action cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isPending} className="flex-1">
              {isPending ? "Processing…" : "Confirm End Season"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
