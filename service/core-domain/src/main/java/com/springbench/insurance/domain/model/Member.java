package com.springbench.insurance.domain.model;

import com.springbench.insurance.domain.enums.EntityStatus;

import java.util.ArrayList;
import java.util.List;

public class Member {
    private String id;
    private String demographicsId;
    private String agreementId;
    private Demographics demographics;
    private LifeInsuranceAgreement agreement;
    private List<Dependent> dependents = new ArrayList<Dependent>();
    private EntityStatus status;
    private String created;
    private String updated;
    private String updatedBy;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDemographicsId() {
        return demographicsId;
    }

    public void setDemographicsId(String demographicsId) {
        this.demographicsId = demographicsId;
    }

    public String getAgreementId() {
        return agreementId;
    }

    public void setAgreementId(String agreementId) {
        this.agreementId = agreementId;
    }

    public Demographics getDemographics() {
        return demographics;
    }

    public void setDemographics(Demographics demographics) {
        this.demographics = demographics;
    }

    public LifeInsuranceAgreement getAgreement() {
        return agreement;
    }

    public void setAgreement(LifeInsuranceAgreement agreement) {
        this.agreement = agreement;
    }

    public List<Dependent> getDependents() {
        return dependents;
    }

    public void setDependents(List<Dependent> dependents) {
        this.dependents = dependents;
    }

    public EntityStatus getStatus() {
        return status;
    }

    public void setStatus(EntityStatus status) {
        this.status = status;
    }

    public String getCreated() {
        return created;
    }

    public void setCreated(String created) {
        this.created = created;
    }

    public String getUpdated() {
        return updated;
    }

    public void setUpdated(String updated) {
        this.updated = updated;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
