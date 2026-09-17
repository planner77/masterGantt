import { NextResponse } from "next/server";

import { getLiveness } from "@/server/health/liveness";
import { withApiRequestLogging } from "@/server/http/request-context-core";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return withApiRequestLogging(
    request,
    { route: "/api/health/live", trustProxy: process.env.TRUST_PROXY },
    () => NextResponse.json(getLiveness(), {
      headers: { "Cache-Control": "no-store" },
    }),
  );
}
