package com.springbench.insurance.modern.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class AddDependentRequest {
    @NotNull
    @Valid
    private DemographicsRequest demographics;

    public DemographicsRequest getDemographics() {
        return demographics;
    }

    public void setDemographics(DemographicsRequest demographics) {
        this.demographics = demographics;
    }
}
