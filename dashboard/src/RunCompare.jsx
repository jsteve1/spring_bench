import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { completedRuns, parseTargetDims, runLabel, runMetrics } from "./runMeta.js";
import { DEMO_RUNS } from "./fixtures/demoRuns.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
];

const METRIC_GROUPS = [
  {
    title: "Client latency (ms)",
    metrics: [
      { key: "p50", label: "p50" },
      { key: "p95", label: "p95" },
      { key: "p99", label: "p99" },
    ],
  },
  {
    title: "Client throughput / errors",
    metrics: [
      { key: "rps", label: "RPS" },
      { key: "errorRate", label: "Error rate", scale: 100 },
      { key: "sseEvents", label: "SSE events" },
    ],
  },
  {
    title: "Server / JFR",
    metrics: [
      { key: "memMbPeak", label: "Peak mem (MB)" },
      { key: "threadsPeak", label: "Peak threads" },
      { key: "contextSwitch", label: "Context-switch lines" },
      { key: "monitorEnter", label: "MonitorEnter lines" },
      { key: "vthreadPinned", label: "VT pinned lines" },
    ],
  },
];

export default function RunCompare({ runs, onUseDemo }) {
  const candidates = useMemo(() => completedRuns(runs), [runs]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(candidates.map((r) => r.runId));
      const kept = prev.filter((id) => ids.has(id));
      if (kept.length > 0) {
        return kept;
      }
      return candidates.slice(0, 2).map((r) => r.runId);
    });
  }, [candidates]);

  const selectedRuns = useMemo(() => {
    const set = new Set(selected);
    return candidates.filter((r) => set.has(r.runId));
  }, [candidates, selected]);

  function toggle(runId) {
    setSelected((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 6) {
        return [...prev.slice(1), runId];
      }
      return [...prev, runId];
    });
  }

  function selectAllVisible() {
    setSelected(candidates.slice(0, 6).map((r) => r.runId));
  }

  function clearSelection() {
    setSelected([]);
  }

  const barOpts = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { position: "bottom" },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  function barData(metricKeys) {
    const labels = metricKeys.map((m) => m.label);
    return {
      labels,
      datasets: selectedRuns.map((run, i) => {
        const m = runMetrics(run);
        return {
          label: runLabel(run),
          data: metricKeys.map((def) => {
            const v = m[def.key];
            if (v == null) return null;
            return def.scale ? v * def.scale : v;
          }),
          backgroundColor: COLORS[i % COLORS.length],
        };
      }),
    };
  }

  return (
    <section className="compare">
      <div className="compare-head">
        <h2>Historical comparison</h2>
        <p className="compare-sub">
          Select completed runs to compare one variable at a time (runtime / threading / footprint).
        </p>
        <div className="compare-actions">
          <button type="button" onClick={selectAllVisible} disabled={candidates.length === 0}>
            Select up to 6
          </button>
          <button type="button" onClick={clearSelection} disabled={selectedRuns.length === 0}>
            Clear
          </button>
          {candidates.length === 0 && (
            <button type="button" onClick={() => onUseDemo?.(DEMO_RUNS)}>
              Load demo runs
            </button>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="note">No completed runs yet. Launch a load test, or load demo runs.</p>
      ) : (
        <ul className="compare-list">
          {candidates.map((r) => {
            const dims = parseTargetDims(r.target || r.request?.targetName);
            const m = runMetrics(r);
            const checked = selected.includes(r.runId);
            return (
              <li key={r.runId}>
                <label className="compare-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.runId)}
                  />
                  <span className="compare-main">
                    <strong>{dims.label}</strong>
                    <span className="dim-chip">Java {dims.runtime}</span>
                    <span className="dim-chip">{dims.threading}</span>
                    <span className="dim-chip">{dims.footprint}</span>
                    <span className="dim-chip">{r.config?.mode || r.request?.mode}</span>
                  </span>
                  <span className="compare-metrics">
                    {m.p95 != null && <span>p95 {Math.round(m.p95)}ms</span>}
                    {m.rps != null && <span>{Math.round(m.rps)} rps</span>}
                    {m.sseEvents != null && <span>{m.sseEvents} sse evt</span>}
                    {m.memMbPeak != null && <span>mem {Math.round(m.memMbPeak)}MB</span>}
                    {m.vthreadPinned != null && <span>pin {m.vthreadPinned}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selectedRuns.length >= 2 &&
        METRIC_GROUPS.map((group) => (
          <div key={group.title} className="compare-chart">
            <h3>{group.title}</h3>
            <Bar data={barData(group.metrics)} options={barOpts} />
          </div>
        ))}

      {selectedRuns.length >= 2 && (
        <div className="compare-table-wrap">
          <h3>Side-by-side</h3>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Metric</th>
                {selectedRuns.map((r) => (
                  <th key={r.runId}>{runLabel(r)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Runtime", (r) => parseTargetDims(r.target).runtime],
                ["Threading", (r) => parseTargetDims(r.target).threading],
                ["Footprint", (r) => parseTargetDims(r.target).footprint],
                ["Mode", (r) => r.config?.mode || r.request?.mode || "—"],
                ["p50 ms", (r) => fmt(runMetrics(r).p50)],
                ["p95 ms", (r) => fmt(runMetrics(r).p95)],
                ["p99 ms", (r) => fmt(runMetrics(r).p99)],
                ["RPS", (r) => fmt(runMetrics(r).rps)],
                ["Error rate", (r) => pct(runMetrics(r).errorRate)],
                ["SSE events", (r) => fmt(runMetrics(r).sseEvents)],
                ["Peak CPU %", (r) => fmt(runMetrics(r).cpuPctPeak)],
                ["Peak mem MB", (r) => fmt(runMetrics(r).memMbPeak)],
                ["Peak threads", (r) => fmt(runMetrics(r).threadsPeak)],
                ["Context-switch", (r) => fmt(runMetrics(r).contextSwitch)],
                ["MonitorEnter", (r) => fmt(runMetrics(r).monitorEnter)],
                ["Blocked rate peak", (r) => fmt(runMetrics(r).blockedRatePeak)],
                ["VT pinned", (r) => fmt(runMetrics(r).vthreadPinned)],
              ].map(([label, getter]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {selectedRuns.map((r) => (
                    <td key={r.runId}>{getter(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRuns.length === 1 && (
        <p className="note">Select at least two completed runs to compare.</p>
      )}
    </section>
  );
}

function fmt(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(Math.round(v * 100) / 100);
}

function pct(v) {
  if (v == null) return "—";
  return `${Math.round(v * 10000) / 100}%`;
}
