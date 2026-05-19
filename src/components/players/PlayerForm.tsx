"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createPlayerSchema, type CreatePlayerInput as PlayerFormValues } from "@/lib/validations/player.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Player } from "@/types/api"

interface PlayerFormProps {
  defaultValues?: Partial<Player>
  onSubmit: (values: PlayerFormValues) => void
  isSubmitting?: boolean
  submitLabel?: string
}

export function PlayerForm({ defaultValues, onSubmit, isSubmitting, submitLabel = "Save" }: PlayerFormProps) {
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avatarUrl">Avatar URL</Label>
        <Input id="avatarUrl" {...register("avatarUrl")} placeholder="https://..." />
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}
