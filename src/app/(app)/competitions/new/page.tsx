import { PageHeader } from "@/components/shared/PageHeader"
import { CompetitionWizard } from "@/components/competitions/CompetitionWizard"

export default function NewCompetitionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New Competition" description="Set up a new league or tournament" />
      <CompetitionWizard />
    </div>
  )
}
