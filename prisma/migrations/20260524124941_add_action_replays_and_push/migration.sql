-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "replayCheckoutThreshold" INTEGER NOT NULL DEFAULT 69,
ADD COLUMN     "replayScoreThreshold" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "scoreThrown" INTEGER NOT NULL,
    "isCheckout" BOOLEAN NOT NULL DEFAULT false,
    "remainder" INTEGER NOT NULL,
    "opponentName" TEXT NOT NULL,
    "playerLegsWon" INTEGER NOT NULL,
    "oppLegsWon" INTEGER NOT NULL,
    "startingScore" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
