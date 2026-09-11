import { NextResponse } from "next/server";

import { getLiveness } from "@/server/health/liveness";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getLiveness(), {
    headers: { "Cache-Control": "no-store" },
  });
}
