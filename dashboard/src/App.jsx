import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#db2777",
  "#65a30d",
];

const defaultLoadForm = {
  mode: "rest",
  targetName: "java21-virtual-low",
  vus: 10,
  duration: "45s",
  rampStages: "0:10s,full:20s,0:10s",
  dropRate: 0.1,
};

export default function App() {
  const [targets, setTargets] = useState([]);
  const [stats, setStats] = useState([]);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [loadForm, setLoadForm] = useState(defaultLoadForm);
  const [lastRun, setLastRun] = useState(null);

  const refreshTargets = useCallback(() => {
    fetch("/api/targets")
      .then((r) => {
        if (!r.ok) {
          throw new Error(`targets ${r.status}`);
        }
        return r.json();
      })
      .then(setTargets)
      .catch((err) => setError(err.message));
  }, []);

  const refreshRuns = useCallback(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then(setRuns)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshTargets();
    refreshRuns();
    const poll = setInterval(() => {
      refreshTargets();
      refreshRuns();
    }, 5000);
    return () => clearInterval(poll);
  }, [refreshTargets, refreshRuns]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/stats/stream`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setStats((prev) => [...prev.slice(-40), payload]);
    };
    ws.onerror = () => setError("stats WebSocket error");
    return () => ws.close();
  }, []);

  async function control(name, action) {
    setBusy(`${name}:${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/targets/${name}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `${action} failed`);
      }
      await refreshTargets();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function launchLoadTest(e) {
    e.preventDefault();
    setBusy("loadtest");
    setError(null);
    try {
      const res = await fetch("/api/loadtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loadForm),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "loadtest failed");
      }
      setLastRun(body);
      refreshRuns();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const runningNames = useMemo(() => {
    const latest = stats[stats.length - 1];
    if (!latest?.targets?.length) {
      return targets.filter((t) => t.state === "running").map((t) => t.name);
    }
    return latest.targets.filter((t) => t.state === "running").map((t) => t.name);
  }, [stats, targets]);

  const chartNames = runningNames.length
    ? runningNames
    : targets.slice(0, 3).map((t) => t.name);

  const labels = stats.map((s) => new Date(s.ts).toLocaleTimeString());

  function series(metric) {
    return {
      labels,
      datasets: chartNames.map((name, i) => ({
        label: `${name} ${metric}`,
        data: stats.map((s) => s.targets?.find((t) => t.name === name)?.[metric] ?? null),
        borderColor: COLORS[i % COLORS.length],
        tension: 0.2,
        spanGaps: true,
      })),
    };
  }

  const chartOpts = {
    responsive: true,
    animation: false,
    scales: {
      y: { beginAtZero: true },
    },
  };

  const latest = stats[stats.length - 1];

  return (
    <main className="layout">
      <header>
        <h1>Java Concurrency Matrix</h1>
        <p>Live Docker stats, JVM metrics, and k6 load tests</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>Targets</h2>
        <ul className="targets">
          {targets.map((t) => (
            <li key={t.name}>
              <strong>{t.name}</strong>
              <span className={`badge badge-${t.state}`}>{t.state}</span>
              <span>port {t.port}</span>
              {t.health?.status && <span>{t.health.status}</span>}
              {t.health?.javaVersion && <span>Java {t.health.javaVersion}</span>}
              {t.health?.virtualThreadsEnabled != null && (
                <span>{t.health.virtualThreadsEnabled ? "virtual" : "platform"}</span>
              )}
              <div className="actions">
                <button
                  type="button"
                  disabled={busy != null || t.state === "running" || t.state === "missing"}
                  onClick={() => control(t.name, "start")}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={busy != null || t.state !== "running"}
                  onClick={() => control(t.name, "stop")}
                >
                  Stop
                </button>
                <button
                  type="button"
                  disabled={busy != null || t.state === "missing"}
                  onClick={() => control(t.name, "restart")}
                >
                  Restart
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Load test</h2>
        <form className="load-form" onSubmit={launchLoadTest}>
          <label>
            Mode
            <select
              value={loadForm.mode}
              onChange={(e) => setLoadForm({ ...loadForm, mode: e.target.value })}
            >
              <option value="rest">REST</option>
              <option value="sse">SSE</option>
            </select>
          </label>
          <label>
            Target
            <select
              value={loadForm.targetName}
              onChange={(e) => setLoadForm({ ...loadForm, targetName: e.target.value })}
            >
              {targets.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.state})
                </option>
              ))}
            </select>
          </label>
          <label>
            VUs
            <input
              type="number"
              min="1"
              value={loadForm.vus}
              onChange={(e) => setLoadForm({ ...loadForm, vus: Number(e.target.value) })}
            />
          </label>
          <label>
            Duration
            <input
              value={loadForm.duration}
              onChange={(e) => setLoadForm({ ...loadForm, duration: e.target.value })}
            />
          </label>
          <label>
            Ramp stages
            <input
              value={loadForm.rampStages}
              onChange={(e) => setLoadForm({ ...loadForm, rampStages: e.target.value })}
            />
          </label>
          <label>
            Drop rate
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={loadForm.dropRate}
              onChange={(e) => setLoadForm({ ...loadForm, dropRate: Number(e.target.value) })}
            />
          </label>
          <button type="submit" disabled={busy != null}>
            Launch k6
          </button>
        </form>
        {lastRun && (
          <p className="note">
            Queued run <code>{lastRun.runId}</code> — status will update in history below.
          </p>
        )}
      </section>

      <section>
        <h2>Recent runs</h2>
        <ul className="runs">
          {runs.slice(0, 8).map((r) => (
            <li key={r.runId}>
              <strong>{r.target || r.request?.targetName || "?"}</strong>
              <span className={`badge badge-${r.status}`}>{r.status}</span>
              <span>{r.config?.mode || r.request?.mode}</span>
              {r.client?.latencyMs?.p95 != null && <span>p95 {Math.round(r.client.latencyMs.p95)}ms</span>}
              {r.client?.rps != null && <span>{Math.round(r.client.rps)} rps</span>}
              {r.error && <span className="error-inline">{r.error}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>CPU %</h2>
        <Line data={series("cpuPct")} options={chartOpts} />
      </section>

      <section>
        <h2>Container memory (MB)</h2>
        <Line data={series("memMb")} options={chartOpts} />
      </section>

      <section>
        <h2>JVM threads</h2>
        <Line data={series("threads")} options={chartOpts} />
      </section>

      <section>
        <h2>Heap used (MB)</h2>
        <Line data={series("heapUsedMb")} options={chartOpts} />
      </section>

      <section>
        <h2>GC pause count</h2>
        <Line data={series("gcPauseCount")} options={chartOpts} />
      </section>

      {latest?.note && <p className="note">{latest.note}</p>}
      {latest && (
        <details>
          <summary>Latest stats frame</summary>
          <pre>{JSON.stringify(latest, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
