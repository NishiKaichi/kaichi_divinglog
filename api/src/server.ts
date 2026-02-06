import crypto from "node:crypto";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { prisma } from "./db.js";
import { adminAllowlist, env } from "./env.js";
import { assertCsrf, clearSession, getSession, issueSession } from "./session.js";
import { reindexAllContents, semanticSearch, upsertContentChunks } from "./search.js";
import { slugify } from "./utils.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
});
await app.register(cookie);

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const { session } = getSession(req);
  if (!session?.isAdmin) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !assertCsrf(req)) {
    return reply.code(403).send({ error: "csrf_mismatch" });
  }
}

app.get("/health", async () => ({ ok: true }));

app.get("/auth/github/start", async (req, reply) => {
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  reply.setCookie("oauth_state", state, { path: "/", httpOnly: true, sameSite: "none", secure: true });
  reply.setCookie("oauth_verifier", verifier, { path: "/", httpOnly: true, sameSite: "none", secure: true });
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: "read:user",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get("/auth/github/callback", async (req, reply) => {
  const query = req.query as { code?: string; state?: string };
  if (!query.code || !query.state || req.cookies.oauth_state !== query.state) {
    return reply.code(400).send({ error: "invalid_oauth_state" });
  }
  const verifier = req.cookies.oauth_verifier;
  if (!verifier) return reply.code(400).send({ error: "missing_verifier" });

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: query.code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      state: query.state,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    req.log.error({ status: tokenRes.status }, "oauth token exchange failed");
    return reply.code(500).send({ error: "oauth_exchange_failed" });
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return reply.code(500).send({ error: "oauth_token_missing" });
  }
  const meRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "kaichi-divinglog",
    },
  });
  if (!meRes.ok) {
    req.log.error({ status: meRes.status }, "github user lookup failed");
    return reply.code(500).send({ error: "github_user_failed" });
  }
  const userData = (await meRes.json()) as { id: number; login: string };
  const username = userData.login;
  const isAdmin = adminAllowlist.has(username);
  if (!isAdmin) return reply.code(403).send({ error: "not_in_allowlist" });

  await prisma.user.upsert({
    where: { githubId: String(userData.id) },
    update: { username, role: "admin" },
    create: { githubId: String(userData.id), username, role: "admin" },
  });
  issueSession(reply, username, true);
  return reply.redirect(env.FRONTEND_ORIGIN + "/#/admin");
});

app.get("/auth/me", async (req) => {
  const { session } = getSession(req);
  if (!session) return { authenticated: false, isAdmin: false };
  return { authenticated: true, username: session.username, isAdmin: session.isAdmin };
});

app.post("/auth/logout", async (req, reply) => {
  clearSession(reply);
  return { ok: true };
});

app.post("/admin/cloudinary-signature", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  return {
    timestamp,
    signature,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
  };
});

app.get("/creatures", async () => {
  return prisma.creature.findMany({
    include: { photos: true },
    orderBy: { updatedAt: "desc" },
  });
});

app.get("/creatures/:slug", async (req, reply) => {
  const params = req.params as { slug: string };
  const record = await prisma.creature.findUnique({
    where: { slug: params.slug },
    include: { photos: { orderBy: { order: "asc" } } },
  });
  if (!record) return reply.code(404).send({ error: "not_found" });
  return record;
});

app.post("/admin/creatures", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const body = req.body as {
    nameJa: string;
    description: string;
    slug?: string;
    scientific?: string;
    foundAt?: string;
    locationText?: string;
    tags?: string[];
    photos?: Array<{ url: string; alt?: string; order?: number }>;
  };
  const slug = body.slug?.trim() || slugify(body.nameJa);
  const created = await prisma.creature.create({
    data: {
      nameJa: body.nameJa,
      description: body.description,
      slug,
      scientific: body.scientific,
      foundAt: body.foundAt ? new Date(body.foundAt) : null,
      locationText: body.locationText,
      tags: body.tags ?? [],
      photos: {
        create: (body.photos ?? []).map((p) => ({ url: p.url, alt: p.alt, order: p.order ?? 0 })),
      },
    },
    include: { photos: true },
  });
  await upsertContentChunks({
    contentType: "creature",
    contentId: created.id,
    url: `/creatures/${created.slug}`,
    title: created.nameJa,
    text: [created.nameJa, created.scientific, created.locationText, created.description].filter(Boolean).join("\n"),
  });
  return created;
});

