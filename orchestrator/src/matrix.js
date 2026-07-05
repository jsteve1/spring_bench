/** Default 10-service matrix from docs/01 §4.1 — container_name matches compose service name. */
export const MATRIX_TARGETS = [
  "java8-platform-low",
  "java8-platform-mid",
  "java11-platform-low",
  "java11-platform-high",
  "java17-platform-mid",
  "java17-platform-high",
  "java21-virtual-low",
  "java21-virtual-high",
  "java25-virtual-arm-low",
  "java25-virtual-arm-high",
];

const HOST_PORTS = {
  "java8-platform-low": 8081,
  "java8-platform-mid": 8082,
  "java11-platform-low": 8083,
  "java11-platform-high": 8084,
  "java17-platform-mid": 8085,
  "java17-platform-high": 8086,
  "java21-virtual-low": 8087,
  "java21-virtual-high": 8088,
  "java25-virtual-arm-low": 8089,
  "java25-virtual-arm-high": 8090,
};

export function targetPort(name) {
  return HOST_PORTS[name] ?? 8080;
}

export function assertMatrixTarget(name) {
  if (!MATRIX_TARGETS.includes(name)) {
    const err = new Error(`Unknown matrix target: ${name}`);
    err.status = 404;
    throw err;
  }
}
