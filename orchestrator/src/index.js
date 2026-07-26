import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { dockerAvailable } from "./dockerClient.js";
import {
  listTargets,
  restartTarget,
  startTarget,
  stopTarget,
} from "./targets.js";
import { collectMatrixStats } from "./stats.js";
import { queueLoadTest } from "./loadtest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/stats/stream" });

const PORT = process.env.PORT || 3000;
const RUNS_DIR = process.env.RUNS_DIR || path.join(__dirname, "..", "runs");
const DASHBOARD_DIST =
  process.env.DASHBOARD_DIST || path.join(__dirname, "..", "..", "dashboard", "dist");
const STATS_INTERVAL_MS = Number(process.env.STATS_INTERVAL_MS || 2000);

fs.mkdirSync(RUNS_DIR, { recursive: true });

app.use(express.json());

if (fs.existsSync(DASHBOARD_DIST)) {
  app.use(express.static(DASHBOARD_DIST));
}

app.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    dockerSocket: dockerAvailable(),
  });
});

app.get("/api/targets", async (_req, res, next) => {
  try {
    res.json(await listTargets());
  } catch (err) {
    next(err);
  }
});

app.post("/api/targets/:name/start", async (req, res, next) => {
  try {
    res.json(await startTarget(req.params.name));
  } catch (err) {
    next(err);
  }
});

app.post("/api/targets/:name/stop", async (req, res, next) => {
  try {
    res.json(await stopTarget(req.params.name));
  } catch (err) {
    next(err);
  }
});

app.post("/api/targets/:name/restart", async (req, res, next) => {
  try {
    res.json(await restartTarget(req.params.name));
  } catch (err) {
    next(err);
  }
});

/** One-shot JSON snapshot (same payload as WS frames). */
app.get("/api/stats", async (_req, res, next) => {
  try {
    if (!dockerAvailable()) {
      res.status(503).json({ error: "Docker socket not available" });
      return;
    }
    res.json(await collectMatrixStats());
  } catch (err) {
    next(err);
  }
});

app.post("/api/loadtest", (req, res, next) => {
  try {
    if (!dockerAvailable()) {
      res.status(503).json({ error: "Docker socket not available" });
      return;
    }
    const record = queueLoadTest(req.body || {});
    res.status(202).json(record);
  } catch (err) {
    next(err);
  }
});

app.get("/api/runs", (_req, res) => {
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json") && !f.includes(path.sep));
  const runs = files
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, file), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  res.json(runs);
});

app.get("/api/runs/:id", (req, res) => {
  const file = path.join(RUNS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal error",
  });
});

let latestStats = {
  ts: new Date().toISOString(),
  source: "docker",
  targets: [],
  note: dockerAvailable() ? null : "Docker socket not available",
};

async function refreshStats() {
  if (!dockerAvailable()) {
    latestStats = {
      ts: new Date().toISOString(),
      source: "docker",
      targets: [],
      note: "Docker socket not available",
    };
    return;
  }
  try {
    latestStats = await collectMatrixStats();
  } catch (err) {
    latestStats = {
      ts: new Date().toISOString(),
      source: "docker",
      targets: [],
      note: err.message,
    };
  }
}

setInterval(() => {
  refreshStats().catch(() => {});
}, STATS_INTERVAL_MS);
refreshStats().catch(() => {});

wss.on("connection", (socket) => {
  socket.send(JSON.stringify(latestStats));
  const timer = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(latestStats));
    }
  }, STATS_INTERVAL_MS);
  socket.on("close", () => clearInterval(timer));
});

server.listen(PORT, () => {
  console.log(`Orchestrator listening on :${PORT} (docker socket: ${dockerAvailable()})`);
});
