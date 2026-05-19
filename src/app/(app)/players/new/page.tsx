"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerForm } from "@/components/players/PlayerForm"
import { useCreatePlayer } from "@/hooks/usePlayers"
import type { CreatePlayerInput } from "@/lib/validations/player.schema"

export default function NewPlayerPage() {
  const router = useRouter()
  const { mutate, isPending } = useCreatePlayer()

  function handleSubmit(values: CreatePlayerInput) {
    mutate(values, {
      onSuccess: (player) => {
        toast.success(`${player.name} added!`)
        router.push("/players")
      },
      onError: () => toast.error("Failed to create player"),
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader title="Add Player" />
      <div className="rounded-xl border border-border bg-card p-6">
        <PlayerForm onSubmit={handleSubmit} isSubmitting={isPending} submitLabel="Add Player" />
      </div>
    </div>
  )
}
