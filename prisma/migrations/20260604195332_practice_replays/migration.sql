-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "replayBobs27HitsThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "replayMarksThreshold" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Replay" ADD COLUMN     "gameMode" TEXT,
ADD COLUMN     "practiceContext" JSONB,
ADD COLUMN     "practiceSessionId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;
