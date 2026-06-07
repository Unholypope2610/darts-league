-- AlterTable
ALTER TABLE "PracticePlayer" ADD COLUMN     "botLevel" INTEGER,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PracticeRound" ADD COLUMN     "legNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PracticeSession" ADD COLUMN     "finishType" TEXT NOT NULL DEFAULT 'DOUBLE_OUT',
ADD COLUMN     "isBotGame" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legsTarget" INTEGER,
ADD COLUMN     "startingScore" INTEGER;
