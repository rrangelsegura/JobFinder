-- AlterTable
ALTER TABLE "educations" ALTER COLUMN "startDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "proficiency" VARCHAR(50);
