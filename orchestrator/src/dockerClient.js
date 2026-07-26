import Docker from "dockerode";
import fs from "fs";

const SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

let docker;

export function dockerAvailable() {
  return fs.existsSync(SOCKET);
}

export function getDocker() {
  if (!dockerAvailable()) {
    const err = new Error("Docker socket not available");
    err.status = 503;
    throw err;
  }
  if (!docker) {
    docker = new Docker({ socketPath: SOCKET });
  }
  return docker;
}

export async function inspectContainer(name) {
  try {
    return await getDocker().getContainer(name).inspect();
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function containerState(name) {
  const info = await inspectContainer(name);
  if (!info) {
    return "missing";
  }
  return info.State.Status;
}
