import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    vercel: Boolean(process.env.VERCEL),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    deployedAt: new Date().toISOString(),
  });
}
