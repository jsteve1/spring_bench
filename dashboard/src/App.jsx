import React, { useEffect, useState } from "react";
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

export default function App() {
  const [targets, setTargets] = useState([]);
  const [stats, setStats] = useState([]);

  useEffect(() => {
    fetch("/api/targets")
      .then((r) => r.json())
      .then(setTargets)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/stats/stream`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setStats((prev) => [...prev.slice(-30), payload]);
    };
    return () => ws.close();
  }, []);

  const latest = stats[stats.length - 1];
  const chartData = {
    labels: stats.map((s) => new Date(s.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "CPU % (sample target)",
        data: stats.map((s) => s.targets?.[0]?.cpuPct ?? 0),
        borderColor: "#2563eb",
        tension: 0.2,
      },
    ],
  };

  return (
    <main className="layout">
      <header>
        <h1>Java Concurrency Matrix</h1>
        <p>Live orchestrator dashboard scaffold</p>
      </header>

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
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Live CPU</h2>
        <Line data={chartData} options={{ responsive: true, animation: false }} />
        {latest && <pre>{JSON.stringify(latest, null, 2)}</pre>}
      </section>
    </main>
  );
}
