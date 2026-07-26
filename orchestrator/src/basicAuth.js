import crypto from "crypto";

const USER = process.env.ORCH_BASIC_USER || "";
const PASS = process.env.ORCH_BASIC_PASS || "";

/**
 * Guard for exposing the orchestrator beyond localhost (e.g. through a tunnel).
 * The control API can start/stop containers via the Docker socket, so a public
 * hostname without auth is a remote kill switch.
 *
 * Enabled only when both ORCH_BASIC_USER and ORCH_BASIC_PASS are set, so local
 * development stays frictionless.
 */
export const authEnabled = Boolean(USER && PASS);

const REALM = 'Basic realm="spring-bench orchestrator", charset="UTF-8"';

/** Constant-time compare over digests so inputs of differing length are safe. */
function matches(a, b) {
  const da = crypto.createHash("sha256").update(String(a)).digest();
  const db = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}

export function credentialsValid(authorization) {
  if (!authorization) {
    return false;
  }
  const [scheme, encoded] = authorization.split(" ");
  if (!/^basic$/i.test(scheme || "") || !encoded) {
    return false;
  }
  let decoded;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) {
    return false;
  }
  return matches(decoded.slice(0, idx), USER) && matches(decoded.slice(idx + 1), PASS);
}

/** Express middleware; `/health` stays open so uptime checks work unauthenticated. */
export function basicAuth(req, res, next) {
  if (!authEnabled || req.path === "/health") {
    next();
    return;
  }
  if (credentialsValid(req.headers.authorization)) {
    next();
    return;
  }
  res.set("WWW-Authenticate", REALM);
  res.status(401).json({ error: "Unauthorized" });
}

/** ws verifyClient hook — the WebSocket upgrade bypasses Express middleware. */
export function verifyWsClient(info, done) {
  if (!authEnabled) {
    done(true);
    return;
  }
  if (credentialsValid(info.req.headers.authorization)) {
    done(true);
    return;
  }
  done(false, 401, "Unauthorized");
}
