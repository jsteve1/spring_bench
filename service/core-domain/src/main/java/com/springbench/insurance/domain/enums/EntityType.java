package com.springbench.insurance.domain.enums;

public enum EntityType {
    MEMBER,
    DEPENDENT,
    AGREEMENT,
    DEMOGRAPHICS;

    public static EntityType fromString(String value) {
        return EntityType.valueOf(value);
    }
}
