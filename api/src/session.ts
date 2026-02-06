import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

const SESSION_COOKIE = "kdl_session";
const CSRF_COOKIE = "kdl_csrf";

type SessionPayload = {
  username: string;
  isAdmin: boolean;
  exp: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(payload: SessionPayload) {
  const body = base64url(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (sign(body) !== signature) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (Date.now() > parsed.exp) return null;
  return parsed;
}

export function issueSession(reply: FastifyReply, username: string, isAdmin: boolean) {
  const payload: SessionPayload = {
    username,
    isAdmin,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const csrfToken = crypto.randomBytes(24).toString("hex");
  reply.setCookie(SESSION_COOKIE, createSessionToken(payload), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  reply.setCookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
  reply.clearCookie(CSRF_COOKIE, { path: "/" });
}

export function getSession(req: FastifyRequest) {
  const session = verifySessionToken(req.cookies[SESSION_COOKIE]);
  const csrfCookie = req.cookies[CSRF_COOKIE];
  return { session, csrfCookie };
}

export function assertCsrf(req: FastifyRequest): boolean {
  const header = req.headers["x-csrf-token"];
  const csrfHeader = Array.isArray(header) ? header[0] : header;
  return Boolean(csrfHeader && req.cookies[CSRF_COOKIE] && csrfHeader === req.cookies[CSRF_COOKIE]);
}

