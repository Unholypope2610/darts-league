"use client"

import { use, useRef, useState } from "react"
import { toBlob } from "html-to-image"
import { Share2 } from "lucide-react"
import { useLeagueTable } from "@/hooks/useLeagueTable"
import { useCompetition } from "@/hooks/useCompetitions"
import { LeagueTable } from "@/components/table/LeagueTable"
import { Skeleton } from "@/components/ui/skeleton"
import type { LeagueTableRow } from "@/types/table"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

function DivisionSection({
  divisionName,
  rows,
  showName,
  showLeader,
}: {
  divisionName: string
  rows: LeagueTableRow[]
  showName: boolean
  showLeader: boolean
}) {
  const captureRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    if (!captureRef.current) return
    setSharing(true)
    try {
      const blob = await toBlob(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: "#09090b",
      })
      if (!blob) return

      const filename = `${divisionName.replace(/\s+/g, "-").toLowerCase()}-standings.png`
      const file = new File([blob], filename, { type: "image/png" })

      if ("share" in navigator && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${divisionName} Standings` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // user cancelled share sheet — no-op
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {showName && <h2 className="font-black text-lg text-white">{divisionName}</h2>}
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-700 text-zinc-400 bg-zinc-800/60 hover:border-zinc-500 hover:text-white active:scale-95 transition-all disabled:opacity-50 ml-auto"
        >
          <Share2 className="w-3.5 h-3.5" />
          {sharing ? "Capturing…" : "Share"}
        </button>
      </div>
      <div ref={captureRef} className="p-1">
        <LeagueTable rows={rows} topQualifyCount={4} showLeader={showLeader} />
      </div>
    </div>
  )
}

export default function TablePage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: divisions, isLoading } = useLeagueTable(competitionId)
  const { data: competition } = useCompetition(competitionId)
  const isActive = competition?.status === "ACTIVE"

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-8">
      {divisions?.map((division) => (
        <DivisionSection
          key={division.divisionId}
          divisionName={division.divisionName}
          rows={division.rows}
          showName={(divisions.length ?? 0) > 1}
          showLeader={isActive}
        />
      ))}
      {!divisions?.length && (
        <p className="text-muted-foreground text-sm">No standings yet — play some matches first.</p>
      )}
    </div>
  )
}
