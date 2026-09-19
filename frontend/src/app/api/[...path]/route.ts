import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const backend = (process.env.BACKEND_URL || '').replace(/\/$/, '');

async function proxy(req: NextRequest, path: string[]) {
  if (!backend) {
    return NextResponse.json(
      {
        error:
          'The Java API is not reachable from Vercel. Start the inzovu server (or any public Spring Boot host) and set BACKEND_URL to its HTTPS origin.',
      },
      { status: 503 },
    );
  }

  const dest = `${backend}/api/${path.join('/')}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete('host');
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  try {
    const res = await fetch(dest, { method: req.method, headers, body, redirect: 'manual' });
    const out = new Headers(res.headers);
    out.delete('content-encoding');
    return new NextResponse(res.body, { status: res.status, headers: out });
  } catch {
    return NextResponse.json({ error: `Could not reach API at ${backend}` }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function PUT(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
