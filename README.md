# Kaichi divinglog (Monorepo)

`frontend/` は GitHub Pages 配信、`api/` は Render + Supabase を前提にした構成です。

## 1. 構成
- `frontend`: React + TypeScript + Vite + HashRouter
- `api`: Fastify + Prisma + PostgreSQL(pgvector) + GitHub OAuth + Cloudinary署名

## 2. ローカル起動
1. `api/.env.example` を `api/.env` にコピーして値を設定
2. `frontend/.env.example` を `frontend/.env` にコピーして値を設定
3. API
   - `cd api`
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run dev`
4. Frontend
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## 3. 本番デプロイ
- Frontend: `.github/workflows/pages.yml` で GitHub Pages へデプロイ
- API: `api/render.yaml` を使って Render へデプロイ
- DB: Supabase Postgres で `vector` 拡張を有効化

## 4. 実装済みエンドポイント
- Auth: `/auth/github/start`, `/auth/github/callback`, `/auth/me`, `/auth/logout`
- Public: `/creatures`, `/creatures/:slug`, `/posts`, `/posts/:slug`, `/search`
- Admin: `/admin/creatures`, `/admin/posts`, `/admin/cloudinary-signature`, `/admin/search/reindex-all`

