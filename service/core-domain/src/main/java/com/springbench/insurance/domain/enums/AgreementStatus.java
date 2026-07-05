package com.springbench.insurance.domain.enums;

public enum AgreementStatus {
    ACTIVE,
    INACTIVE,
    PENDING,
    EXPIRED,
    ARCHIVED;

    public static AgreementStatus fromString(String value) {
        return AgreementStatus.valueOf(value);
    }
}
