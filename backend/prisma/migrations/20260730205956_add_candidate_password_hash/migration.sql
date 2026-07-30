/*
  Warnings:

  - Added the required column `passwordHash` to the `candidates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "passwordHash" VARCHAR(255) NOT NULL;
