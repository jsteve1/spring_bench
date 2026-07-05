package com.springbench.insurance.modern.web.dto;

public class UpdateMemberRequest {
    private String status;
    private String agreementId;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAgreementId() {
        return agreementId;
    }

    public void setAgreementId(String agreementId) {
        this.agreementId = agreementId;
    }
}
