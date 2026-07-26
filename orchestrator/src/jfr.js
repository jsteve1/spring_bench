import fs from "fs";
import path from "path";
import { getDocker } from "./dockerClient.js";
import { demuxDockerStream } from "./dockerStream.js";

const RUNS_DIR = process.env.RUNS_DIR || path.join(process.cwd(), "runs");

async function execIn(containerName, cmd) {
  const container = getDocker().getContainer(containerName);
  const exec = await container.exec({
    Cmd: ["sh", "-c", cmd],
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const inspect = await exec.inspect();
  return {
    exitCode: inspect.ExitCode,
    output: demuxDockerStream(Buffer.concat(chunks)),
  };
}

/** Very small tar reader for a single regular file entry. */
function extractFirstFileFromTar(tarPath, destFile) {
  const buf = fs.readFileSync(tarPath);
  if (buf.length < 512) {
    return false;
  }
  const name = buf.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
  const sizeOctal = buf.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
  const size = parseInt(sizeOctal, 8);
  if (!name || !Number.isFinite(size) || size < 0) {
    return false;
  }
  const data = buf.subarray(512, 512 + size);
  fs.writeFileSync(destFile, data);
  return data.length > 0;
}

/**
 * Best-effort aggregates using jfr print inside the target JDK image.
 * Counts lines of text output per high-signal event type (comparative, not absolute).
 */
async function summarizeJfr(targetName, jfrPath) {
  const events = [
    "jdk.ThreadContextSwitchRate",
    "jdk.JavaMonitorEnter",
    "jdk.JavaMonitorWait",
    "jdk.ThreadPark",
    "jdk.VirtualThreadPinned",
    "jdk.GarbageCollection",
  ];
  const aggregates = {};
  for (const event of events) {
    try {
      const res = await execIn(
        targetName,
        `jfr print --events ${event} ${jfrPath} 2>/dev/null | wc -l`,
      );
      const lines = Number(String(res.output || "").replace(/[^\d]/g, "")) || 0;
      aggregates[event] = Math.max(0, lines);
    } catch {
      aggregates[event] = null;
    }
  }
  return aggregates;
}

/**
 * Dump continuous JFR recording and copy into runs/{runId}/bench.jfr.
 * Best-effort: never fails the load test if JFR is unavailable.
 */
export async function collectJfr(targetName, runId) {
  const outDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(outDir, { recursive: true });
  const destInOrch = path.join(outDir, "bench.jfr");

  try {
    const dump = await execIn(
      targetName,
      'PID=$(pgrep -n -f "[j]ava.*app.jar" || pgrep -n java); ' +
        'if [ -z "$PID" ]; then echo "no java pid"; exit 2; fi; ' +
        "jcmd $PID JFR.dump name=bench filename=/tmp/bench-dump.jfr || " +
        "jcmd $PID JFR.dump filename=/tmp/bench-dump.jfr; " +
        "ls -la /tmp/bench*.jfr 2>/dev/null || true",
    );

    const srcFile = dump.output.includes("bench-dump.jfr")
      ? "/tmp/bench-dump.jfr"
      : "/tmp/bench.jfr";

    const container = getDocker().getContainer(targetName);
    const archiveStream = await container.getArchive({ path: srcFile });
    const tarPath = path.join(outDir, "bench.tar");
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tarPath);
      archiveStream.pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
      archiveStream.on("error", reject);
    });

    const extracted = extractFirstFileFromTar(tarPath, destInOrch);
    try {
      fs.unlinkSync(tarPath);
    } catch {
      // ignore
    }

    let aggregates = null;
    if (extracted && fs.existsSync(destInOrch)) {
      aggregates = await summarizeJfr(targetName, srcFile);
    }

    return {
      ok: extracted,
      path: extracted ? `runs/${runId}/bench.jfr` : null,
      dumpOutput: dump.output.slice(-2000),
      aggregates,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
    };
  }
}
