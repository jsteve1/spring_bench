package com.springbench.insurance.modern.config;

import com.springbench.insurance.domain.obs.JvmDeepSampler;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class JvmDeepMetrics {
    private final MeterRegistry registry;
    private final Object state = new Object();

    public JvmDeepMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    @PostConstruct
    public void bind() {
        Gauge.builder("bench.context.switches.voluntary", state, s -> safe(JvmDeepSampler.voluntaryContextSwitches()))
                .description("Voluntary context switches from /proc/self/status")
                .register(registry);
        Gauge.builder("bench.context.switches.nonvoluntary", state, s -> safe(JvmDeepSampler.nonvoluntaryContextSwitches()))
                .description("Non-voluntary context switches from /proc/self/status")
                .register(registry);
        Gauge.builder("bench.context.switches.total", state, s -> safe(JvmDeepSampler.totalContextSwitches()))
                .description("Sum of voluntary and non-voluntary context switches")
                .register(registry);
        Gauge.builder("bench.threads.blocked.total", state, s -> (double) JvmDeepSampler.threadBlockedCount())
                .description("Cumulative ThreadMXBean blocked counts across live threads")
                .register(registry);
        Gauge.builder("bench.threads.waited.total", state, s -> (double) JvmDeepSampler.threadWaitedCount())
                .description("Cumulative ThreadMXBean waited counts across live threads")
                .register(registry);
    }

    private static double safe(long value) {
        return value < 0 ? Double.NaN : (double) value;
    }
}
