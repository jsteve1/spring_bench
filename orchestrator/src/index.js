import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createServer } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/stats/stream" });

const PORT = process.env.PORT || 3000;
const RUNS_DIR = process.env.RUNS_DIR || path.join(__dirname, "..", "runs");
const DASHBOARD_DIST = process.env.DASHBOARD_DIST || path.join(__dirname, "..", "..", "dashboard", "dist");

const MATRIX_TARGETS = [
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

fs.mkdirSync(RUNS_DIR, { recursive: true });

app.use(express.json());

if (fs.existsSync(DASHBOARD_DIST)) {
  app.use(express.static(DASHBOARD_DIST));
}

app.get("/api/targets", (_req, res) => {
  res.json(
    MATRIX_TARGETS.map((name) => ({
      name,
      port: targetPort(name),
      state: "unknown",
    })),
  );
});

app.post("/api/targets/:name/start", (req, res) => {
  res.json({ name: req.params.name, action: "start", status: "accepted" });
});

app.post("/api/targets/:name/stop", (req, res) => {
  res.json({ name: req.params.name, action: "stop", status: "accepted" });
});

app.post("/api/targets/:name/restart", (req, res) => {
  res.json({ name: req.params.name, action: "restart", status: "accepted" });
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

wss.on("connection", (socket) => {
  const timer = setInterval(() => {
    socket.send(
      JSON.stringify({
        ts: new Date().toISOString(),
        targets: MATRIX_TARGETS.map((name) => ({
          name,
          cpuPct: Math.random() * 100,
          memMb: Math.random() * 512,
        })),
      }),
    );
  }, 2000);
  socket.on("close", () => clearInterval(timer));
});

function targetPort(name) {
  const map = {
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
  return map[name] || 8080;
}

server.listen(PORT, () => {
  console.log(`Orchestrator listening on :${PORT}`);
});
