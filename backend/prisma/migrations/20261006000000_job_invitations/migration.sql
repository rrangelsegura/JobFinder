-- CreateEnum
CREATE TYPE "InvitationSource" AS ENUM ('manual_text', 'linkedin_message', 'linkedin_notification');

-- CreateEnum
CREATE TYPE "InvitationIntent" AS ENUM ('interested', 'request_more_info', 'decline');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "job_invitations" (
    "id" SERIAL NOT NULL,
    "source" "InvitationSource" NOT NULL DEFAULT 'manual_text',
    "externalId" VARCHAR(255),
    "rawText" TEXT NOT NULL,
    "intent" "InvitationIntent" NOT NULL DEFAULT 'interested',
    "status" "InvitationStatus" NOT NULL DEFAULT 'processing',
    "recruiterName" VARCHAR(200),
    "recruiterTitle" VARCHAR(250),
    "company" VARCHAR(250),
    "roleTitle" VARCHAR(250),
    "location" VARCHAR(250),
    "language" VARCHAR(10),
    "callToAction" VARCHAR(500),
    "draftReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" INTEGER NOT NULL,

    CONSTRAINT "job_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_invitations_candidateId_source_externalId_key" ON "job_invitations"("candidateId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "job_invitations" ADD CONSTRAINT "job_invitations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

