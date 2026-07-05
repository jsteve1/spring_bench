package com.springbench.insurance.domain.service;

import com.springbench.insurance.domain.model.LifeInsuranceAgreement;

public interface AgreementService {
    LifeInsuranceAgreement createAgreement(LifeInsuranceAgreement agreement, String updatedBy);

    LifeInsuranceAgreement updateAgreement(String id, EntityUpdate update, String updatedBy);
}
