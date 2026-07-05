package com.springbench.insurance.domain;

import java.util.UUID;

public final class DomainIds {
    private DomainIds() {
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }
}
