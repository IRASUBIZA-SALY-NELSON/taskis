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

On Vercel, set **BACKEND_URL** to the public Spring Boot origin (HTTPS). The frontend calls `/api` on the same host; Next.js proxies those requests so the browser does not hit `http://…:8080` (mixed content).
