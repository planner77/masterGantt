import { spawnSync } from "node:child_process";

const [baseUrl, containerName] = process.argv.slice(2);
const allowedContainers = new Set([
  "mastergantt-commit-smoke",
  "mastergantt-release-smoke",
  "mastergantt-w22-local",
]);
if (!baseUrl || !allowedContainers.has(containerName)) {
  throw new Error("usage: verify-registry-api-smoke.mjs BASE_URL {mastergantt-commit-smoke|mastergantt-release-smoke|mastergantt-w22-local}");
}

const origin = "https://gantt.example.invalid";
const request = (path, options = {}) => fetch(new URL(path, baseUrl), {
  ...options,
  signal: AbortSignal.timeout(10_000),
  headers: { Origin: origin, "Content-Type": "application/json", ...(options.headers ?? {}) },
});

const projectResponse = await request("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: "Registry smoke", ownerName: "Registry smoke owner", description: "commit image", editPassword: "Smoke123456!" }),
});
if (projectResponse.status !== 201) throw new Error(`project create status ${projectResponse.status}`);
const project = (await projectResponse.json()).data.project;
const cookie = projectResponse.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
if (!cookie) throw new Error("project create did not issue an edit session cookie");

const taskPath = `/api/projects/${encodeURIComponent(project.publicId)}/tasks`;
const denied = await request(taskPath, { method: "POST", body: JSON.stringify({ name: "Denied", type: "task", start: "2026-01-05", duration: 1, progress: 0 }) });
if (denied.status !== 401) throw new Error(`unauthenticated task mutation status ${denied.status}`);

const taskResponse = await request(taskPath, {
  method: "POST",
  headers: { Cookie: cookie, "If-Match": `"${project.revision}"` },
  body: JSON.stringify({ externalId: "registry-smoke-task", name: "Persisted task", type: "task", start: "2026-01-05", duration: 1, progress: 0 }),
});
if (taskResponse.status !== 201) throw new Error(`authenticated task mutation status ${taskResponse.status}`);

const snapshotResponse = await fetch(new URL(`/api/projects/${encodeURIComponent(project.publicId)}`, baseUrl), { signal: AbortSignal.timeout(10_000) });
const snapshot = await snapshotResponse.json();
if (snapshotResponse.status !== 200 || snapshot.data.project.ownerName !== "Registry smoke owner" || !snapshot.data.tasks.some((task) => task.externalId === "registry-smoke-task")) throw new Error("persisted project owner or task missing from readonly snapshot");

const restart = spawnSync("docker", ["restart", containerName], { encoding: "utf8", timeout: 30_000 });
if (restart.status !== 0) throw new Error(`docker restart failed: ${restart.stderr}`);

let ready = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const response = await fetch(new URL("/api/health/ready", baseUrl), { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // The process is expected to be unavailable during restart.
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
if (!ready) throw new Error("readiness did not recover after container restart");

const afterRestart = await fetch(new URL(`/api/projects/${encodeURIComponent(project.publicId)}`, baseUrl), { signal: AbortSignal.timeout(10_000) });
const afterSnapshot = await afterRestart.json();
if (afterRestart.status !== 200 || afterSnapshot.data.project.revision !== project.revision + 1 || afterSnapshot.data.project.ownerName !== "Registry smoke owner" || !afterSnapshot.data.tasks.some((task) => task.externalId === "registry-smoke-task")) {
  throw new Error("API project owner, task, or revision did not persist across container restart");
}

console.log("Registry API smoke passed: project create/owner, auth denial, task create, readonly persistence, restart persistence.");
