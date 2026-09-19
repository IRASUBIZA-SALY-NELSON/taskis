# taskis

Private team messenger: Next.js frontend on port 9091 and Spring Boot API on port 8080.

## Run locally

```bash
# backend
cd backend && ./mvnw spring-boot:run

# frontend
cd frontend && npm ci && npm run dev
```

Open [http://localhost:9091](http://localhost:9091). A seeded admin account is created on first backend start.

## Deploy on Vercel

This repo is a monorepo. The Next.js app lives in `frontend/`, not the repo root.

In the Vercel project: **Settings → General → Root Directory → Edit → `frontend`**, then **Redeploy**.

If Root Directory is left at `.`, Vercel finishes in a few seconds with no Next.js build and `https://tasikisi.vercel.app/` returns 404.

Production API is `https://taskis-api.onrender.com`. On Render set `MONGODB_URI` to the Atlas SRV URI (database name `taskis`). On Atlas Network Access allow `0.0.0.0/0` so Render can connect. Do not commit the URI.
