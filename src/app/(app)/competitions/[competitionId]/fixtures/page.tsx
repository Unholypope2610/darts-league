"use client"

import { use, useState } from "react"
import { useFixtures } from "@/hooks/useFixtures"
import { useCompetition } from "@/hooks/useCompetitions"
import { FixtureList } from "@/components/fixtures/FixtureList"
import { GenerateFixturesModal } from "@/components/fixtures/GenerateFixturesModal"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function FixturesPage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: competition } = useCompetition(competitionId)
  const { data: fixtures, isLoading } = useFixtures(competitionId)
  const [showGenerate, setShowGenerate] = useState(false)

  const hasFixtures = fixtures && fixtures.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Fixtures</h2>
        {!hasFixtures && (competition?.status === "DRAFT" || competition?.status === "ACTIVE") && (
          <Button onClick={() => setShowGenerate(true)} size="sm">
            Generate Fixtures
          </Button>
        )}
        {hasFixtures && (
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            Regenerate
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <FixtureList fixtures={fixtures ?? []} canScore={true} competitionCompleted={competition?.status === "COMPLETED"} />
      )}

      <GenerateFixturesModal
        competitionId={competitionId}
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
      />
    </div>
  )
}
