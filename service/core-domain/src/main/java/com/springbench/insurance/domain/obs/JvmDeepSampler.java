package com.springbench.insurance.domain.obs;

import java.io.BufferedReader;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Framework-agnostic JVM deep samples for live dashboard feeds.
 * Context switches come from Linux {@code /proc/self/status}; lock wait/block
 * counts come from {@link ThreadMXBean} (cumulative; callers compute rates).
 */
public final class JvmDeepSampler {
    private static final Path PROC_STATUS = Paths.get("/proc/self/status");

    private JvmDeepSampler() {
    }

    public static long voluntaryContextSwitches() {
        return readProcLong("voluntary_ctxt_switches");
    }

    public static long nonvoluntaryContextSwitches() {
        return readProcLong("nonvoluntary_ctxt_switches");
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

    private static long readProcLong(String key) {
        if (!Files.isRegularFile(PROC_STATUS)) {
            return -1L;
        }
        BufferedReader reader = null;
        try {
            reader = Files.newBufferedReader(PROC_STATUS, StandardCharsets.UTF_8);
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
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException ignored) {
                    // ignore
                }
            }
        }
    }
}
