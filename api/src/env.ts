import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  ADMIN_GITHUB_USERNAMES: z.string().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
});

export const env = envSchema.parse(process.env);

export const adminAllowlist = new Set(
  env.ADMIN_GITHUB_USERNAMES.split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

