import {
  unavailableReadiness,
  type ReadinessResult,
} from "./readiness-core";

export type ReadinessProvider = () => ReadinessResult;

export function handleReadiness(provider: ReadinessProvider): Response {
  let result: ReadinessResult;

  try {
    result = provider();
  } catch {
    result = unavailableReadiness();
  }

  return Response.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
