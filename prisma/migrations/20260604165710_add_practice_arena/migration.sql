-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "gameMode" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'STANDARD',
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "winnerId" TEXT,
    "targetSequence" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "turnOrder" INTEGER NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "isEliminated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PracticePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeRound_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PracticePlayer" ADD CONSTRAINT "PracticePlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePlayer" ADD CONSTRAINT "PracticePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRound" ADD CONSTRAINT "PracticeRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
