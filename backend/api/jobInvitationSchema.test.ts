import { readFileSync, readdirSync } from "fs";
import path from "path";

// Spec: "Automated duplicate is rejected by the uniqueness rule" and "Manual
// submissions may repeat". The rule is enforced by Postgres, which this unit
// suite deliberately does not start (see the CI pipeline's design), so this
// guards the schema and the migration that implement it. The live-database
// behavior is exercised in the change's manual verification step.
const PRISMA_DIR = path.join(__dirname, "../prisma");
const schema = readFileSync(path.join(PRISMA_DIR, "schema.prisma"), "utf-8");

function jobInvitationMigrationSql(): string {
  const dir = readdirSync(path.join(PRISMA_DIR, "migrations")).find((d) => d.endsWith("_job_invitations"));
  if (!dir) throw new Error("job_invitations migration not found");
  return readFileSync(path.join(PRISMA_DIR, "migrations", dir, "migration.sql"), "utf-8");
}

describe("JobInvitation persistence contract", () => {
  it("declares uniqueness over (candidateId, source, externalId)", () => {
    expect(schema).toMatch(/@@unique\(\[candidateId, source, externalId\]\)/);
  });

  it("keeps externalId nullable so manual submissions (NULL) can repeat", () => {
    expect(schema).toMatch(/externalId\s+String\?/);
    expect(jobInvitationMigrationSql()).toMatch(/"externalId" VARCHAR\(255\),/);
  });

  it("creates the unique index in the migration", () => {
    expect(jobInvitationMigrationSql()).toMatch(
      /CREATE UNIQUE INDEX "job_invitations_candidateId_source_externalId_key" ON "job_invitations"\("candidateId", "source", "externalId"\)/,
    );
  });

  it("defaults the source to manual_text and includes the future LinkedIn sources", () => {
    const sql = jobInvitationMigrationSql();
    expect(sql).toContain(`'manual_text', 'linkedin_message', 'linkedin_notification'`);
    expect(sql).toContain(`"source" "InvitationSource" NOT NULL DEFAULT 'manual_text'`);
  });

  it("removes a candidate's invitations when the candidate is deleted", () => {
    expect(jobInvitationMigrationSql()).toMatch(/ON DELETE CASCADE/);
  });
});
