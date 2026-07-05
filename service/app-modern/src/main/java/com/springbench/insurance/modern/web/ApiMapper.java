package com.springbench.insurance.modern.web;

import com.springbench.insurance.domain.enums.AgreementStatus;
import com.springbench.insurance.domain.enums.DemographicsStatus;
import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.domain.model.Dependent;
import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.model.LifeInsuranceAgreement;
import com.springbench.insurance.domain.model.Member;
import com.springbench.insurance.domain.model.PageResult;
import com.springbench.insurance.domain.service.EntityUpdate;
import com.springbench.insurance.modern.web.dto.AgreementRequest;
import com.springbench.insurance.modern.web.dto.DemographicsRequest;
import com.springbench.insurance.modern.web.dto.UpdateMemberRequest;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ApiMapper {
    private ApiMapper() {
    }

    public static Demographics toDemographics(DemographicsRequest request) {
        Demographics demographics = new Demographics();
        demographics.setFname(request.getFname());
        demographics.setLname(request.getLname());
        demographics.setEmail(request.getEmail());
        demographics.setPhoneNumber(request.getPhoneNumber());
        demographics.setStatus(DemographicsStatus.fromString(request.getStatus()));
        return demographics;
    }

    public static EntityUpdate toEntityUpdate(UpdateMemberRequest request) {
        EntityUpdate update = new EntityUpdate();
        if (request.getStatus() != null) {
            update.setStatus(EntityStatus.fromString(request.getStatus()));
        }
        update.setAgreementId(request.getAgreementId());
        return update;
    }

    public static LifeInsuranceAgreement toAgreement(AgreementRequest request) {
        LifeInsuranceAgreement agreement = new LifeInsuranceAgreement();
        if (request.getStatus() != null) {
            agreement.setStatus(AgreementStatus.fromString(request.getStatus()));
        }
        agreement.setExpiryDate(request.getExpiryDate());
        agreement.setSentDate(request.getSentDate());
        agreement.setPdfLink(request.getPdfLink());
        return agreement;
    }

    public static EntityUpdate toAgreementUpdate(AgreementRequest request) {
        EntityUpdate update = new EntityUpdate();
        if (request.getStatus() != null) {
            update.setAgreementStatus(AgreementStatus.fromString(request.getStatus()));
        }
        update.setExpiryDate(request.getExpiryDate());
        update.setSentDate(request.getSentDate());
        update.setPdfLink(request.getPdfLink());
        return update;
    }

    public static Map<String, Object> toMemberMap(Member member) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("id", member.getId());
        body.put("demographics", toDemographicsMap(member.getDemographics()));
        body.put("agreement", member.getAgreement() == null ? null : toAgreementMap(member.getAgreement()));
        List<Map<String, Object>> dependents = new ArrayList<Map<String, Object>>();
        for (Dependent dependent : member.getDependents()) {
            dependents.add(toDependentMap(dependent));
        }
        body.put("dependents", dependents);
        body.put("status", member.getStatus().name());
        body.put("created", member.getCreated());
        body.put("updated", member.getUpdated());
        body.put("updatedBy", member.getUpdatedBy());
        return body;
    }

    public static Map<String, Object> toPageMap(PageResult<?> page, List<Map<String, Object>> content) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("content", content);
        body.put("page", page.getPage());
        body.put("size", page.getSize());
        body.put("totalElements", page.getTotalElements());
        body.put("totalPages", page.getTotalPages());
        body.put("sort", page.getSort());
        return body;
    }

    public static Map<String, Object> toAuditMap(AuditEntry entry) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("id", entry.getId());
        body.put("change", entry.getChange());
        body.put("entityType", entry.getEntityType() == null ? null : entry.getEntityType().name());
        body.put("entityId", entry.getEntityId());
        body.put("action", entry.getAction() == null ? null : entry.getAction().name());
        body.put("created", entry.getCreated());
        body.put("updated", entry.getUpdated());
        body.put("updatedBy", entry.getUpdatedBy());
        return body;
    }

    private static Map<String, Object> toDemographicsMap(Demographics demographics) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("id", demographics.getId());
        body.put("fname", demographics.getFname());
        body.put("lname", demographics.getLname());
        body.put("email", demographics.getEmail());
        body.put("phoneNumber", demographics.getPhoneNumber());
        body.put("status", demographics.getStatus().name());
        body.put("created", demographics.getCreated());
        body.put("updated", demographics.getUpdated());
        body.put("updatedBy", demographics.getUpdatedBy());
        return body;
    }

    public static Map<String, Object> toAgreementMap(LifeInsuranceAgreement agreement) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("id", agreement.getId());
        body.put("status", agreement.getStatus().name());
        body.put("expiryDate", agreement.getExpiryDate());
        body.put("sentDate", agreement.getSentDate());
        body.put("pdfLink", agreement.getPdfLink());
        body.put("created", agreement.getCreated());
        body.put("updated", agreement.getUpdated());
        body.put("updatedBy", agreement.getUpdatedBy());
        return body;
    }

    public static Map<String, Object> toDependentMap(Dependent dependent) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("id", dependent.getId());
        body.put("memberId", dependent.getMemberId());
        body.put("demographics", toDemographicsMap(dependent.getDemographics()));
        body.put("status", dependent.getStatus().name());
        body.put("created", dependent.getCreated());
        body.put("updated", dependent.getUpdated());
        body.put("updatedBy", dependent.getUpdatedBy());
        return body;
    }
}
