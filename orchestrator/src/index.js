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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/stats/stream" });

const PORT = process.env.PORT || 3000;
const RUNS_DIR = process.env.RUNS_DIR || path.join(__dirname, "..", "runs");
const DASHBOARD_DIST = process.env.DASHBOARD_DIST || path.join(__dirname, "..", "..", "dashboard", "dist");

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

app.post("/api/loadtest", (req, res) => {
  const runId = crypto.randomUUID();
  const record = {
    runId,
    startedAt: new Date().toISOString(),
    request: req.body,
    status: "queued",
  };
  fs.writeFileSync(path.join(RUNS_DIR, `${runId}.json`), JSON.stringify(record, null, 2));
  res.status(202).json(record);
});

app.get("/api/runs", (_req, res) => {
  const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
  const runs = files
    .map((file) => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, file), "utf8")))
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

wss.on("connection", (socket) => {
  const timer = setInterval(() => {
    socket.send(
      JSON.stringify({
        ts: new Date().toISOString(),
        targets: [],
        note: "ORCH-04: live docker stats not wired yet",
      }),
    );
  }, 2000);
  socket.on("close", () => clearInterval(timer));
});

server.listen(PORT, () => {
  console.log(`Orchestrator listening on :${PORT} (docker socket: ${dockerAvailable()})`);
});
