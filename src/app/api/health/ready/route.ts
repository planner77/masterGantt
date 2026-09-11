import { handleReadiness } from "@/server/health/readiness-handler-core";
import { getReadiness } from "@/server/health/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return handleReadiness(getReadiness);
}
