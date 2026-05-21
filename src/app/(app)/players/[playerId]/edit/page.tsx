"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { usePlayer, useUpdatePlayer } from "@/hooks/usePlayers"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerForm } from "@/components/players/PlayerForm"
import { Skeleton } from "@/components/ui/skeleton"
import type { CreatePlayerInput } from "@/lib/validations/player.schema"

interface PageProps {
  params: Promise<{ playerId: string }>
}

export default function EditPlayerPage({ params }: PageProps) {
  const { playerId } = use(params)
  const router = useRouter()
  const { data: player, isLoading } = usePlayer(playerId)
  const { mutate, isPending } = useUpdatePlayer(playerId)

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  const canEdit =
    meData?.role === "ADMIN" || (meData?.playerId && meData.playerId === playerId)

  useEffect(() => {
    if (!meLoading && meData && !canEdit) {
      router.replace(`/players/${playerId}`)
    }
  }, [meLoading, meData, canEdit, playerId, router])

  function handleSubmit(values: CreatePlayerInput) {
    mutate(values, {
      onSuccess: () => {
        toast.success("Player updated!")
        router.push(`/players/${playerId}`)
      },
      onError: () => toast.error("Failed to update player"),
    })
  }

  if (isLoading || meLoading) return <Skeleton className="h-64 rounded-xl max-w-md" />
  if (!canEdit) return null

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <PageHeader title="Edit Player" />
      <div className="rounded-xl border border-border bg-card p-6">
        {player && (
          <PlayerForm
            defaultValues={player}
            onSubmit={handleSubmit}
            isSubmitting={isPending}
            playerId={playerId}
          />
        )}
      </div>
    </div>
  )
}
