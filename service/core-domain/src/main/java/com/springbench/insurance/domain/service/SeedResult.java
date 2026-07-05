package com.springbench.insurance.domain.service;

public class SeedResult {
    private final int created;
    private final long elapsedMs;

    public SeedResult(int created, long elapsedMs) {
        this.created = created;
        this.elapsedMs = elapsedMs;
    }

    public int getCreated() {
        return created;
    }

    public long getElapsedMs() {
        return elapsedMs;
    }
}
