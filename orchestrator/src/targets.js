import { assertMatrixTarget, MATRIX_TARGETS, targetPort } from "./matrix.js";
import { containerState, getDocker, inspectContainer } from "./dockerClient.js";

const HEALTH_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 5000);
const MATRIX_INTERNAL_PORT = process.env.MATRIX_INTERNAL_PORT || "8080";

export async function fetchTargetHealth(name) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`http://${name}:${MATRIX_INTERNAL_PORT}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function describeTarget(name) {
  assertMatrixTarget(name);
  const state = await containerState(name);
  const health = state === "running" ? await fetchTargetHealth(name) : null;
  return {
    name,
    port: targetPort(name),
    state,
    health,
  };
}

export async function listTargets() {
  return Promise.all(MATRIX_TARGETS.map((name) => describeTarget(name)));
}

async function requireContainer(name) {
  const info = await inspectContainer(name);
  if (!info) {
    const err = new Error(
      `Container '${name}' not found. Create it with: docker compose up -d ${name}`,
    );
    err.status = 404;
    throw err;
  }
  return getDocker().getContainer(name);
}

export async function startTarget(name) {
  assertMatrixTarget(name);
  const container = await requireContainer(name);
  const state = await containerState(name);
  if (state !== "running") {
    await container.start();
  }
  return {
    name,
    action: "start",
    status: "ok",
    state: await containerState(name),
  };
}

export async function stopTarget(name) {
  assertMatrixTarget(name);
  const container = await requireContainer(name);
  const state = await containerState(name);
  if (state === "running") {
    await container.stop();
  }
  return {
    name,
    action: "stop",
    status: "ok",
    state: await containerState(name),
  };
}

export async function restartTarget(name) {
  assertMatrixTarget(name);
  const container = await requireContainer(name);
  await container.restart();
  return {
    name,
    action: "restart",
    status: "ok",
    state: await containerState(name),
  };
}
