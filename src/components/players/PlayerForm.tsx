"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createPlayerSchema, type CreatePlayerInput as PlayerFormValues } from "@/lib/validations/player.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AvatarUpload } from "./AvatarUpload"
import type { Player } from "@/types/api"

interface PlayerFormProps {
  defaultValues?: Partial<Player>
  onSubmit: (values: PlayerFormValues) => void
  isSubmitting?: boolean
  submitLabel?: string
  playerId?: string
}

export function PlayerForm({ defaultValues, onSubmit, isSubmitting, submitLabel = "Save", playerId }: PlayerFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<PlayerFormValues>({
    resolver: zodResolver(createPlayerSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      nickname: defaultValues?.nickname ?? "",
      hand: (defaultValues?.hand as "LEFT" | "RIGHT") ?? "RIGHT",
      avatarUrl: defaultValues?.avatarUrl ?? "",
      replayScoreThreshold: defaultValues?.replayScoreThreshold ?? 100,
      replayCheckoutThreshold: defaultValues?.replayCheckoutThreshold ?? 69,
      replayBobs27HitsThreshold: defaultValues?.replayBobs27HitsThreshold ?? 3,
      replayMarksThreshold: defaultValues?.replayMarksThreshold ?? 5,
    },
  })

  const hand = watch("hand")

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" {...register("name")} placeholder="Full name" />
        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nickname">Nickname</Label>
        <Input id="nickname" {...register("nickname")} placeholder="Optional nickname" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Throwing Hand</Label>
        <Select value={hand} onValueChange={(v) => setValue("hand", v as "LEFT" | "RIGHT")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="RIGHT">Right-handed</SelectItem>
            <SelectItem value="LEFT">Left-handed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {playerId ? (
        <AvatarUpload
          playerId={playerId}
          name={watch("name") || defaultValues?.name || ""}
          currentUrl={defaultValues?.avatarUrl}
          onUploadComplete={(url) => setValue("avatarUrl", url)}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input id="avatarUrl" {...register("avatarUrl")} placeholder="https://..." />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Action Replay Thresholds</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Score ≥</p>
            <Input
              type="number"
              min={60}
              max={180}
              step={1}
              {...register("replayScoreThreshold")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Checkout ≥</p>
            <Input
              type="number"
              min={40}
              max={170}
              step={1}
              {...register("replayCheckoutThreshold")}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A replay prompt appears when your camera is on and you hit these thresholds during a match.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Practice Replay Thresholds</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Bob&apos;s 27 hits ≥</p>
            <Input
              type="number"
              min={1}
              max={3}
              step={1}
              {...register("replayBobs27HitsThreshold")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Cricket marks ≥</p>
            <Input
              type="number"
              min={1}
              max={9}
              step={1}
              {...register("replayMarksThreshold")}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Triggers a replay prompt in practice modes when these thresholds are met.
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}
