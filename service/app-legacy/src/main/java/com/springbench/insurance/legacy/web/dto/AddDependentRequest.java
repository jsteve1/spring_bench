package com.springbench.insurance.legacy.web.dto;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

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
