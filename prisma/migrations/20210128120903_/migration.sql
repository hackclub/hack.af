-- CreateTable
CREATE TABLE "Link" (
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,

    PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "clientIP" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "bot" BOOLEAN NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT,

    PRIMARY KEY ("id")
);
