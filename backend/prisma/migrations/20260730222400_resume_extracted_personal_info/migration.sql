-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "extractedAddress" VARCHAR(100),
ADD COLUMN     "extractedEmail" VARCHAR(255),
ADD COLUMN     "extractedFirstName" VARCHAR(100),
ADD COLUMN     "extractedLastName" VARCHAR(100),
ADD COLUMN     "extractedPhone" VARCHAR(15);
