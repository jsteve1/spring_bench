package com.springbench.insurance.domain.enums;

public enum DemographicsStatus {
    ALIVE,
    DECEASED;

    public static DemographicsStatus fromString(String value) {
        return DemographicsStatus.valueOf(value);
    }
}
