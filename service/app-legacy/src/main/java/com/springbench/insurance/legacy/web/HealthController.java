package com.springbench.insurance.legacy.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootVersion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {
    @Value("${spring.threads.virtual.enabled:false}")
    private boolean virtualThreadsConfigured;

    @GetMapping("/health")
    public Map<String, Object> health() {
        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("status", "UP");
        body.put("javaVersion", System.getProperty("java.version"));
        body.put("javaVendor", System.getProperty("java.vendor"));
        body.put("springBoot", SpringBootVersion.getVersion());
        body.put("virtualThreadsEnabled", false);
        body.put("activeThreadCount", ManagementFactory.getThreadMXBean().getThreadCount());
        body.put("availableProcessors", runtime.availableProcessors());
        body.put("maxHeapMb", runtime.maxMemory() / (1024 * 1024));
        return body;
    }

    private boolean virtualThreadsEnabled() {
        try {
            Class.forName("java.lang.Thread$Builder$OfVirtual");
            return virtualThreadsConfigured;
        } catch (ClassNotFoundException ex) {
            return false;
        }
    }
}
