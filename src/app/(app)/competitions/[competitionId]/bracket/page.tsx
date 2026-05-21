"use client"

import { use, useState } from "react"
import { toast } from "sonner"
import { useBracket, useGenerateBracket } from "@/hooks/useBracket"
import { BracketView } from "@/components/bracket/BracketView"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { Network } from "lucide-react"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function BracketPage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: nodes, isLoading } = useBracket(competitionId)
  const { mutate: generateBracket, isPending } = useGenerateBracket(competitionId)
  const [topN, setTopN] = useState<2 | 4 | 8>(4)

  function handleGenerate() {
    generateBracket(
      { topN },
      {
        onSuccess: () => toast.success("Bracket generated!"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to generate bracket"),
      },
    )
  }

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold">Knockout Bracket</h2>
        <div className="flex items-center gap-2">
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value) as 2 | 4 | 8)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
          >
            <option value={2}>Top 2</option>
            <option value={4}>Top 4</option>
            <option value={8}>Top 8</option>
          </select>
          <Button onClick={handleGenerate} disabled={isPending} size="sm">
            {isPending ? "Generating…" : nodes?.length ? "Regenerate" : "Generate Bracket"}
          </Button>
        </div>
      </div>

      {nodes?.length ? (
        <BracketView nodes={nodes} canScore={true} />
      ) : (
        <EmptyState
          icon={<Network className="w-10 h-10" />}
          title="No bracket yet"
          description="Generate a knockout bracket from the league standings"
        />
      )}
    </div>
  )
}
