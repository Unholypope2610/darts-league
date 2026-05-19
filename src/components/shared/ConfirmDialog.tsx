"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
  isPending?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive,
  isPending,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 ${isDestructive ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
          >
            {isPending ? "…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
