package com.springbench.insurance.domain;

import java.time.Instant;
import java.time.format.DateTimeFormatter;

public final class DomainTime {
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_INSTANT;

    private DomainTime() {
    }

    public static String now() {
        return FORMATTER.format(Instant.now());
    }

    public static Instant parse(String value) {
        return Instant.parse(value);
    }
}
