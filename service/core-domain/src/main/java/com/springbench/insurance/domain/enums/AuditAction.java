package com.springbench.insurance.domain.enums;

public enum AuditAction {
    CREATE,
    UPDATE,
    DELETE,
    STATUS_CHANGE;

    public static AuditAction fromString(String value) {
        return AuditAction.valueOf(value);
    }
}
