import { FixtureCard } from "./FixtureCard"

type Fixture = Parameters<typeof FixtureCard>[0]["fixture"]

interface FixtureListProps {
  fixtures: Fixture[]
  canScore?: boolean
  competitionCompleted?: boolean
}

export function FixtureList({ fixtures, canScore, competitionCompleted }: FixtureListProps) {
  if (!fixtures.length) {
    return <p className="text-muted-foreground text-sm text-center py-8">No fixtures yet.</p>
  }

  // Group by matchday
  const byMatchday: Record<number, Fixture[]> = {}
  for (const f of fixtures) {
    byMatchday[f.matchday] = [...(byMatchday[f.matchday] ?? []), f]
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(byMatchday)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([matchday, fixtures]) => (
          <div key={matchday}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Matchday {matchday}</h3>
            <div className="flex flex-col gap-2">
              {fixtures.map((f) => (
                <FixtureCard key={f.id} fixture={f} canScore={canScore} competitionCompleted={competitionCompleted} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
