package com.springbench.insurance.legacy.web.dto;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

public class CreateMemberRequest {
    @NotNull
    @Valid
    private DemographicsRequest demographics;
    private String agreementId;

    public DemographicsRequest getDemographics() {
        return demographics;
    }

    public void setDemographics(DemographicsRequest demographics) {
        this.demographics = demographics;
    }

    public String getAgreementId() {
        return agreementId;
    }

    public void setAgreementId(String agreementId) {
        this.agreementId = agreementId;
    }
}
