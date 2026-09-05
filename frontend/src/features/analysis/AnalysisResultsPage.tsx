import { Link } from "react-router-dom"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import {
  useAnalysisResults,
  type EducationItem,
  type WorkExperienceItem,
  type SkillItem,
  type LanguageItem,
  type CertificationItem,
} from "./useAnalysisResults"

// Dates are stored as midnight-UTC calendar dates with no meaningful time
// component — getUTCFullYear (not getFullYear) avoids the local-timezone
// rollback that would otherwise show the wrong year west of UTC (e.g.
// "1840-01-01T00:00:00Z" reading as 1839 in a negative-offset timezone).
function formatDateRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ? new Date(startDate).getUTCFullYear().toString() : "Unknown"
  const end = endDate ? new Date(endDate).getUTCFullYear().toString() : "Present"
  return `${start} – ${end}`
}

function EducationSection({ items }: { items: EducationItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Education
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.institution}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateRange(item.startDate, item.endDate)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WorkExperienceSection({ items }: { items: WorkExperienceItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Work Experience
      </h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3">
            <p className="font-medium">{item.position}</p>
            <p className="text-sm text-muted-foreground">{item.company}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateRange(item.startDate, item.endDate)}
            </p>
            {item.description && (
              <p className="mt-2 text-sm">{item.description}</p>
            )}
            {item.responsibilities.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {item.responsibilities.map((r) => (
                  <li key={r.id}>{r.text}</li>
                ))}
              </ul>
            )}
            {item.projects.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {item.projects.map((project) => (
                  <div key={project.id} className="rounded-md bg-muted/40 p-2">
                    <p className="text-sm font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-muted-foreground">{project.description}</p>
                    )}
                    {project.achievements.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-sm">
                        {project.achievements.map((a) => (
                          <li key={a.id}>{a.text}</li>
                        ))}
                      </ul>
                    )}
                    {project.stack.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stack: {project.stack.map((s) => s.name).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SkillsSection({ items }: { items: SkillItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Skills
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-full border border-border px-3 py-1 text-sm"
          >
            {item.name}
            {item.proficiency ? ` · ${item.proficiency}` : ""}
          </li>
        ))}
      </ul>
    </section>
  )
}

function LanguagesSection({ items }: { items: LanguageItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Languages
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-full border border-border px-3 py-1 text-sm"
          >
            {item.name}
            {item.proficiency ? ` · ${item.proficiency}` : ""}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CertificationsSection({ items }: { items: CertificationItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Certifications
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3">
            <p className="font-medium">{item.name}</p>
            {item.issuer && <p className="text-sm text-muted-foreground">{item.issuer}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AnalysisResultsPage() {
  const { data, isPending } = useAnalysisResults()

  if (isPending) {
    return (
      <Card className="max-w-2xl">
        <CardContent>
          <p role="status" className="text-sm text-muted-foreground">
            Loading your analysis…
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.hasAnalysis) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            No analysis available yet. Upload a CV to get started.
          </p>
          <Link to="/workspace/upload" className="text-sm font-medium underline">
            Go to Upload
          </Link>
        </CardContent>
      </Card>
    )
  }

  const { personalInfo, education, workExperience, skills, languages, certifications } = data

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Personal Info
          </h2>
          <p className="font-medium">
            {personalInfo.firstName} {personalInfo.lastName}
          </p>
          {personalInfo.email && <p className="text-sm">{personalInfo.email}</p>}
          {personalInfo.phone && <p className="text-sm">{personalInfo.phone}</p>}
          {personalInfo.address && <p className="text-sm">{personalInfo.address}</p>}
        </section>

        <EducationSection items={education} />
        <WorkExperienceSection items={workExperience} />
        <SkillsSection items={skills} />
        <LanguagesSection items={languages} />
        <CertificationsSection items={certifications} />
      </CardContent>
    </Card>
  )
}