app.put("/admin/creatures/:id", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const params = req.params as { id: string };
  const body = req.body as {
    nameJa?: string;
    description?: string;
    slug?: string;
    scientific?: string;
    foundAt?: string;
    locationText?: string;
    tags?: string[];
  };
  const updated = await prisma.creature.update({
    where: { id: params.id },
    data: {
      nameJa: body.nameJa,
      description: body.description,
      slug: body.slug ? slugify(body.slug) : undefined,
      scientific: body.scientific,
      foundAt: body.foundAt ? new Date(body.foundAt) : undefined,
      locationText: body.locationText,
      tags: body.tags,
    },
    include: { photos: true },
  });
  await upsertContentChunks({
    contentType: "creature",
    contentId: updated.id,
    url: `/creatures/${updated.slug}`,
    title: updated.nameJa,
    text: [updated.nameJa, updated.scientific, updated.locationText, updated.description].filter(Boolean).join("\n"),
  });
  return updated;
});

app.delete("/admin/creatures/:id", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const params = req.params as { id: string };
  await prisma.creature.delete({ where: { id: params.id } });
  await prisma.searchChunk.deleteMany({ where: { contentType: "creature", contentId: params.id } });
  return { ok: true };
});

app.get("/posts", async () => {
  return prisma.post.findMany({ orderBy: { publishedAt: "desc" } });
});

app.get("/posts/:slug", async (req, reply) => {
  const params = req.params as { slug: string };
  const record = await prisma.post.findUnique({ where: { slug: params.slug } });
  if (!record) return reply.code(404).send({ error: "not_found" });
  return record;
});

app.post("/admin/posts", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const body = req.body as {
    title: string;
    body: string;
    slug?: string;
    coverUrl?: string;
    tags?: string[];
    publishedAt?: string;
  };
  const slug = body.slug?.trim() || slugify(body.title);
  const created = await prisma.post.create({
    data: {
      title: body.title,
      body: body.body,
      slug,
      coverUrl: body.coverUrl,
      tags: body.tags ?? [],
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
    },
  });
  await upsertContentChunks({
    contentType: "post",
    contentId: created.id,
    url: `/blog/${created.slug}`,
    title: created.title,
    text: `${created.title}\n${created.body}`,
  });
  return created;
});

app.put("/admin/posts/:id", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const params = req.params as { id: string };
  const body = req.body as {
    title?: string;
    body?: string;
    slug?: string;
    coverUrl?: string;
    tags?: string[];
    publishedAt?: string;
  };
  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      title: body.title,
      body: body.body,
      slug: body.slug ? slugify(body.slug) : undefined,
      coverUrl: body.coverUrl,
      tags: body.tags,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
    },
  });
  await upsertContentChunks({
    contentType: "post",
    contentId: updated.id,
    url: `/blog/${updated.slug}`,
    title: updated.title,
    text: `${updated.title}\n${updated.body}`,
  });
  return updated;
});

app.delete("/admin/posts/:id", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const params = req.params as { id: string };
  await prisma.post.delete({ where: { id: params.id } });
  await prisma.searchChunk.deleteMany({ where: { contentType: "post", contentId: params.id } });
  return { ok: true };
});

app.get("/search", async (req, reply) => {
  const query = req.query as { q?: string; limit?: string };
  const q = query.q?.trim();
  if (!q) return reply.code(400).send({ error: "q is required" });
  const limit = Math.max(1, Math.min(20, Number(query.limit ?? 10)));
  const results = await semanticSearch(q, limit);
  return { query: q, results };
});

app.post("/admin/search/reindex-all", async (req, reply) => {
  const denied = requireAdmin(req, reply);
  if (denied) return denied;
  const count = await reindexAllContents();
  return { ok: true, count };
});

app.setErrorHandler((error, req, reply) => {
  req.log.error(error, "request failed");
  reply.code(500).send({ error: "internal_error" });
});

const shutdown = async () => {
  await prisma.$disconnect();
  await app.close();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
