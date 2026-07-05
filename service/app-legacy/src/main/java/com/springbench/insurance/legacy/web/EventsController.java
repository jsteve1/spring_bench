package com.springbench.insurance.legacy.web;

import com.springbench.insurance.domain.DomainTime;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
public class EventsController {
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<String, SseEmitter>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public EventsController() {
        scheduler.scheduleAtFixedRate(this::broadcastHeartbeat, 1, 2, TimeUnit.SECONDS);
    }

    @GetMapping(path = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        SseEmitter emitter = new SseEmitter(0L);
        String id = java.util.UUID.randomUUID().toString();
        emitters.put(id, emitter);
        emitter.onCompletion(() -> emitters.remove(id));
        emitter.onTimeout(() -> emitters.remove(id));
        emitter.onError(ex -> emitters.remove(id));
        return emitter;
    }

    private void broadcastHeartbeat() {
        for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
            try {
                SseEmitter emitter = entry.getValue();
                emitter.send(SseEmitter.event()
                        .name("heartbeat")
                        .data("{\"ts\":\"" + DomainTime.now() + "\",\"activeThreads\":"
                                + ManagementFactory.getThreadMXBean().getThreadCount() + ",\"virtual\":"
                                + virtualEnabled() + "}"));
            } catch (IOException ex) {
                emitters.remove(entry.getKey());
            }
        }
    }

    private boolean virtualEnabled() {
        return Boolean.parseBoolean(System.getProperty("spring.threads.virtual.enabled",
                System.getenv().getOrDefault("SPRING_THREADS_VIRTUAL_ENABLED", "false")));
    }
}
