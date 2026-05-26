-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "entrantCount" INTEGER,
ADD COLUMN     "isRanked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RankingPoint" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "placementLabel" TEXT NOT NULL,
    "entrantCount" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingPoint_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RankingPoint" ADD CONSTRAINT "RankingPoint_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPoint" ADD CONSTRAINT "RankingPoint_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
