CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "ContentType" AS ENUM ('creature', 'post');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "githubId" TEXT NOT NULL UNIQUE,
  "username" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Creature" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "nameJa" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "scientific" TEXT,
  "foundAt" TIMESTAMP(3),
  "locationText" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CreaturePhoto" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "creatureId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreaturePhoto_creatureId_fkey"
    FOREIGN KEY ("creatureId")
    REFERENCES "Creature"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "Post" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "coverUrl" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "SearchChunk" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "contentType" "ContentType" NOT NULL,
  "contentId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "chunkText" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "SearchChunk_contentType_contentId_idx"
  ON "SearchChunk"("contentType", "contentId");

