package com.springbench.insurance.domain.enums;

public enum EntityStatus {
    ACTIVE,
    INACTIVE,
    ARCHIVED;

    public static EntityStatus fromString(String value) {
        return EntityStatus.valueOf(value);
    }
}
