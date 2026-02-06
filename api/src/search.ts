import { prisma } from "./db.js";
import { env } from "./env.js";
import { chunkText, toVectorLiteral } from "./utils.js";

type Searchable = {
  contentType: "creature" | "post";
  contentId: string;
  url: string;
  title: string;
  text: string;
};

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`embedding_failed: ${response.status} ${body}`);
  }
  const data = (await response.json()) as { data: [{ embedding: number[] }] };
  return data.data[0].embedding;
}

export async function upsertContentChunks(content: Searchable) {
  const chunks = chunkText(content.text);
  await prisma.$transaction(async (tx) => {
    await tx.searchChunk.deleteMany({
      where: { contentType: content.contentType, contentId: content.contentId },
    });
    for (const piece of chunks) {
      const embedding = await generateEmbedding(piece);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SearchChunk" ("id","contentType","contentId","url","title","chunkText","embedding","createdAt","updatedAt")
         VALUES (gen_random_uuid(), $1::"ContentType", $2::uuid, $3, $4, $5, $6::vector, NOW(), NOW())`,
        content.contentType,
        content.contentId,
        content.url,
        content.title,
        piece,
        toVectorLiteral(embedding),
      );
    }
  });
}

export async function reindexAllContents() {
  const creatures = await prisma.creature.findMany();
  const posts = await prisma.post.findMany();
  let count = 0;
  for (const c of creatures) {
    await upsertContentChunks({
      contentType: "creature",
      contentId: c.id,
      url: `/creatures/${c.slug}`,
      title: c.nameJa,
      text: [c.nameJa, c.scientific, c.locationText, c.description].filter(Boolean).join("\n"),
    });
    count += 1;
  }
  for (const p of posts) {
    await upsertContentChunks({
      contentType: "post",
      contentId: p.id,
      url: `/blog/${p.slug}`,
      title: p.title,
      text: `${p.title}\n${p.body}`,
    });
    count += 1;
  }
  return count;
}

export async function semanticSearch(query: string, limit = 10) {
  const embedding = await generateEmbedding(query);
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "contentType", "title", "url", "chunkText",
      1 - ("embedding" <=> $1::vector) AS score
     FROM "SearchChunk"
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    toVectorLiteral(embedding),
    limit,
  )) as Array<{
    contentType: "creature" | "post";
    title: string;
    url: string;
    chunkText: string;
    score: number;
  }>;

  return rows.map((r) => ({
    type: r.contentType,
    title: r.title,
    url: r.url,
    snippet: r.chunkText.slice(0, 160),
    score: Number(r.score.toFixed(4)),
  }));
}
