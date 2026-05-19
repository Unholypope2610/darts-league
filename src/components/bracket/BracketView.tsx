import { BracketNode } from "./BracketNode"

type Node = Parameters<typeof BracketNode>[0]["node"]

interface BracketViewProps {
  nodes: Node[]
  canScore?: boolean
}

export function BracketView({ nodes, canScore }: BracketViewProps) {
  // Group by round, sort descending (quarters before semis before final)
  const byRound: Record<number, Node[]> = {}
  for (const n of nodes) {
    byRound[n.round] = [...(byRound[n.round] ?? []), n].sort((a, b) => a.position - b.position)
  }

  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => b - a) // 4, 2, 1 for quarter, semi, final

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 items-center min-w-max p-4">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-6 justify-around" style={{ minHeight: `${byRound[round].length * 140}px` }}>
            {byRound[round].map((node) => (
              <BracketNode key={node.id} node={node} canScore={canScore} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
