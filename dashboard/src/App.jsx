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

export default function App() {
  const [targets, setTargets] = useState([]);
  const [stats, setStats] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    refreshTargets();
    const poll = setInterval(refreshTargets, 5000);
    return () => clearInterval(poll);
  }, [refreshTargets]);

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

  const cpuData = {
    labels,
    datasets: chartNames.map((name, i) => ({
      label: `${name} CPU %`,
      data: stats.map((s) => s.targets?.find((t) => t.name === name)?.cpuPct ?? null),
      borderColor: COLORS[i % COLORS.length],
      tension: 0.2,
      spanGaps: true,
    })),
  };

  const memData = {
    labels,
    datasets: chartNames.map((name, i) => ({
      label: `${name} mem MB`,
      data: stats.map((s) => s.targets?.find((t) => t.name === name)?.memMb ?? null),
      borderColor: COLORS[i % COLORS.length],
      tension: 0.2,
      spanGaps: true,
    })),
  };

  const threadData = {
    labels,
    datasets: chartNames.map((name, i) => ({
      label: `${name} threads`,
      data: stats.map((s) => s.targets?.find((t) => t.name === name)?.threads ?? null),
      borderColor: COLORS[i % COLORS.length],
      tension: 0.2,
      spanGaps: true,
    })),
  };

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
        <p>Live orchestrator — Docker stats + target control</p>
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
        <h2>CPU %</h2>
        <Line data={cpuData} options={chartOpts} />
      </section>

      <section>
        <h2>Memory (MB)</h2>
        <Line data={memData} options={chartOpts} />
      </section>

      <section>
        <h2>JVM threads (from /health)</h2>
        <Line data={threadData} options={chartOpts} />
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
