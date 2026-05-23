"use client"

import { use, useState, useEffect } from "react"
import { toast } from "sonner"
import { useBracket, useGenerateBracket } from "@/hooks/useBracket"
import { useCompetition } from "@/hooks/useCompetitions"
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
  const { data: competition } = useCompetition(competitionId)
  const { mutate: generateBracket, isPending } = useGenerateBracket(competitionId)
  const [topN, setTopN] = useState<2 | 4 | 8>(4)
  const [bracketBestOf, setBracketBestOf] = useState<number>(7)
  const [bracketStartingScore, setBracketStartingScore] = useState<number>(501)
  const [bracketFinishType, setBracketFinishType] = useState<string>("DOUBLE_OUT")

  // Initialise format from saved bracket settings (or competition defaults)
  useEffect(() => {
    if (!competition) return
    setBracketBestOf(competition.bracketBestOf ?? competition.bestOf)
    setBracketStartingScore(competition.bracketStartingScore ?? competition.startingScore)
    setBracketFinishType(competition.bracketFinishType ?? competition.finishType)
  }, [competition])

  const isKnockout = competition?.type === "KNOCKOUT"

  function handleGenerate() {
    const opts = isKnockout
      ? { topN }
      : { topN, bracketBestOf, bracketStartingScore, bracketFinishType }
    generateBracket(opts, {
      onSuccess: () => toast.success("Bracket generated!"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to generate bracket"),
    })
  }

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold">Knockout Bracket</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Top-N selector — hidden for knockouts (all players always included) */}
          {!isKnockout && (
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value) as 2 | 4 | 8)}
              className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
            >
              <option value={2}>Top 2</option>
              <option value={4}>Top 4</option>
              <option value={8}>Top 8</option>
            </select>
          )}

          {/* Bracket-phase format selectors — league competitions only */}
          {!isKnockout && (
            <>
              <select
                value={bracketStartingScore}
                onChange={(e) => setBracketStartingScore(Number(e.target.value))}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
              >
                {[301, 501, 701].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={bracketBestOf}
                onChange={(e) => setBracketBestOf(Number(e.target.value))}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => <option key={n} value={n}>{n === 1 ? "First to 1" : `Bo${n}`}</option>)}
              </select>
              <select
                value={bracketFinishType}
                onChange={(e) => setBracketFinishType(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
              >
                <option value="DOUBLE_OUT">Double Out</option>
                <option value="STRAIGHT_OUT">Straight Out</option>
                <option value="MASTER_OUT">Master Out</option>
              </select>
            </>
          )}

          <Button onClick={handleGenerate} disabled={isPending} size="sm">
            {isPending ? "Generating…" : nodes?.length ? "Regenerate" : "Generate Bracket"}
          </Button>
        </div>
      </div>

      {nodes?.length ? (
        <BracketView nodes={nodes} competitionId={competitionId} canScore={true} competitionCompleted={competition?.status === "COMPLETED"} />
      ) : (
        <EmptyState
          icon={<Network className="w-10 h-10" />}
          title="No bracket yet"
          description={isKnockout ? "Draw the bracket from the Overview tab" : "Generate a knockout bracket from the league standings"}
        />
      )}
    </div>
  )
}
