-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "Visit" ALTER COLUMN "doublesAttempted" SET DEFAULT 0;
