package com.springbench.insurance.domain.obs;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Framework-agnostic JVM deep samples for live dashboard feeds.
 * Context switches are summed over Linux {@code /proc/self/task/&#42;/status}; lock
 * wait/block counts come from {@link ThreadMXBean} (cumulative; callers compute
 * rates).
 *
 * <p>Summing per-thread counters is required: {@code /proc/self/status} reports
 * the main thread only, which is idle in a server workload. The sum can dip when
 * OS threads exit, so rate consumers must treat a negative delta as a gap.
 */
public final class JvmDeepSampler {
    private static final Path PROC_STATUS = Paths.get("/proc/self/status");
    private static final Path PROC_TASK_DIR = Paths.get("/proc/self/task");

    private JvmDeepSampler() {
    }

    public static long voluntaryContextSwitches() {
        return sumThreadProcLong("voluntary_ctxt_switches");
    }

    public static long nonvoluntaryContextSwitches() {
        return sumThreadProcLong("nonvoluntary_ctxt_switches");
    }

    public static long totalContextSwitches() {
        long voluntary = voluntaryContextSwitches();
        long nonvoluntary = nonvoluntaryContextSwitches();
        if (voluntary < 0 && nonvoluntary < 0) {
            return -1L;
        }
        return Math.max(0L, voluntary) + Math.max(0L, nonvoluntary);
    }

    public static long threadBlockedCount() {
        return sumThreadCounts(true);
    }

    public static long threadWaitedCount() {
        return sumThreadCounts(false);
    }

    private static long sumThreadCounts(boolean blocked) {
        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        long[] ids = mx.getAllThreadIds();
        ThreadInfo[] infos = mx.getThreadInfo(ids);
        long total = 0L;
        if (infos == null) {
            return 0L;
        }
        for (int i = 0; i < infos.length; i++) {
            ThreadInfo info = infos[i];
            if (info == null) {
                continue;
            }
            total += blocked ? info.getBlockedCount() : info.getWaitedCount();
        }
        return total;
    }

    private static long sumThreadProcLong(String key) {
        if (Files.isDirectory(PROC_TASK_DIR)) {
            long total = 0L;
            boolean any = false;
            DirectoryStream<Path> tasks = null;
            try {
                tasks = Files.newDirectoryStream(PROC_TASK_DIR);
                for (Path task : tasks) {
                    long value = readProcLong(task.resolve("status"), key);
                    if (value >= 0L) {
                        total += value;
                        any = true;
                    }
                }
            } catch (IOException ex) {
                any = false;
            } finally {
                closeQuietly(tasks);
            }
            if (any) {
                return total;
            }
        }
        return readProcLong(PROC_STATUS, key);
    }

    private static long readProcLong(Path statusFile, String key) {
        if (!Files.isRegularFile(statusFile)) {
            return -1L;
        }
        BufferedReader reader = null;
        try {
            reader = Files.newBufferedReader(statusFile, StandardCharsets.UTF_8);
            String line;
            String prefix = key + ":";
            while ((line = reader.readLine()) != null) {
                if (line.startsWith(prefix)) {
                    String value = line.substring(prefix.length()).trim();
                    return Long.parseLong(value);
                }
            }
            return -1L;
        } catch (IOException | NumberFormatException ex) {
            return -1L;
        } finally {
            closeQuietly(reader);
        }
    }

    private static void closeQuietly(Closeable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (IOException ignored) {
            // best effort
        }
    }
}
